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
    # The 2026 bracket is interleaved: slot 89 = Winner M74 vs Winner M77, so it
    # must resolve from the R32 winners of *those* matches, not M73/M74.
    for ext_id in range(537415, 537431):
        _match(db, ext_id, "round_of_32", f"H{ext_id}", f"A{ext_id}", hs=3, as_=0)
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    by_slot = {s["slot_id"]: s for s in resp.json()}

    # Slots map to ids by ascending order: M73->537415, M74->537416, M77->537419.
    slot89 = by_slot[89]
    assert slot89["match"] is None  # R16 match not created yet
    # Slot 89 = Winner M74 (id 537416, home won) vs Winner M77 (id 537419, home won)
    assert slot89["home_label"] == "H537416", slot89["home_label"]
    assert slot89["away_label"] == "H537419", slot89["away_label"]

    # Slot 90 = Winner M73 (id 537415) vs Winner M75 (id 537417)
    slot90 = by_slot[90]
    assert slot90["home_label"] == "H537415", slot90["home_label"]
    assert slot90["away_label"] == "H537417", slot90["away_label"]


def test_round_of_16_fixtures_link_by_teams_not_position(client, db):
    # R32 all finished (ids 537415-537430 -> slots 73-88, home always wins), so the
    # advanced teams are known. Then only TWO R16 fixtures exist, added out of FIFA
    # match-number order. A positional zip would route them to slots 89/90; linking
    # by the teams that advanced must instead land them on slots 91 and 95, and
    # carry their live score through so the bracket updates live.
    for ext_id in range(537415, 537431):
        _match(db, ext_id, "round_of_32", f"H{ext_id}", f"A{ext_id}", hs=2, as_=0)

    # Slot 91 = Winner M76 (slot 76 -> id 537418) vs Winner M78 (slot 78 -> id 537420)
    _match(db, 537377, "round_of_16", "H537418", "H537420", status="live", hs=1, as_=0)
    # Slot 95 = Winner M86 (slot 86 -> id 537428) vs Winner M88 (slot 88 -> id 537430)
    _match(db, 537381, "round_of_16", "H537428", "H537430", status="live", hs=0, as_=2)
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    by_slot = {s["slot_id"]: s for s in resp.json()}

    slot91 = by_slot[91]
    assert slot91["match"] is not None, "slot 91 fixture not linked"
    assert slot91["match"]["external_match_id"] == "537377"
    assert slot91["match"]["status"] == "live"

    slot95 = by_slot[95]
    assert slot95["match"] is not None, "slot 95 fixture not linked"
    assert slot95["match"]["external_match_id"] == "537381"

    # Slots 89/90 — whose fixtures are not in yet — must stay unlinked (they would
    # have wrongly grabbed the two fixtures under positional mapping).
    assert by_slot[89]["match"] is None
    assert by_slot[90]["match"] is None


def test_quarter_final_resolves_from_round_of_16_winners(client, db):
    # R16 played (ids 537375-537382 -> slots 89-96 by order), home always wins.
    # QF slot 98 = Winner M93 vs Winner M94 -> must resolve to those R16 winners.
    for ext_id in range(537375, 537383):
        _match(db, ext_id, "round_of_16", f"H{ext_id}", f"A{ext_id}", hs=2, as_=0)
    db.commit()

    resp = client.get("/standings/bracket", headers=auth_headers(_token(client)))
    by_slot = {s["slot_id"]: s for s in resp.json()}

    # slots 89..96 -> ids 537375..537382. M93 -> 537379, M94 -> 537380.
    slot98 = by_slot[98]
    assert slot98["match"] is None
    assert slot98["home_label"] == "H537379", slot98["home_label"]
    assert slot98["away_label"] == "H537380", slot98["away_label"]


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
