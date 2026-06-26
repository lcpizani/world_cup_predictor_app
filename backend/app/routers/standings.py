import re
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.group_standing import GroupStanding
from app.models.match import Match
from app.schemas.standings import BracketSlot, GroupData, GroupStandingRow, LiveMatchBadge
from app.schemas.match import MatchResponse

router = APIRouter()

# 2026 FIFA World Cup knockout bracket.
# Source: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage
#
# Bracket tree (top → bottom = top half → bottom half of the draw):
#
#  M101 (SF1) ──┬── M97 (QF1) ──┬── M89 (R16) ──┬── M74  1E vs 3rd ABCDF
#               │               │               └── M77  1I vs 3rd CDFGH
#               │               └── M90 (R16) ──┬── M73  2A vs 2B
#               │                               └── M75  1F vs 2C
#               └── M98 (QF2) ──┬── M93 (R16) ──┬── M83  2K vs 2L
#                               │               └── M84  1H vs 2J
#                               └── M94 (R16) ──┬── M81  1D vs 3rd BEFIJ
#                                               └── M82  1G vs 3rd AEHIJ
#
#  M102 (SF2) ──┬── M99 (QF3) ──┬── M91 (R16) ──┬── M76  1C vs 2F
#               │               │               └── M78  2E vs 2I
#               │               └── M92 (R16) ──┬── M79  1A vs 3rd CEFHI
#               │                               └── M80  1L vs 3rd EHIJK
#               └── M100 (QF4) ─┬── M95 (R16) ──┬── M86  1J vs 2H
#                               │               └── M88  2D vs 2G
#                               └── M96 (R16) ──┬── M85  1B vs 3rd EFGIJ
#                                               └── M87  1K vs 3rd DEIJL
#
#  M103 (3rd place): Loser M101 vs Loser M102
#  M104 (Final):     Winner M101 vs Winner M102

_BRACKET_TOPOLOGY = [
    # ── Round of 32 ─────────────────────────────────────────────────────────
    # Listed in match-number order (M73–M88); display order is in BRACKET_SLOT_ORDER on the frontend.
    {"slot_id": 73,  "round": "round_of_32", "home_label": "2nd Group A",  "away_label": "2nd Group B"},
    {"slot_id": 74,  "round": "round_of_32", "home_label": "1st Group E",  "away_label": "Best 3rd (A/B/C/D/F)"},
    {"slot_id": 75,  "round": "round_of_32", "home_label": "1st Group F",  "away_label": "2nd Group C"},
    {"slot_id": 76,  "round": "round_of_32", "home_label": "1st Group C",  "away_label": "2nd Group F"},
    {"slot_id": 77,  "round": "round_of_32", "home_label": "1st Group I",  "away_label": "Best 3rd (C/D/F/G/H)"},
    {"slot_id": 78,  "round": "round_of_32", "home_label": "2nd Group E",  "away_label": "2nd Group I"},
    {"slot_id": 79,  "round": "round_of_32", "home_label": "1st Group A",  "away_label": "Best 3rd (C/E/F/H/I)"},
    {"slot_id": 80,  "round": "round_of_32", "home_label": "1st Group L",  "away_label": "Best 3rd (E/H/I/J/K)"},
    {"slot_id": 81,  "round": "round_of_32", "home_label": "1st Group D",  "away_label": "Best 3rd (B/E/F/I/J)"},
    {"slot_id": 82,  "round": "round_of_32", "home_label": "1st Group G",  "away_label": "Best 3rd (A/E/H/I/J)"},
    {"slot_id": 83,  "round": "round_of_32", "home_label": "2nd Group K",  "away_label": "2nd Group L"},
    {"slot_id": 84,  "round": "round_of_32", "home_label": "1st Group H",  "away_label": "2nd Group J"},
    {"slot_id": 85,  "round": "round_of_32", "home_label": "1st Group B",  "away_label": "Best 3rd (E/F/G/I/J)"},
    {"slot_id": 86,  "round": "round_of_32", "home_label": "1st Group J",  "away_label": "2nd Group H"},
    {"slot_id": 87,  "round": "round_of_32", "home_label": "1st Group K",  "away_label": "Best 3rd (D/E/I/J/L)"},
    {"slot_id": 88,  "round": "round_of_32", "home_label": "2nd Group D",  "away_label": "2nd Group G"},
    # ── Round of 16 ─────────────────────────────────────────────────────────
    {"slot_id": 89,  "round": "round_of_16", "home_label": "Winner M74",   "away_label": "Winner M77"},
    {"slot_id": 90,  "round": "round_of_16", "home_label": "Winner M73",   "away_label": "Winner M75"},
    {"slot_id": 91,  "round": "round_of_16", "home_label": "Winner M76",   "away_label": "Winner M78"},
    {"slot_id": 92,  "round": "round_of_16", "home_label": "Winner M79",   "away_label": "Winner M80"},
    {"slot_id": 93,  "round": "round_of_16", "home_label": "Winner M83",   "away_label": "Winner M84"},
    {"slot_id": 94,  "round": "round_of_16", "home_label": "Winner M81",   "away_label": "Winner M82"},
    {"slot_id": 95,  "round": "round_of_16", "home_label": "Winner M86",   "away_label": "Winner M88"},
    {"slot_id": 96,  "round": "round_of_16", "home_label": "Winner M85",   "away_label": "Winner M87"},
    # ── Quarter-finals ──────────────────────────────────────────────────────
    {"slot_id": 97,  "round": "quarter_finals", "home_label": "Winner M89", "away_label": "Winner M90"},
    {"slot_id": 98,  "round": "quarter_finals", "home_label": "Winner M93", "away_label": "Winner M94"},
    {"slot_id": 99,  "round": "quarter_finals", "home_label": "Winner M91", "away_label": "Winner M92"},
    {"slot_id": 100, "round": "quarter_finals", "home_label": "Winner M95", "away_label": "Winner M96"},
    # ── Semi-finals ─────────────────────────────────────────────────────────
    {"slot_id": 101, "round": "semi_finals",    "home_label": "Winner M97", "away_label": "Winner M98"},
    {"slot_id": 102, "round": "semi_finals",    "home_label": "Winner M99", "away_label": "Winner M100"},
    # ── Third place ─────────────────────────────────────────────────────────
    {"slot_id": 103, "round": "third_place",    "home_label": "Loser M101", "away_label": "Loser M102"},
    # ── Final ────────────────────────────────────────────────────────────────
    {"slot_id": 104, "round": "final",          "home_label": "Winner M101", "away_label": "Winner M102"},
]

