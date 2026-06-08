"""
End-to-end tournament simulation against the REAL local Postgres DB so the result
is visible in the running app.

Decisions baked in (per request):
  * Wipe & simulate fresh: clears predictions / point_events / group_standings and
    any knockout matches, resets the existing group fixtures to 'scheduled', and
    zeroes member points. Users, tournaments, scoring rules and the real group
    fixtures (real teams) are kept. Re-runnable.
  * Random predictions for ALL members of every tournament.
  * Matches/standings are global, so every tournament scores from the same games;
    both leaderboards are printed at the end.

Flow:
  1. Wipe simulation-owned data, reset group fixtures, reset member points.
  2. Random predictions for all members across every match (added per round).
  3. Play all group games -> standings + scoring run for real.
  4. Determine qualifiers (1st + 2nd per group + 8 best thirds), build the Round
     of 32 the way the API would, assigning the 8 "best 3rd" slots by a valid
     matching against the official slot/group constraints.
  5. Walk the knockout game-by-game (R32 -> R16 -> QF), each round publishing the
     next round's fixtures from the winners and verifying the live bracket links
     and advances them.
  6. Finish one semifinal and leave the OTHER semifinal LIVE; confirm the live
     score + provisional points kick in on the bracket and leaderboards.

Run from backend/:  python scripts/simulate_bracket.py
"""
import os
import random
import re
import sys
from datetime import datetime, timedelta, timezone
from uuid import uuid4

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.match import Match
from app.models.point_event import PointEvent
from app.models.prediction import Prediction
from app.models.tournament import TournamentMember
from app.routers.standings import _ADVANCEMENT, _BRACKET_TOPOLOGY, get_bracket
from app.services.scoring import apply_match_result, update_provisional_points

DB_URL = os.environ["DATABASE_URL"]
assert "localhost" in DB_URL or "127.0.0.1" in DB_URL, f"refusing to run against non-local DB: {DB_URL}"
engine = create_engine(DB_URL, future=True)
Session = sessionmaker(bind=engine, autoflush=False, future=True)

ROUND_SLOTS = {
    "round_of_32": list(range(73, 89)),
    "round_of_16": list(range(89, 97)),
    "quarter_finals": list(range(97, 101)),
    "semi_finals": list(range(101, 103)),
}
EARLY_JOIN = datetime(2026, 1, 1, tzinfo=timezone.utc)


# ── helpers ─────────────────────────────────────────────────────────────────────

def hr(title):
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


def table_for(teams, scores):
    """In-memory group table using the same sort key as the standings service."""
    stat = {t: {"pts": 0, "gf": 0, "ga": 0, "w": 0, "d": 0, "l": 0} for t in teams}
    for (h, a), (hs, as_) in scores.items():
        stat[h]["gf"] += hs; stat[h]["ga"] += as_
        stat[a]["gf"] += as_; stat[a]["ga"] += hs
        if hs > as_:
            stat[h]["pts"] += 3; stat[h]["w"] += 1; stat[a]["l"] += 1
        elif hs < as_:
            stat[a]["pts"] += 3; stat[a]["w"] += 1; stat[h]["l"] += 1
        else:
            stat[h]["pts"] += 1; stat[a]["pts"] += 1; stat[h]["d"] += 1; stat[a]["d"] += 1
    ordered = sorted(
        teams,
        key=lambda t: (stat[t]["pts"], stat[t]["gf"] - stat[t]["ga"], stat[t]["gf"]),
        reverse=True,
    )
    return ordered, stat


def kuhn_matching(slots, allowed):
    match_group = {}

    def try_assign(slot, seen):
        for g in allowed[slot]:
            if g in seen:
                continue
            seen.add(g)
            if g not in match_group or try_assign(match_group[g], seen):
                match_group[g] = slot
                return True
        return False

    for s in slots:
        try_assign(s, set())
    result = {slot: g for g, slot in match_group.items()}
    return result if len(result) == len(slots) else None


def bracket_by_slot(db):
    return {s.slot_id: s for s in get_bracket(db=db, current_user=None)}


def winner_team(match):
    return match.home_team if match.home_score > match.away_score else match.away_team


def decisive(rng):
    hs, as_ = rng.randint(0, 3), rng.randint(0, 3)
    if hs == as_:
        hs += 1
    return hs, as_


# ── wipe ─────────────────────────────────────────────────────────────────────────

