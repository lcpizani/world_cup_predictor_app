from tests.helpers import auth_headers, grant_admin, login_user, register_user


def create_tournament(client, token, scoring_rules):
    tournament_payload = {
        "name": "Edge Case Pool",
        "scoring_rules": scoring_rules,
    }
    response = client.post("/tournaments", json=tournament_payload, headers=auth_headers(token))
    assert response.status_code == 201
    return response.json()


def create_match(client, token):
    match_payload = {
        "home_team": "Edge Home",
        "away_team": "Edge Away",
        "kickoff_at": "2030-11-05T18:00:00Z",
        "stage": "group",
    }
    response = client.post("/matches", json=match_payload, headers=auth_headers(token))
    assert response.status_code == 201
    return response.json()


def test_zero_point_scoring_creates_no_point_events(client, db):
    creator = register_user(client, "creator4@example.com", "creator4", "creatorpass4")
    creator_token = login_user(client, "creator4@example.com", "creatorpass4")
    grant_admin(db, "creator4@example.com")
    tournament = create_tournament(
        client,
        creator_token,
        {
            "correct_result_pts": 0,
            "correct_winner_pts": 0,
            "correct_goal_diff_pts": 0,
            "correct_goals_one_team_pts": 0,
        },
    )
    tournament_id = tournament["id"]
    tournament_code = tournament["invite_code"]
    match = create_match(client, creator_token)
    match_id = match["id"]

    response = client.post(
        "/predictions",
        json={"match_id": match_id, "predicted_home": 1, "predicted_away": 1},
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 201

    response = client.put(
        f"/matches/{match_id}/result",
        json={"home_score": 1, "away_score": 1, "status": "finished"},
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 200

    response = client.get("/predictions", params={"tournament_id": tournament_id}, headers=auth_headers(creator_token))
    assert response.status_code == 200
    assert response.json()[0]["points_awarded"] == 0

    league = client.get(f"/tournaments/{tournament_code}/leaderboard", headers=auth_headers(creator_token))
    assert league.status_code == 200
    assert league.json()["entries"][0]["total_points"] == 0


def test_prediction_submission_after_match_finished_is_rejected(client, db):
    creator = register_user(client, "creator5@example.com", "creator5", "creatorpass5")
    creator_token = login_user(client, "creator5@example.com", "creatorpass5")
    grant_admin(db, "creator5@example.com")
    tournament = create_tournament(client, creator_token, {
        "correct_result_pts": 5,
        "correct_winner_pts": 3,
        "correct_goal_diff_pts": 2,
        "correct_goals_one_team_pts": 1,
    })
    tournament_id = tournament["id"]
    match = create_match(client, creator_token)
    match_id = match["id"]

    response = client.put(
        f"/matches/{match_id}/result",
        json={"home_score": 2, "away_score": 0, "status": "finished"},
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 200

    response = client.post(
        "/predictions",
        json={"match_id": match_id, "predicted_home": 2, "predicted_away": 0},
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 400


def test_user_without_prediction_stays_at_zero_points(client, db):
    creator = register_user(client, "creator6@example.com", "creator6", "creatorpass6")
    creator_token = login_user(client, "creator6@example.com", "creatorpass6")
    grant_admin(db, "creator6@example.com")
    tournament = create_tournament(client, creator_token, {
        "correct_result_pts": 5,
        "correct_winner_pts": 3,
        "correct_goal_diff_pts": 2,
        "correct_goals_one_team_pts": 1,
    })
    tournament_id = tournament["id"]
    tournament_code = tournament["invite_code"]
    match = create_match(client, creator_token)
    match_id = match["id"]

    member = register_user(client, "bob6@example.com", "bob6", "bobpass6")
    member_token = login_user(client, "bob6@example.com", "bobpass6")
    response = client.post(
        "/tournaments/join",
        json={"invite_code": tournament_code},
        headers=auth_headers(member_token),
    )
    assert response.status_code == 201

    response = client.post(
        "/predictions",
        json={"match_id": match_id, "predicted_home": 2, "predicted_away": 1},
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 201

    response = client.put(
        f"/matches/{match_id}/result",
        json={"home_score": 2, "away_score": 1, "status": "finished"},
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 200

    leaderboard = client.get(f"/tournaments/{tournament_code}/leaderboard", headers=auth_headers(member_token))
    assert leaderboard.status_code == 200
    entries = leaderboard.json()["entries"]
    assert any(entry["user"]["email"] == member["email"] and entry["total_points"] == 0 for entry in entries)