# For each slot, maps home/away to the (feeder_slot_id, "winner"|"loser") that fills it.
# Read directly from the bracket tree above.
_ADVANCEMENT: dict[int, dict[str, tuple[int, str]]] = {
    # ── R16: which two R32 winners meet ──────────────────────────────────────
    89:  {"home": (74,  "winner"), "away": (77,  "winner")},  # M89 = W74 vs W77
    90:  {"home": (73,  "winner"), "away": (75,  "winner")},  # M90 = W73 vs W75
    91:  {"home": (76,  "winner"), "away": (78,  "winner")},  # M91 = W76 vs W78
    92:  {"home": (79,  "winner"), "away": (80,  "winner")},  # M92 = W79 vs W80
    93:  {"home": (83,  "winner"), "away": (84,  "winner")},  # M93 = W83 vs W84
    94:  {"home": (81,  "winner"), "away": (82,  "winner")},  # M94 = W81 vs W82
    95:  {"home": (86,  "winner"), "away": (88,  "winner")},  # M95 = W86 vs W88
    96:  {"home": (85,  "winner"), "away": (87,  "winner")},  # M96 = W85 vs W87
    # ── QF: which two R16 winners meet ───────────────────────────────────────
    97:  {"home": (89,  "winner"), "away": (90,  "winner")},  # M97 = W89 vs W90
    98:  {"home": (93,  "winner"), "away": (94,  "winner")},  # M98 = W93 vs W94
    99:  {"home": (91,  "winner"), "away": (92,  "winner")},  # M99 = W91 vs W92
    100: {"home": (95,  "winner"), "away": (96,  "winner")},  # M100 = W95 vs W96
    # ── SF: which two QF winners meet ────────────────────────────────────────
    101: {"home": (97,  "winner"), "away": (98,  "winner")},  # M101 = W97 vs W98
    102: {"home": (99,  "winner"), "away": (100, "winner")},  # M102 = W99 vs W100
    # ── 3rd place & Final ────────────────────────────────────────────────────
    103: {"home": (101, "loser"),  "away": (102, "loser")},   # M103 = L101 vs L102
    104: {"home": (101, "winner"), "away": (102, "winner")},  # M104 = W101 vs W102
}