def wipe(db):
    hr("STEP 0 — WIPE & RESET (keep users / tournaments / group fixtures)")
    db.execute(text("DELETE FROM point_events"))
    db.execute(text("DELETE FROM predictions"))
    db.execute(text("DELETE FROM group_standings"))
    knockout = db.execute(text("DELETE FROM matches WHERE stage <> 'group_stage'"))
    db.execute(text(
        "UPDATE matches SET status='scheduled', home_score=NULL, away_score=NULL, minute=NULL "
        "WHERE stage='group_stage'"
    ))
    db.execute(text("UPDATE tournament_members SET total_points=0, provisional_points=0"))
    db.execute(text("UPDATE tournament_members SET joined_at=:j"), {"j": EARLY_JOIN})
    db.commit()
    print(f"Cleared predictions/point_events/standings; removed {knockout.rowcount} knockout matches; "
          "reset 72 group fixtures to scheduled; zeroed member points.")


# ── group results plan (real fixtures, search a seed with valid best-third match) ─

def plan_group_stage(groups, fixtures_by_group):
    third_slots = [
        e["slot_id"] for e in _BRACKET_TOPOLOGY
        if e["round"] == "round_of_32" and "Best 3rd" in (e["home_label"] + e["away_label"])
    ]
    slot_combo = {}
    for e in _BRACKET_TOPOLOGY:
        for label in (e["home_label"], e["away_label"]):
            m = re.match(r"Best 3rd \(([^)]+)\)", label)
            if m:
                slot_combo[e["slot_id"]] = set(m.group(1).split("/"))

    for seed in range(0, 1000):
        rng = random.Random(seed)
        group_scores = {}
        tables = {}
        for letter, fixtures in fixtures_by_group.items():
            scores = {(h, a): (rng.randint(0, 4), rng.randint(0, 4)) for (h, a) in fixtures}
            group_scores[letter] = scores
            tables[letter] = table_for(groups[letter], scores)

        thirds = []
        for letter, (ordered, stat) in tables.items():
            t = ordered[2]; s = stat[t]
            thirds.append((letter, t, s["pts"], s["gf"] - s["ga"], s["gf"]))
        thirds.sort(key=lambda x: (x[2], x[3], x[4]), reverse=True)
        qualifying = {row[0] for row in thirds[:8]}

        allowed = {s: slot_combo[s] & qualifying for s in third_slots}
        assignment = kuhn_matching(third_slots, allowed)
        if assignment is None:
            continue
        qualifiers = {
            "first": {l: tables[l][0][0] for l in groups},
            "second": {l: tables[l][0][1] for l in groups},
            "third": {l: tables[l][0][2] for l in groups},
            "third_groups": qualifying,
            "tables": tables,
        }
        return seed, group_scores, qualifiers, assignment
    raise RuntimeError("no seed yielded a valid best-third assignment")


# ── main ─────────────────────────────────────────────────────────────────────────

