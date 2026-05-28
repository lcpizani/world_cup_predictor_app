from typing import Dict, Any
from uuid import UUID

from tests.helpers import auth_headers, grant_admin, login_user, register_user


def test_register_login_me(client):
    email = "alice@example.com"
    username = "alice"
    password = "password123"

    user = register_user(client, email, username, password)
    assert user["email"] == email
    assert user["username"] == username
    assert "id" in user

    token = login_user(client, email, password)
    response = client.get("/auth/me", headers=auth_headers(token))
    assert response.status_code == 200
    profile = response.json()
    assert profile["email"] == email
    assert profile["username"] == username
    assert profile["id"] == user["id"]


def test_tournament_create_join_leaderboard_and_predictions(client):
    creator_email = "creator@example.com"
    creator_username = "creator"
    creator_password = "creatorpass"
    creator = register_user(client, creator_email, creator_username, creator_password)
    creator_token = login_user(client, creator_email, creator_password)

    tournament_payload = {
        "name": "World Cup Pool",
        "scoring_rules": {
            "correct_result_pts": 5,
            "correct_winner_pts": 3,
            "correct_goal_diff_pts": 2,
            "correct_goals_one_team_pts": 1,
        },
    }
    response = client.post(
        "/tournaments",
        json=tournament_payload,
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 201
    tournament = response.json()
    assert tournament["name"] == tournament_payload["name"]
    assert tournament["invite_code"]
    tournament_id = tournament["id"]

    match_payload = {
        "home_team": "Team A",
        "away_team": "Team B",
        "kickoff_at": "2030-11-01T19:00:00Z",
        "stage": "group",
    }
    response = client.post(
        "/matches",
        json=match_payload,
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 201
    match = response.json()
    assert match["home_team"] == match_payload["home_team"]
    assert match["status"] == "scheduled"
    match_id = match["id"]

    # second user joins tournament
    member_email = "bob@example.com"
    member_username = "bob"
    member_password = "bobpass"
    member = register_user(client, member_email, member_username, member_password)
    member_token = login_user(client, member_email, member_password)

    join_response = client.post(
        "/tournaments/join",
        json={"invite_code": tournament["invite_code"]},
        headers=auth_headers(member_token),
    )
    assert join_response.status_code == 201
    join_data = join_response.json()
    assert join_data["tournament_id"] == tournament_id
    assert join_data["user_id"] == member["id"]

    # list tournaments for creator and member
    response = client.get("/tournaments", headers=auth_headers(creator_token))
    assert response.status_code == 200
    assert any(item["id"] == tournament_id for item in response.json())

    response = client.get("/tournaments", headers=auth_headers(member_token))
    assert response.status_code == 200
    assert any(item["id"] == tournament_id for item in response.json())

    # get tournament details
    response = client.get(f"/tournaments/{tournament['invite_code']}", headers=auth_headers(member_token))
    assert response.status_code == 200
    assert response.json()["id"] == tournament_id


def test_match_result_application_updates_predictions_and_leaderboard(client, db):
    creator_email = "creator2@example.com"
    creator_username = "creator2"
    creator_password = "creatorpass2"
    creator = register_user(client, creator_email, creator_username, creator_password)
    creator_token = login_user(client, creator_email, creator_password)
    grant_admin(db, creator_email)

    tournament_payload = {
        "name": "World Cup Scoring Pool",
        "scoring_rules": {
            "correct_result_pts": 5,
            "correct_winner_pts": 3,
            "correct_goal_diff_pts": 2,
            "correct_goals_one_team_pts": 1,
        },
    }
    response = client.post(
        "/tournaments",
        json=tournament_payload,
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 201
    tournament = response.json()
    tournament_id = tournament["id"]
    tournament_invite_code = tournament["invite_code"]

    match_payload = {
        "home_team": "Team C",
        "away_team": "Team D",
        "kickoff_at": "2030-11-02T19:00:00Z",
        "stage": "group",
    }
    response = client.post(
        "/matches",
        json=match_payload,
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 201
    match_id = response.json()["id"]

    member_email = "bob2@example.com"
    member_username = "bob2"
    member_password = "bobpass2"
    member = register_user(client, member_email, member_username, member_password)
    member_token = login_user(client, member_email, member_password)

    response = client.post(
        "/tournaments/join",
        json={"invite_code": tournament_invite_code},
        headers=auth_headers(member_token),
    )
    assert response.status_code == 201
    assert response.json()["tournament_id"] == tournament_id

    creator_prediction_payload = {
        "match_id": match_id,
        "predicted_home": 2,
        "predicted_away": 1,
    }
    response = client.post(
        "/predictions",
        json=creator_prediction_payload,
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 201

    member_prediction_payload = {
        "match_id": match_id,
        "predicted_home": 1,
        "predicted_away": 1,
    }
    response = client.post(
        "/predictions",
        json=member_prediction_payload,
        headers=auth_headers(member_token),
    )
    assert response.status_code == 201

    result_payload = {"home_score": 2, "away_score": 1, "status": "finished"}
    response = client.put(
        f"/matches/{match_id}/result",
        json=result_payload,
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 200
    updated_match = response.json()
    assert updated_match["home_score"] == 2
    assert updated_match["away_score"] == 1
    assert updated_match["status"] == "finished"

    # Confirm prediction points were assigned
    response = client.get(
        "/predictions",
        params={"tournament_id": tournament_id},
        headers=auth_headers(creator_token),
    )
    assert response.status_code == 200
    predictions = response.json()
    assert len(predictions) == 1
    assert predictions[0]["points_awarded"] == 11

    response = client.get(
        "/predictions",
        params={"tournament_id": tournament_id},
        headers=auth_headers(member_token),
    )
    assert response.status_code == 200
    member_predictions = response.json()
    assert len(member_predictions) == 1
    assert member_predictions[0]["points_awarded"] == 1

    # Confirm leaderboard reflects updated totals and ranks
    response = client.get(f"/tournaments/{tournament_invite_code}/leaderboard", headers=auth_headers(member_token))
    assert response.status_code == 200
    leaderboard = response.json()
    entries = leaderboard["entries"]
    assert len(entries) == 2
    assert entries[0]["total_points"] == 11
    assert entries[1]["total_points"] == 1
    assert entries[0]["rank"] == 1
    assert entries[1]["rank"] == 2


def test_prediction_for_nonexistent_match_returns_404(client):
    register_user(client, "loner@example.com", "loner", "lonerpass")
    token = login_user(client, "loner@example.com", "lonerpass")

    response = client.post(
        "/predictions",
        json={"match_id": "00000000-0000-0000-0000-000000000001", "predicted_home": 1, "predicted_away": 0},
        headers=auth_headers(token),
    )
    assert response.status_code == 404


def test_duplicate_prediction_for_same_match_is_rejected(client):
    creator = register_user(client, "dup_creator@example.com", "dupcreator", "duppass")
    token = login_user(client, "dup_creator@example.com", "duppass")

    tournament_payload = {
        "name": "Dup Test Pool",
        "scoring_rules": {
            "correct_result_pts": 5,
            "correct_winner_pts": 3,
            "correct_goal_diff_pts": 2,
            "correct_goals_one_team_pts": 1,
        },
    }
    t = client.post("/tournaments", json=tournament_payload, headers=auth_headers(token))
    assert t.status_code == 201

    m = client.post(
        "/matches",
        json={"home_team": "X", "away_team": "Y", "kickoff_at": "2030-12-01T18:00:00Z", "stage": "group"},
        headers=auth_headers(token),
    )
    assert m.status_code == 201
    match_id = m.json()["id"]

    r1 = client.post(
        "/predictions",
        json={"match_id": match_id, "predicted_home": 1, "predicted_away": 0},
        headers=auth_headers(token),
    )
    assert r1.status_code == 201

    r2 = client.post(
        "/predictions",
        json={"match_id": match_id, "predicted_home": 2, "predicted_away": 1},
        headers=auth_headers(token),
    )
    assert r2.status_code == 409
