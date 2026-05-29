from tests.helpers import auth_headers, grant_admin, login_user, register_user

SCORING_RULES = {
    "correct_result_pts": 5,
    "correct_winner_pts": 3,
    "correct_goal_diff_pts": 2,
    "correct_goals_one_team_pts": 1,
}


def _setup_tournament_with_finished_match(client, db):
    """Returns (creator_token, member_token, invite_code, match_id)."""
    creator = register_user(client, "c@example.com", "creator", "password123")
    creator_token = login_user(client, "c@example.com", "password123")
    grant_admin(db, "c@example.com")

    t = client.post("/tournaments", json={"name": "Pool", "scoring_rules": SCORING_RULES},
                    headers=auth_headers(creator_token)).json()
    invite_code = t["invite_code"]

    m = client.post("/matches", json={
        "home_team": "France", "away_team": "Brazil",
        "kickoff_at": "2030-07-01T18:00:00Z", "stage": "final",
    }, headers=auth_headers(creator_token)).json()
    match_id = m["id"]

    # second member joins
    register_user(client, "b@example.com", "bob", "password123")
    member_token = login_user(client, "b@example.com", "password123")
    client.post("/tournaments/join", json={"invite_code": invite_code},
                headers=auth_headers(member_token))

    # both submit predictions
    client.post("/predictions", json={"match_id": match_id, "predicted_home": 2, "predicted_away": 1},
                headers=auth_headers(creator_token))
    client.post("/predictions", json={"match_id": match_id, "predicted_home": 1, "predicted_away": 0},
                headers=auth_headers(member_token))

    # apply result (exact for creator: 2-1)
    client.put(f"/matches/{match_id}/result", json={"home_score": 2, "away_score": 1, "status": "finished"},
               headers=auth_headers(creator_token))

    return creator_token, member_token, invite_code, match_id


def test_member_compare_finished_match_shows_all_predictions(client, db):
    creator_token, member_token, invite_code, match_id = _setup_tournament_with_finished_match(client, db)

    res = client.get(f"/tournaments/{invite_code}/compare", headers=auth_headers(member_token))
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1

    match_entry = data[0]
    assert match_entry["match"]["id"] == match_id
    assert match_entry["match"]["status"] == "finished"

    predictions = {p["username"]: p for p in match_entry["predictions"]}
    assert len(predictions) == 2

    # creator predicted exactly 2-1
    creator_pred = predictions["creator"]
    assert creator_pred["predicted_home"] == 2
    assert creator_pred["predicted_away"] == 1
    assert creator_pred["points_awarded"] is not None
    assert creator_pred["points_awarded"] > 0

    # bob predicted 1-0 (wrong winner direction but correct home-win)
    bob_pred = predictions["bob"]
    assert bob_pred["predicted_home"] == 1
    assert bob_pred["predicted_away"] == 0


def test_non_member_compare_returns_403(client, db):
    _, _, invite_code, _ = _setup_tournament_with_finished_match(client, db)

    register_user(client, "outsider@example.com", "outsider", "password123")
    outsider_token = login_user(client, "outsider@example.com", "password123")

    res = client.get(f"/tournaments/{invite_code}/compare", headers=auth_headers(outsider_token))
    assert res.status_code == 403


def test_scheduled_match_hides_other_members_scores(client, db):
    creator = register_user(client, "c2@example.com", "creator2", "password123")
    creator_token = login_user(client, "c2@example.com", "password123")
    grant_admin(db, "c2@example.com")

    t = client.post("/tournaments", json={"name": "Pool2", "scoring_rules": SCORING_RULES},
                    headers=auth_headers(creator_token)).json()
    invite_code = t["invite_code"]

    m = client.post("/matches", json={
        "home_team": "Spain", "away_team": "Germany",
        "kickoff_at": "2050-07-01T18:00:00Z", "stage": "group",
    }, headers=auth_headers(creator_token)).json()
    match_id = m["id"]

    register_user(client, "b2@example.com", "bob2", "password123")
    member_token = login_user(client, "b2@example.com", "password123")
    client.post("/tournaments/join", json={"invite_code": invite_code},
                headers=auth_headers(member_token))

    # both submit predictions
    client.post("/predictions", json={"match_id": match_id, "predicted_home": 3, "predicted_away": 0},
                headers=auth_headers(creator_token))
    client.post("/predictions", json={"match_id": match_id, "predicted_home": 1, "predicted_away": 1},
                headers=auth_headers(member_token))

    # bob calls compare — should see own pick but not creator's
    res = client.get(f"/tournaments/{invite_code}/compare", headers=auth_headers(member_token))
    assert res.status_code == 200
    data = res.json()
    assert data[0]["match"]["status"] == "scheduled"

    predictions = {p["username"]: p for p in data[0]["predictions"]}
    bob_pred = predictions["bob2"]
    assert bob_pred["predicted_home"] == 1
    assert bob_pred["predicted_away"] == 1

    creator_pred = predictions["creator2"]
    assert creator_pred["predicted_home"] is None
    assert creator_pred["predicted_away"] is None
    assert creator_pred["points_awarded"] is None