def main():
    db = Session()
    wipe(db)

    # Read the real group fixtures already in the DB.
    group_matches = (
        db.query(Match)
        .filter(Match.stage == "group_stage", Match.group.isnot(None))
        .order_by(Match.kickoff_at)
        .all()
    )
    groups, fixtures_by_group, match_by_pair = {}, {}, {}
    for m in group_matches:
        letter = m.group.replace("Group ", "").strip()
        groups.setdefault(letter, [])
        for t in (m.home_team, m.away_team):
            if t not in groups[letter]:
                groups[letter].append(t)
        fixtures_by_group.setdefault(letter, []).append((m.home_team, m.away_team))
        match_by_pair[(letter, m.home_team, m.away_team)] = m

    member_user_ids = [r[0] for r in db.execute(text("SELECT DISTINCT user_id FROM tournament_members")).all()]
    seed, group_scores, qualifiers, third_assignment = plan_group_stage(groups, fixtures_by_group)
    rng = random.Random(seed * 7 + 1)

    hr(f"SETUP  (seed={seed})")
    print(f"{len(groups)} groups · {len(member_user_ids)} member users · "
          f"{db.execute(text('SELECT count(*) FROM tournaments')).scalar()} tournaments")

    def add_predictions(match):
        for uid in member_user_ids:
            db.add(Prediction(id=uuid4(), user_id=uid, match_id=match.id,
                              predicted_home=rng.randint(0, 4), predicted_away=rng.randint(0, 4)))
        db.flush()

    # ── group stage ───────────────────────────────────────────────────────────────
    hr("STEP 1 — GROUP STAGE: randomized predictions, play every game")
    for m in group_matches:
        add_predictions(m)
    db.commit()
    print(f"Added {db.query(Prediction).count()} predictions across {len(group_matches)} group games. Playing...")

    for letter, fixtures in fixtures_by_group.items():
        for (h, a) in fixtures:
            m = match_by_pair[(letter, h, a)]
            hs, as_ = group_scores[letter][(h, a)]
            apply_match_result(db, m.id, hs, as_, status="finished")
    print(f"All group games finished. PointEvents: {db.query(PointEvent).count()}")

    for letter in sorted(groups):
        ordered, stat = qualifiers["tables"][letter]
        print(f"\nGroup {letter}:")
        for pos, t in enumerate(ordered, 1):
            s = stat[t]
            tag = {1: "  (1st ✓)", 2: "  (2nd ✓)",
                   3: ("  (3rd ✓)" if letter in qualifiers["third_groups"] else "  (3rd ✗)")}.get(pos, "")
            print(f"   {pos}. {t:<16} {s['pts']:>2} pts  GD {s['gf']-s['ga']:>+3}  GF {s['gf']:>2}{tag}")

    # ── qualifiers ─────────────────────────────────────────────────────────────────
    hr("STEP 2 — WHO QUALIFIES (verified before building the Round of 32)")
    firsts = [qualifiers["first"][l] for l in sorted(groups)]
    seconds = [qualifiers["second"][l] for l in sorted(groups)]
    thirds_q = [qualifiers["third"][l] for l in sorted(qualifiers["third_groups"])]
    print("Group winners:", ", ".join(firsts))
    print("Runners-up   :", ", ".join(seconds))
    print("Best thirds  :", ", ".join(thirds_q), f"[groups {','.join(sorted(qualifiers['third_groups']))}]")
    qualified = set(firsts) | set(seconds) | set(thirds_q)
    assert len(qualified) == 32, f"expected 32 qualifiers, got {len(qualified)}"
    print(f"Total qualified: {len(qualified)} ✓")

    # ── round of 32 (published as the API would) ────────────────────────────────────
    def resolve_label(label, slot_id):
        m1 = re.match(r"1st Group (\w+)", label)
        if m1:
            return qualifiers["first"][m1.group(1)]
        m2 = re.match(r"2nd Group (\w+)", label)
        if m2:
            return qualifiers["second"][m2.group(1)]
        if "Best 3rd" in label:
            return qualifiers["third"][third_assignment[slot_id]]
        raise ValueError(label)

    hr("STEP 3 — ROUND OF 32 published, then linked by the live bracket")
    r32_entries = [e for e in _BRACKET_TOPOLOGY if e["round"] == "round_of_32"]
    slot_to_match = {}
    base_ko = datetime(2026, 6, 29, 18, 0, tzinfo=timezone.utc)
    for offset, e in enumerate(r32_entries):
        sid = e["slot_id"]
        m = Match(id=uuid4(), external_match_id=f"SIM-{500000 + offset}",
                  home_team=resolve_label(e["home_label"], sid),
                  away_team=resolve_label(e["away_label"], sid),
                  kickoff_at=base_ko + timedelta(hours=offset),
                  stage="round_of_32", status="scheduled")
        db.add(m); db.flush()
        add_predictions(m)
        slot_to_match[sid] = m
    db.commit()

    slots = bracket_by_slot(db)
    for e in r32_entries:
        sid = e["slot_id"]; s = slots[sid]
        ok = s.match is not None and s.match.external_match_id == slot_to_match[sid].external_match_id
        print(f"  M{sid}  {s.match.home_team:<18} vs {s.match.away_team:<18}  {'✓' if ok else '✗ MISLINK'}")
        assert ok, f"slot {sid} not linked"
    print("All 16 R32 fixtures linked to the correct slots ✓")

    # ── knockout round by round ──────────────────────────────────────────────────────
    winner_by_slot = {}

    def play_round(round_name, create_from_feeders, kickoff):
        hr(f"STEP — {round_name.upper().replace('_', ' ')}")
        if create_from_feeders:
            for sid in ROUND_SLOTS[round_name]:
                adv = _ADVANCEMENT[sid]
                m = Match(id=uuid4(), external_match_id=f"SIM-{round_name}-{sid}",
                          home_team=winner_by_slot[adv["home"][0]],
                          away_team=winner_by_slot[adv["away"][0]],
                          kickoff_at=kickoff + timedelta(hours=sid),
                          stage=round_name, status="scheduled")
                db.add(m); db.flush()
                add_predictions(m)
                slot_to_match[sid] = m
            db.commit()
            slots_now = bracket_by_slot(db)
            for sid in ROUND_SLOTS[round_name]:
                adv = _ADVANCEMENT[sid]
                exp = {winner_by_slot[adv["home"][0]], winner_by_slot[adv["away"][0]]}
                got = {slots_now[sid].match.home_team, slots_now[sid].match.away_team}
                assert got == exp, f"slot {sid} linked {got} expected {exp}"

        for sid in ROUND_SLOTS[round_name]:
            m = slot_to_match[sid]
            hs, as_ = decisive(rng)
            apply_match_result(db, m.id, hs, as_, status="finished")
            db.refresh(m)
            winner_by_slot[sid] = winner_team(m)
            print(f"  M{sid}: {m.home_team:<16} {hs}-{as_} {m.away_team:<16} -> {winner_by_slot[sid]}")

        slots_after = bracket_by_slot(db)
        nexts = sorted(sid for sid, adv in _ADVANCEMENT.items() if adv["home"][0] in ROUND_SLOTS[round_name])
        if nexts:
            print("  -> next round now reads:")
            for sid in nexts:
                s = slots_after[sid]
                print(f"       M{sid}: {s.home_label} vs {s.away_label}")

    play_round("round_of_32", False, base_ko)
    play_round("round_of_16", True, datetime(2026, 7, 3, tzinfo=timezone.utc))
    play_round("quarter_finals", True, datetime(2026, 7, 9, tzinfo=timezone.utc))

    # ── semifinals: M101 finished, M102 LIVE ─────────────────────────────────────────
    hr("STEP — SEMIFINALS: finish M101, keep M102 LIVE")
    sf_kick = datetime(2026, 7, 14, tzinfo=timezone.utc)
    for sid in ROUND_SLOTS["semi_finals"]:
        adv = _ADVANCEMENT[sid]
        m = Match(id=uuid4(), external_match_id=f"SIM-semi-{sid}",
                  home_team=winner_by_slot[adv["home"][0]],
                  away_team=winner_by_slot[adv["away"][0]],
                  kickoff_at=sf_kick + timedelta(hours=sid),
                  stage="semi_finals", status="scheduled")
        db.add(m); db.flush()
        add_predictions(m)
        slot_to_match[sid] = m
    db.commit()

    m101 = slot_to_match[101]
    apply_match_result(db, m101.id, 2, 1, status="finished")
    db.refresh(m101)
    winner_by_slot[101] = winner_team(m101)
    print(f"  M101 FINISHED: {m101.home_team} 2-1 {m101.away_team} -> finalist {winner_by_slot[101]}")

    m102 = slot_to_match[102]
    m102.status = "live"; m102.home_score = 1; m102.away_score = 0; m102.minute = 67
    db.add(m102); db.commit()
    update_provisional_points(db)
    print(f"  M102 LIVE {m102.minute}': {m102.home_team} 1-0 {m102.away_team}")

    slots = bracket_by_slot(db)
    sf2 = slots[102]
    assert sf2.match and sf2.match.status == "live" and sf2.match.home_score == 1
    print("\nBracket endpoint now shows:")
    for sid in (101, 102, 104):
        s = slots[sid]
        if s.match:
            sc = f"{s.match.home_score}-{s.match.away_score}"
            extra = f"  ({s.match.minute}')" if s.match.status == "live" and s.match.minute else ""
            print(f"  M{sid} [{s.match.status:<8}] {s.match.home_team} {sc} {s.match.away_team}{extra}")
        else:
            print(f"  M{sid} [pending ] {s.home_label} vs {s.away_label}")
    assert slots[104].home_label == winner_by_slot[101]
    assert slots[104].away_label == "Winner M102"
    print("  -> Final shows decided finalist at home; away still 'Winner M102' (live) ✓")

    # ── leaderboards (both tournaments) ──────────────────────────────────────────────
    db.expire_all()
    hr("LEADERBOARDS (confirmed total + live provisional from M102)")
    rows = db.execute(text(
        "SELECT t.name, u.username, m.total_points, m.provisional_points "
        "FROM tournament_members m JOIN tournaments t ON t.id=m.tournament_id "
        "JOIN users u ON u.id=m.user_id ORDER BY t.name, m.total_points DESC"
    )).all()
    cur = None
    for name, uname, tot, prov in rows:
        if name != cur:
            print(f"\n[{name}]"); cur = name
        print(f"  {uname:<12} total={tot:<5} provisional(live)={prov}")

    print("\nDONE — open the app: group stage scored, bracket through SF, one live semifinal.")
    db.close()


if __name__ == "__main__":
    main()
