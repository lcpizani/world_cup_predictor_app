"""Regression tests for bracket slot mapping.

football-data.org assigns knockout match external IDs in an internal order that
is neither chronological nor FIFA bracket order (verified against live WC 2026
API data: IDs 537415-537430 for R32 do not follow slot 73→88 sequence).

R32 slots are therefore filled by team-name matching driven by group standings
(same mechanism as R16+), not by ascending external ID. Tests in this file
confirm that the bracket remains correct regardless of ID ordering.

Real WC 2026 external IDs for reference:
  R32: 537415-537430 (chronological order ≠ bracket order)
  R16: 537375-537382
  QF:  537383-537386
"""
from datetime import datetime, timezone

from app.models.group_standing import GroupStanding
from app.models.match import Match
from tests.helpers import auth_headers, login_user, register_user

_SYNCED_AT = datetime(2026, 6, 25, tzinfo=timezone.utc)


# ── helpers ──────────────────────────────────────────────────────────────────

def _match(db, ext_id, stage, home, away, status="finished", hs=2, as_=1,
           kickoff=None):
    if kickoff is None:
        kickoff = datetime(2026, 7, 1, 18, 0, tzinfo=timezone.utc)
    m = Match(
        external_match_id=str(ext_id),
        home_team=home,
        away_team=away,
        kickoff_at=kickoff,
        stage=stage,
        status=status,
        home_score=hs if status == "finished" else None,
        away_score=as_ if status == "finished" else None,
    )
    db.add(m)
    return m


def _standing(db, group, position, team, pts=3, gd=1, gf=2):
    """Add a GroupStanding row. group should be like 'GROUP_A'."""
    s = GroupStanding(
        group=group, position=position, team_name=team,
        played=3, won=1, drawn=0, lost=2,
        goals_for=gf, goals_against=gf - gd, goal_difference=gd,
        points=pts, synced_at=_SYNCED_AT,
    )
    db.add(s)
    return s


def _token(client):
    register_user(client, "br@test.com", "bruser", "pass1234")
    return login_user(client, "br@test.com", "pass1234")