_TOPOLOGY_BY_SLOT: dict[int, dict] = {e["slot_id"]: e for e in _BRACKET_TOPOLOGY}

_STAGE_TO_ROUND = {
    "round_of_32": "round_of_32",
    "round_of_16": "round_of_16",
    "quarter_finals": "quarter_finals",
    "semi_finals": "semi_finals",
    "third_place": "third_place",
    "final": "final",
}

# The FIFA match numbers (slot_ids) belonging to each round, in bracket order.
# Derived from the topology so the two never drift apart.
_ROUND_SLOT_IDS: dict[str, list[int]] = {}
for _entry in _BRACKET_TOPOLOGY:
    _ROUND_SLOT_IDS.setdefault(_entry["round"], []).append(_entry["slot_id"])


def _match_order_key(match: Match) -> tuple[int, int]:
    """Sort key for the positional fallback only (last resort for unresolvable fixtures).

    football-data.org assigns external IDs in an internal order unrelated to bracket
    position or kickoff time — do not rely on this ordering for R32 or any other round.
    Matches without a numeric external ID sort last but stay deterministic.
    """
    try:
        return (0, int(match.external_match_id))
    except (TypeError, ValueError):
        return (1, 0)


def _winner_of(match: Match) -> str | None:
    if match.status != "finished" or match.home_score is None or match.away_score is None:
        return None
    if match.home_score > match.away_score:
        return match.home_team
    if match.away_score > match.home_score:
        return match.away_team
    # Scores equal after 90/120 min — check penalty shootout
    if match.home_score_penalties is not None and match.away_score_penalties is not None:
        if match.home_score_penalties > match.away_score_penalties:
            return match.home_team
        if match.away_score_penalties > match.home_score_penalties:
            return match.away_team
    return None


def _loser_of(match: Match) -> str | None:
    if match.status != "finished" or match.home_score is None or match.away_score is None:
        return None
    if match.home_score > match.away_score:
        return match.away_team
    if match.away_score > match.home_score:
        return match.home_team
    # Scores equal after 90/120 min — check penalty shootout
    if match.home_score_penalties is not None and match.away_score_penalties is not None:
        if match.home_score_penalties > match.away_score_penalties:
            return match.away_team
        if match.away_score_penalties > match.home_score_penalties:
            return match.home_team
    return None


def _resolve_label(slot_id: int, side: str, knockout_by_slot: dict[int, Match]) -> str | None:
    advancement = _ADVANCEMENT.get(slot_id)
    if not advancement:
        return None
    feeder_slot_id, role = advancement[side]
    feeder_match = knockout_by_slot.get(feeder_slot_id)
    if feeder_match is None:
        return None
    if role == "winner":
        return _winner_of(feeder_match)
    return _loser_of(feeder_match)


def _resolve_r32_label(label: str, standings_by_group: dict[str, dict[int, tuple[str, int, int, int]]]) -> str | None:
    """Resolve a bracket topology label to a real team name using group standings.

    standings_by_group: {group_key: {position: (team_name, points, goal_diff, goals_for)}}
    group_key uses the GroupStanding format: "GROUP_A", "GROUP_E", etc.

    Returns None if the standings don't have enough data to resolve.
    """
    m1 = re.match(r"^1st Group (\w+)$", label)
    if m1:
        key = f"GROUP_{m1.group(1).upper()}"
        row = standings_by_group.get(key, {}).get(1)
        return row[0] if row else None

    m2 = re.match(r"^2nd Group (\w+)$", label)
    if m2:
        key = f"GROUP_{m2.group(1).upper()}"
        row = standings_by_group.get(key, {}).get(2)
        return row[0] if row else None

    m3 = re.match(r"^Best 3rd \(([^)]+)\)$", label)
    if m3:
        eligible = {g.strip().upper() for g in m3.group(1).split("/")}
        candidates = []
        for g in eligible:
            key = f"GROUP_{g}"
            row = standings_by_group.get(key, {}).get(3)
            if row:
                candidates.append(row)  # (team_name, points, goal_diff, goals_for)
        if not candidates:
            return None
        best = max(candidates, key=lambda r: (r[1], r[2], r[3]))
        return best[0]

    return None


