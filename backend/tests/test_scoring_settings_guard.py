"""Guard tests for editing scoring settings via PATCH /tournaments/{code}.

Rules:
- Point values freeze once the World Cup has started (any match live/finished).
- The 2x multiplier stays editable through the group stage and locks once every
  group-stage match has finished.
- Resending an unchanged-but-locked field is a safe no-op.
"""
from datetime import datetime, timezone

from app.models.match import Match
from tests.helpers import auth_headers, login_user, register_user


def _make_tournament(client, token):
    payload = {
        "name": "Guard Pool",
        "scoring_rules": {
            "correct_result_pts": 5,
            "correct_winner_pts": 3,
            "correct_goal_diff_pts": 2,
            "correct_goals_one_team_pts": 1,
            "double_points_from_stage": None,
        },
    }
    resp = client.post("/tournaments", json=payload, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


def _add_match(db, stage="group_stage", status="scheduled", ext="1"):
    m = Match(
        external_match_id=ext,
        home_team="A",
        away_team="B",
        kickoff_at=datetime(2026, 6, 11, 18, 0, tzinfo=timezone.utc),
        stage=stage,
        status=status,
    )
    db.add(m)
    db.commit()
    return m


def _creator(client):
    register_user(client, "guard@example.com", "guard", "guardpass1")
    return login_user(client, "guard@example.com", "guardpass1")


def test_can_edit_everything_before_kickoff(client, db):
    token = _creator(client)
    t = _make_tournament(client, token)
    _add_match(db, stage="group_stage", status="scheduled", ext="g1")

    resp = client.patch(
        f"/tournaments/{t['invite_code']}",
        json={"scoring_rules": {"correct_result_pts": 8, "double_points_from_stage": "quarter_finals"}},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    rules = resp.json()["scoring_rules"]
    assert rules["correct_result_pts"] == 8
    assert rules["double_points_from_stage"] == "quarter_finals"


def test_point_values_locked_once_world_cup_started(client, db):
    token = _creator(client)
    t = _make_tournament(client, token)
    _add_match(db, stage="group_stage", status="live", ext="g1")

    resp = client.patch(
        f"/tournaments/{t['invite_code']}",
        json={"scoring_rules": {"correct_result_pts": 9}},
        headers=auth_headers(token),
    )
    assert resp.status_code == 400
    assert "World Cup has started" in resp.json()["detail"]


def test_double_still_editable_during_group_stage(client, db):
    token = _creator(client)
    t = _make_tournament(client, token)
    # One group match finished, another still scheduled -> group stage NOT complete.
    _add_match(db, stage="group_stage", status="finished", ext="g1")
    _add_match(db, stage="group_stage", status="scheduled", ext="g2")

    resp = client.patch(
        f"/tournaments/{t['invite_code']}",
        json={"scoring_rules": {"double_points_from_stage": "round_of_16"}},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["scoring_rules"]["double_points_from_stage"] == "round_of_16"


def test_double_locked_once_group_stage_complete(client, db):
    token = _creator(client)
    t = _make_tournament(client, token)
    _add_match(db, stage="group_stage", status="finished", ext="g1")
    _add_match(db, stage="group_stage", status="finished", ext="g2")

    resp = client.patch(
        f"/tournaments/{t['invite_code']}",
        json={"scoring_rules": {"double_points_from_stage": "final"}},
        headers=auth_headers(token),
    )
    assert resp.status_code == 400
    assert "group stage is over" in resp.json()["detail"]


def test_resending_unchanged_locked_values_is_noop(client, db):
    token = _creator(client)
    t = _make_tournament(client, token)
    _add_match(db, stage="group_stage", status="live", ext="g1")

    # WC started: point values locked. Resending current values + a name change
    # must succeed because nothing actually changes.
    resp = client.patch(
        f"/tournaments/{t['invite_code']}",
        json={
            "name": "Renamed",
            "scoring_rules": {
                "correct_result_pts": 5,
                "correct_winner_pts": 3,
                "correct_goal_diff_pts": 2,
                "correct_goals_one_team_pts": 1,
                "double_points_from_stage": None,
            },
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Renamed"


def test_non_creator_cannot_edit(client, db):
    token = _creator(client)
    t = _make_tournament(client, token)
    register_user(client, "other@example.com", "other", "otherpass1")
    other_token = login_user(client, "other@example.com", "otherpass1")

    resp = client.patch(
        f"/tournaments/{t['invite_code']}",
        json={"scoring_rules": {"correct_result_pts": 7}},
        headers=auth_headers(other_token),
    )
    assert resp.status_code == 403
