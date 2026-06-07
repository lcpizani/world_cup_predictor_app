"""Regression tests for bracket slot mapping.

football-data.org assigns knockout matches external IDs that are NOT the FIFA
match numbers (73-104) the bracket topology uses — they are large, and their
*absolute* value is meaningless, but their ascending order *within a stage*
matches the bracket order. The bracket must therefore assign matches to slots by
per-stage id order, not by `int(external_match_id) == slot_id`.

These IDs mirror the real WC 2026 feed (R32: 537415-537430, R16: 537375-537382,
QF: 537383-537386).
"""
from datetime import datetime, timezone

from app.models.match import Match
from tests.helpers import auth_headers, login_user, register_user


def _match(db, ext_id, stage, home, away, status="finished", hs=2, as_=1):
    m = Match(
        external_match_id=str(ext_id),
        home_team=home,
        away_team=away,
        kickoff_at=datetime(2026, 7, 1, 18, 0, tzinfo=timezone.utc),
        stage=stage,
        status=status,
        home_score=hs if status == "finished" else None,
        away_score=as_ if status == "finished" else None,
    )
    db.add(m)
    return m


def _token(client):
    register_user(client, "br@test.com", "bruser", "pass1234")
    return login_user(client, "br@test.com", "pass1234")


def test_round_of_32_maps_to_slots_73_88_by_id_order(client, db):
    # 16 R32 matches with real-feed-style ids, home always wins.
    for ext_id in range(537415, 537431):
        _match(db, ext_id, "round_of_32", f"H{ext_id}", f"A{ext_id}")
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    assert resp.status_code == 200, resp.text
    by_slot = {s["slot_id"]: s for s in resp.json()}

    # Slot 73 -> smallest id, ... slot 88 -> largest id.
    for offset, ext_id in enumerate(range(537415, 537431)):
        slot = by_slot[73 + offset]
        assert slot["match"] is not None, f"slot {73+offset} unattached"
        assert slot["match"]["external_match_id"] == str(ext_id), (73 + offset, slot["match"]["external_match_id"])


def test_round_of_16_slot_resolves_from_r32_winners(client, db):
    # Only R32 played; R16 matches not in DB yet (teams undecided in real life).
    # Slot 89 = Winner M73 vs Winner M74 -> must resolve to the R32 winners.
    for ext_id in range(537415, 537431):
        _match(db, ext_id, "round_of_32", f"H{ext_id}", f"A{ext_id}", hs=3, as_=0)
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    by_slot = {s["slot_id"]: s for s in resp.json()}

    slot89 = by_slot[89]
    assert slot89["match"] is None  # R16 match not created yet
    # Winner of slot 73 (id 537415, home won) and slot 74 (id 537416, home won)
    assert slot89["home_label"] == "H537415", slot89["home_label"]
    assert slot89["away_label"] == "H537416", slot89["away_label"]


def test_quarter_finals_map_to_slots_97_100_not_by_raw_id(client, db):
    # QF ids 537383-537386 must land in slots 97-100, proving the bracket does
    # NOT do int(external_match_id)==slot_id (which would never match).
    for ext_id in range(537383, 537387):
        _match(db, ext_id, "quarter_finals", f"H{ext_id}", f"A{ext_id}", status="scheduled")
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    by_slot = {s["slot_id"]: s for s in resp.json()}

    for offset, ext_id in enumerate(range(537383, 537387)):
        slot = by_slot[97 + offset]
        assert slot["match"] is not None, f"slot {97+offset} unattached"
        assert slot["match"]["external_match_id"] == str(ext_id)