def _standings_from_matches(db: Session) -> list[GroupData]:
    """Derive zero-stat standings from group-stage fixtures when no sync has run yet."""
    group_stage_matches = (
        db.query(Match)
        .filter(Match.stage == "group_stage", Match.group.isnot(None))
        .all()
    )

    teams_by_group: dict[str, set[str]] = {}
    for match in group_stage_matches:
        group_key = match.group.replace("Group ", "GROUP_").replace(" ", "_").upper()  # type: ignore[union-attr]
        if group_key not in teams_by_group:
            teams_by_group[group_key] = set()
        teams_by_group[group_key].add(match.home_team)
        teams_by_group[group_key].add(match.away_team)

    result: list[GroupData] = []
    for group_key in sorted(teams_by_group):
        teams = sorted(teams_by_group[group_key])
        standings = [
            GroupStandingRow(
                position=pos,
                team_name=name,
                group=group_key,
                played=0, won=0, drawn=0, lost=0,
                goals_for=0, goals_against=0, goal_difference=0, points=0,
            )
            for pos, name in enumerate(teams, start=1)
        ]
        result.append(GroupData(group=group_key, standings=standings))

    return result


def _attach_live_badges(groups: dict[str, list[GroupStandingRow]], db: Session) -> None:
    """Stamp live_match badges onto standing rows for teams currently playing."""
    live_matches = (
        db.query(Match)
        .filter(
            Match.status.in_(("live", "halftime")),
            Match.stage == "group_stage",
            Match.home_score.isnot(None),
            Match.away_score.isnot(None),
            Match.group.isnot(None),
        )
        .all()
    )
    if not live_matches:
        return

    badges: dict[str, LiveMatchBadge] = {}
    for match in live_matches:
        hs, as_ = match.home_score, match.away_score
        if hs > as_:
            home_result, away_result = "W", "L"
        elif hs < as_:
            home_result, away_result = "L", "W"
        else:
            home_result = away_result = "D"
        badges[match.home_team] = LiveMatchBadge(team_score=hs, opp_score=as_, result=home_result)
        badges[match.away_team] = LiveMatchBadge(team_score=as_, opp_score=hs, result=away_result)

    for rows in groups.values():
        for i, row in enumerate(rows):
            if row.team_name in badges:
                rows[i] = row.model_copy(update={"live_match": badges[row.team_name]})