def _minimal_standings(db):
    """Create standings for all 12 groups using simple team names (X1/X2/X3).

    Best-3rd ranking (pts desc): A3(5)>B3(4)>C3(3)>D3(2) etc. so each
    'Best 3rd' slot's eligible set has a clear winner.
    """
    groups = "ABCDEFGHIJKL"
    for i, g in enumerate(groups):
        _standing(db, f"GROUP_{g}", 1, f"{g}1", pts=9, gd=6, gf=8)
        _standing(db, f"GROUP_{g}", 2, f"{g}2", pts=6, gd=2, gf=5)
        # 3rd-place pts descend A→L so we can always pick the "best" predictably
        _standing(db, f"GROUP_{g}", 3, f"{g}3", pts=5 - i // 2, gd=1, gf=3)
        _standing(db, f"GROUP_{g}", 4, f"{g}4", pts=0, gd=-9, gf=0)


# ── R32: no standings → placeholder labels ────────────────────────────────────

def test_r32_no_standings_shows_placeholder_labels(client, db):
    # R32 fixtures exist but group stage has no standings yet.
    # Every R32 slot should show its original label (no team linked).
    _match(db, 999, "round_of_32", "SomeTeam", "AnotherTeam")
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    assert resp.status_code == 200, resp.text
    by_slot = {s["slot_id"]: s for s in resp.json()}

    for slot_id in range(73, 89):
        slot = by_slot[slot_id]
        assert slot["match"] is None, f"slot {slot_id} should be unlinked without standings"


# ── R32: team-name matching ignores ID order ──────────────────────────────────

def test_r32_maps_to_slots_by_team_name_not_id_order(client, db):
    """Core fix: R32 fixtures with IDs interleaved (lower ID ≠ lower slot)
    must still land in the correct bracket slot via team-name matching."""
    _minimal_standings(db)

    # M73 = 2nd Group A vs 2nd Group B  (home=A2, away=B2)
    # M75 = 1st Group F vs 2nd Group C  (home=F1, away=C2)
    # M76 = 1st Group C vs 2nd Group F  (home=C1, away=F2)
    # M78 = 2nd Group E vs 2nd Group I  (home=E2, away=I2)
    #
    # Give them IDs that sort OPPOSITE to bracket order:
    #   M76 → ID 100 (lowest, would have gone to slot 73 under old positional logic)
    #   M78 → ID 101
    #   M75 → ID 102
    #   M73 → ID 103 (highest, would have gone to slot 76 under old logic)
    _match(db, 103, "round_of_32", "A2", "B2")   # M73
    _match(db, 102, "round_of_32", "F1", "C2")   # M75
    _match(db, 100, "round_of_32", "C1", "F2")   # M76
    _match(db, 101, "round_of_32", "E2", "I2")   # M78
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    assert resp.status_code == 200, resp.text
    by_slot = {s["slot_id"]: s for s in resp.json()}

    assert by_slot[73]["match"]["external_match_id"] == "103", "M73 should get ID 103 (A2 vs B2)"
    assert by_slot[75]["match"]["external_match_id"] == "102", "M75 should get ID 102 (F1 vs C2)"
    assert by_slot[76]["match"]["external_match_id"] == "100", "M76 should get ID 100 (C1 vs F2)"
    assert by_slot[78]["match"]["external_match_id"] == "101", "M78 should get ID 101 (E2 vs I2)"


def test_r32_best_third_slot_links_by_first_place_team(client, db):
    """Best-3rd slots: the 1st-place team is deterministic; the fixture
    is found by matching that team alone (Best 3rd is ambiguous until
    FIFA finalises the draw, but 1st place is unique per R32 match)."""
    _minimal_standings(db)

    # M74 = 1st Group E vs Best 3rd (A/B/C/D/F)
    # A3 has pts=5 (best among ABCDF), so resolver returns A3 for the
    # Best 3rd side. But even if that fails, E1 is sufficient to find the match.
    # Use ID 999 — deliberately far from any bracket slot number.
    _match(db, 999, "round_of_32", "E1", "A3")   # M74
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    by_slot = {s["slot_id"]: s for s in resp.json()}

    slot74 = by_slot[74]
    assert slot74["match"] is not None, "M74 should be linked"
    assert slot74["match"]["external_match_id"] == "999"
    assert {slot74["home_label"], slot74["away_label"]} == {"E1", "A3"}


# ── R32: Best 3rd resolver picks highest-ranked eligible team ─────────────────

def test_r32_best_third_label_resolves_to_highest_ranked(client, db):
    """'Best 3rd (A/B/C/D/F)' resolves to the 3rd-place team with the best
    (points, goal_difference, goals_for) among groups A, B, C, D, F."""
    # Make C3 the winner among A/B/C/D/F: give it pts=7 while others have pts≤5
    for g in "ABCDEFGHIJKL":
        _standing(db, f"GROUP_{g}", 1, f"{g}1", pts=9)
        _standing(db, f"GROUP_{g}", 2, f"{g}2", pts=6)
        _standing(db, f"GROUP_{g}", 4, f"{g}4", pts=0)
    # Default: all 3rds have pts=3
    for g in "ABCDEFGHIJKL":
        _standing(db, f"GROUP_{g}", 3, f"{g}3", pts=3, gd=0, gf=2)
    # Override: C3 dominates group A/B/C/D/F
    # (We need to re-add C3 with higher pts — use a fresh standing)
    db.flush()
    db.execute(
        __import__("sqlalchemy").text(
            "UPDATE group_standings SET points=7, goal_difference=5, goals_for=8 "
            "WHERE \"group\"='GROUP_C' AND position=3"
        )
    )
    db.commit()

    # Create a fixture for M74 (1st Group E vs Best 3rd ABCDF)
    # The resolver should return C3 as the Best 3rd side.
    _match(db, 500, "round_of_32", "E1", "C3")
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    by_slot = {s["slot_id"]: s for s in resp.json()}

    slot74 = by_slot[74]
    assert slot74["match"] is not None
    teams = {slot74["home_label"], slot74["away_label"]}
    assert "C3" in teams, f"C3 should be the Best 3rd ABCDF winner; got {teams}"


# ── R16: resolution from R32 winners ─────────────────────────────────────────

def test_round_of_16_slot_resolves_from_r32_winners(client, db):
    """R16 slots resolve to the actual winners of their R32 feeder matches.

    Slot 89 = Winner M74 vs Winner M77.
    Slot 90 = Winner M73 vs Winner M75.

    R32 fixtures use real team names from standings; IDs are deliberately
    interleaved to prove ID order is not used.
    """
    _minimal_standings(db)

    # Best 3rd for ABCDF: A3 (pts=5 from _minimal_standings, highest among ABCDF).
    # Best 3rd for CDFGH: C3 (pts=4, highest among those groups given our pts ladder).

    # Create 4 R32 fixtures with interleaved IDs (lower ID ≠ lower slot):
    #   M73 (2A vs 2B): ID=200  →  A2 home wins → winner = A2
    #   M74 (1E vs 3rdABCDF=A3): ID=100  →  E1 home wins → winner = E1
    #   M75 (1F vs 2C): ID=300  →  F1 home wins → winner = F1
    #   M77 (1I vs 3rdCDFGH=C3): ID=150  →  I1 home wins → winner = I1
    _match(db, 200, "round_of_32", "A2", "B2", hs=3, as_=0)   # M73 → winner A2
    _match(db, 100, "round_of_32", "E1", "A3", hs=3, as_=0)   # M74 → winner E1
    _match(db, 300, "round_of_32", "F1", "C2", hs=3, as_=0)   # M75 → winner F1
    _match(db, 150, "round_of_32", "I1", "C3", hs=3, as_=0)   # M77 → winner I1
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    by_slot = {s["slot_id"]: s for s in resp.json()}

    # Verify R32 slots were linked correctly (team-name, not ID order)
    assert by_slot[73]["match"]["external_match_id"] == "200"
    assert by_slot[74]["match"]["external_match_id"] == "100"
    assert by_slot[75]["match"]["external_match_id"] == "300"
    assert by_slot[77]["match"]["external_match_id"] == "150"

    slot89 = by_slot[89]
    assert slot89["match"] is None   # R16 fixture not in DB yet
    assert slot89["home_label"] == "E1", slot89["home_label"]  # Winner M74
    assert slot89["away_label"] == "I1", slot89["away_label"]  # Winner M77

    slot90 = by_slot[90]
    assert slot90["match"] is None
    assert slot90["home_label"] == "A2", slot90["home_label"]  # Winner M73
    assert slot90["away_label"] == "F1", slot90["away_label"]  # Winner M75


def test_round_of_16_fixtures_link_by_teams_not_position(client, db):
    """R16 fixtures added out of FIFA order must land in the correct slot via
    team-name matching, not positional ID zip. Carry live scores through."""
    _minimal_standings(db)

    # Same 4 R32 fixtures as above (interleaved IDs, home always wins)
    _match(db, 200, "round_of_32", "A2", "B2", hs=2, as_=0)   # M73 → A2
    _match(db, 100, "round_of_32", "E1", "A3", hs=2, as_=0)   # M74 → E1
    _match(db, 300, "round_of_32", "F1", "C2", hs=2, as_=0)   # M75 → F1
    _match(db, 400, "round_of_32", "C1", "F2", hs=2, as_=0)   # M76 → C1
    _match(db, 500, "round_of_32", "I1", "C3", hs=2, as_=0)   # M77 → I1  (Best 3rd CDFGH)
    _match(db, 600, "round_of_32", "E2", "I2", hs=2, as_=0)   # M78 → E2

    # Slot 89 = Winner M74 (E1) vs Winner M77 (I1)
    # Slot 91 = Winner M76 (C1) vs Winner M78 (E2)
    # Add these two R16 fixtures out-of-order (slot 91 added first):
    _match(db, 537377, "round_of_16", "C1", "E2", status="live", hs=1, as_=0)  # slot 91
    _match(db, 537375, "round_of_16", "E1", "I1", status="live", hs=2, as_=1)  # slot 89
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    by_slot = {s["slot_id"]: s for s in resp.json()}

    slot89 = by_slot[89]
    assert slot89["match"] is not None, "slot 89 fixture not linked"
    assert slot89["match"]["external_match_id"] == "537375"
    assert slot89["match"]["status"] == "live"

    slot91 = by_slot[91]
    assert slot91["match"] is not None, "slot 91 fixture not linked"
    assert slot91["match"]["external_match_id"] == "537377"

    # Slots 90/92 have no fixture yet — must stay unlinked
    assert by_slot[90]["match"] is None
    assert by_slot[92]["match"] is None


# ── QF: still resolves from R16 winners (unchanged) ──────────────────────────

def test_quarter_final_resolves_from_round_of_16_winners(client, db):
    # R16 played (ids 537375-537382 -> slots 89-96 by ascending order), home wins.
    # QF slot 98 = Winner M93 vs Winner M94 -> must resolve to those R16 winners.
    for ext_id in range(537375, 537383):
        _match(db, ext_id, "round_of_16", f"H{ext_id}", f"A{ext_id}", hs=2, as_=0)
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    by_slot = {s["slot_id"]: s for s in resp.json()}

    # Slots 89..96 map to ids 537375..537382 (ascending within R16 → correct).
    # M93 → 537379, M94 → 537380.
    slot98 = by_slot[98]
    assert slot98["match"] is None
    assert slot98["home_label"] == "H537379", slot98["home_label"]
    assert slot98["away_label"] == "H537380", slot98["away_label"]


def test_quarter_finals_map_to_slots_97_100_not_by_raw_id(client, db):
    # QF ids 537383-537386 must land in slots 97-100 via the positional fallback
    # (no R16 feeder results in DB, so team-name matching produces None for all).
    for ext_id in range(537383, 537387):
        _match(db, ext_id, "quarter_finals", f"H{ext_id}", f"A{ext_id}",
               status="scheduled")
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    by_slot = {s["slot_id"]: s for s in resp.json()}

    for offset, ext_id in enumerate(range(537383, 537387)):
        slot = by_slot[97 + offset]
        assert slot["match"] is not None, f"slot {97+offset} unattached"
        assert slot["match"]["external_match_id"] == str(ext_id)