@router.get("", response_model=List[GroupData])
def get_standings(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = (
        db.query(GroupStanding)
        .order_by(GroupStanding.group, GroupStanding.position)
        .all()
    )

    if rows:
        groups: dict[str, list[GroupStandingRow]] = {}
        for row in rows:
            if row.group not in groups:
                groups[row.group] = []
            groups[row.group].append(GroupStandingRow.model_validate(row))

        # Fill in groups that have fixtures but no standings rows yet (e.g. only
        # some groups have played — recalculate only writes rows for played groups).
        for fallback in _standings_from_matches(db):
            if fallback.group not in groups:
                groups[fallback.group] = fallback.standings

        _attach_live_badges(groups, db)

        return [
            GroupData(group=group, standings=standings)
            for group, standings in sorted(groups.items())
        ]

    # No standings synced at all yet — derive all groups from fixtures
    return _standings_from_matches(db)


@router.get("/bracket", response_model=List[BracketSlot])
def get_bracket(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    knockout_by_slot: dict[int, Match] = {}

    # Build standings lookup for R32 label resolution.
    # {group_key: {position: (team_name, points, goal_diff, goals_for)}}
    standings_rows = db.query(GroupStanding).all()
    standings_by_group: dict[str, dict[int, tuple[str, int, int, int]]] = {}
    for row in standings_rows:
        standings_by_group.setdefault(row.group, {})[row.position] = (
            row.team_name,
            row.points,
            row.goal_difference,
            row.goals_for,
        )

    knockout_matches = (
        db.query(Match)
        .filter(Match.stage.in_(list(_STAGE_TO_ROUND.keys())))
        .all()
    )
    # Link each stage's fixtures to its bracket slots. Rounds are processed in
    # dependency order (R32 first) so a round's feeder results are already linked
    # when we resolve the teams that have advanced into it.
    for round_name, slot_ids in _ROUND_SLOT_IDS.items():
        remaining = sorted(
            (m for m in knockout_matches if m.stage == round_name),
            key=_match_order_key,
        )

        # Primary link: attach a fixture to the slot whose teams are known.
        # For R16+: resolve via feeder-slot winners (_resolve_label).
        # For R32: resolve via group standings (_resolve_r32_label).
        # football-data.org assigns IDs in an internal order unrelated to
        # bracket position, so team-name matching is the only reliable approach.
        for slot_id in slot_ids:
            entry = _TOPOLOGY_BY_SLOT[slot_id]
            if round_name == "round_of_32":
                home_label = entry["home_label"]
                away_label = entry["away_label"]
                home_is_best_3rd = home_label.startswith("Best 3rd")
                away_is_best_3rd = away_label.startswith("Best 3rd")

                if home_is_best_3rd or away_is_best_3rd:
                    # "Best 3rd" assignment depends on FIFA's draw matching algorithm,
                    # not just standings rank. Match by the deterministic side (1st/2nd
                    # place) only — each 1st-place team appears in exactly one R32 match.
                    det_label = away_label if home_is_best_3rd else home_label
                    det_team = _resolve_r32_label(det_label, standings_by_group)
                    if det_team is None:
                        continue
                    for match in remaining:
                        if det_team in {match.home_team, match.away_team}:
                            knockout_by_slot[slot_id] = match
                            remaining.remove(match)
                            break
                else:
                    # Both sides fully deterministic (1st/2nd place).
                    # Primary: require exact match on both known teams.
                    # Fallback: if one side is "TBD" (team not decided yet by API),
                    # match by the single known side — each team appears in exactly
                    # one R32 fixture so this is unambiguous.
                    home = _resolve_r32_label(home_label, standings_by_group)
                    away = _resolve_r32_label(away_label, standings_by_group)
                    if home is None or away is None:
                        continue
                    for match in remaining:
                        match_teams = {match.home_team, match.away_team}
                        if match_teams == {home, away}:
                            knockout_by_slot[slot_id] = match
                            remaining.remove(match)
                            break
                        if "TBD" in match_teams and (home in match_teams or away in match_teams):
                            knockout_by_slot[slot_id] = match
                            remaining.remove(match)
                            break
            else:
                home = _resolve_label(slot_id, "home", knockout_by_slot)
                away = _resolve_label(slot_id, "away", knockout_by_slot)
                if home is None or away is None:
                    continue
                for match in remaining:
                    if {match.home_team, match.away_team} == {home, away}:
                        knockout_by_slot[slot_id] = match
                        remaining.remove(match)
                        break

        # Fallback: fixtures not resolved by team names fill remaining empty slots
        # by ascending external-ID order. Only applies to R16+ — for R32 every
        # fixture must match a known team; positional assignment would be wrong.
        if round_name != "round_of_32":
            empty_slots = [s for s in slot_ids if s not in knockout_by_slot]
            for slot_id, match in zip(empty_slots, remaining):
                knockout_by_slot[slot_id] = match

    slots: list[BracketSlot] = []
    for entry in _BRACKET_TOPOLOGY:
        slot_id = entry["slot_id"]
        match = knockout_by_slot.get(slot_id)

        if match:
            # Replace "TBD" placeholders with the topology label so the frontend
            # can show "Germany vs Best 3rd (C/D/F/G/H)" instead of "Germany vs TBD".
            home_label = match.home_team if match.home_team != "TBD" else entry["home_label"]
            away_label = match.away_team if match.away_team != "TBD" else entry["away_label"]
        else:
            resolved_home = _resolve_label(slot_id, "home", knockout_by_slot)
            resolved_away = _resolve_label(slot_id, "away", knockout_by_slot)
            home_label = resolved_home if resolved_home is not None else entry["home_label"]
            away_label = resolved_away if resolved_away is not None else entry["away_label"]

        slots.append(BracketSlot(
            slot_id=slot_id,
            round=entry["round"],
            home_label=home_label,
            away_label=away_label,
            match=MatchResponse.model_validate(match) if match else None,
        ))

    return slots
