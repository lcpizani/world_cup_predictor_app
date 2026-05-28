from uuid import UUID

from app.models.match import Match
from app.models.point_event import PointEvent
from app.models.prediction import Prediction
from app.models.tournament import TournamentMember
from tests.helpers import auth_headers, grant_admin, login_user, register_user


def create_scoring_tournament(client, token):
    tournament_payload = {
        "name": "World Cup Scoring Pool",
        "scoring_rules": {
            "correct_result_pts": 5,
            "correct_winner_pts": 3,
            "correct_goal_diff_pts": 2,
            "correct_goals_one_team_pts": 1,
        },
    }
    response = client.post("/tournaments", json=tournament_payload, headers=auth_headers(token))
    assert response.status_code == 201
    return response.json()


def create_match(client, token):
    match_payload = {
        "home_team": "Team C",
        "away_team": "Team D",
        "kickoff_at": "2030-11-02T19:00:00Z",
        "stage": "group",
    }
    response = client.post("/matches", json=match_payload, headers=auth_headers(token))
    assert response.status_code == 201
    return response.json()


def test_apply_match_result_scores_predictions_and_leaderboard(client, db):
    creator = register_user(client, "creator2@example.com", "creator2", "creatorpass2")
    creator_token = login_user(client, "creator2@example.com", "creatorpass2")
    grant_admin(db, "creator2@example.com")
    tournament = create_scoring_tournament(client, creator_token)
    tournament_id = tournament["id"]
    tournament_code = tournament["invite_code"]
    match = create_match(client, creator_token)
    match_id = match["id"]

    member = register_user(client, "bob2@example.com", "bob2", "bobpass2")
    member_token = login_user(client, "bob2@example.com", "bobpass2")

    response = client.post(
        "/tournaments/join",
        json={"invite_code": tournament_code},
        headers=auth_headers(member_token),
    )
    assert response.status_code == 201

    creator_prediction_payload = {
        "match_id": match_id,
        "predicted_home": 2,
        "predicted_away": 1,
    }
    response = client.post("/predictions", json=creator_prediction_payload, headers=auth_headers(creator_token))
    assert response.status_code == 201

    member_prediction_payload = {
        "match_id": match_id,
        "predicted_home": 1,
        "predicted_away": 1,
    }
    response = client.post("/predictions", json=member_prediction_payload, headers=auth_headers(member_token))
    assert response.status_code == 201

    result_payload = {"home_score": 2, "away_score": 1, "status": "finished"}
    response = client.put(f"/matches/{match_id}/result", json=result_payload, headers=auth_headers(creator_token))
    assert response.status_code == 200

    response = client.get("/predictions", params={"tournament_id": tournament_id}, headers=auth_headers(creator_token))
    assert response.status_code == 200
    predictions = response.json()
    assert len(predictions) == 1
    assert predictions[0]["points_awarded"] == 11

    response = client.get("/predictions", params={"tournament_id": tournament_id}, headers=auth_headers(member_token))
    assert response.status_code == 200
    member_predictions = response.json()
    assert len(member_predictions) == 1
    assert member_predictions[0]["points_awarded"] == 1

    response = client.get(f"/tournaments/{tournament_code}/leaderboard", headers=auth_headers(member_token))
    assert response.status_code == 200
    entries = response.json()["entries"]
    assert entries[0]["total_points"] == 11
    assert entries[1]["total_points"] == 1
    assert entries[0]["rank"] == 1
    assert entries[1]["rank"] == 2

    point_events = db.query(PointEvent).filter(PointEvent.match_id == UUID(match_id)).all()
    assert len(point_events) == 5


def test_recompute_tournament_scores_updates_points_after_correction(client, db):
    creator = register_user(client, "creator3@example.com", "creator3", "creatorpass3")
    creator_token = login_user(client, "creator3@example.com", "creatorpass3")
    grant_admin(db, "creator3@example.com")
    tournament = create_scoring_tournament(client, creator_token)
    tournament_id = tournament["id"]
    tournament_code = tournament["invite_code"]
    match = create_match(client, creator_token)
    match_id = match["id"]

    member = register_user(client, "carol@example.com", "carol", "carolpass")
    member_token = login_user(client, "carol@example.com", "carolpass")

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

    response = client.post(
        "/predictions",
        json={"match_id": match_id, "predicted_home": 1, "predicted_away": 1},
        headers=auth_headers(member_token),
    )
    assert response.status_code == 201

    response = client.put(f"/matches/{match_id}/result", json={"home_score": 2, "away_score": 1, "status": "finished"}, headers=auth_headers(creator_token))
    assert response.status_code == 200

    match_row = db.query(Match).filter(Match.id == UUID(match_id)).first()
    match_row.home_score = 1
    match_row.away_score = 1
    db.add(match_row)
    db.commit()

    response = client.post(f"/admin/tournaments/{tournament_id}/recompute", headers=auth_headers(creator_token))
    assert response.status_code == 200
    assert response.json()["recomputed_matches"] == 1
    assert response.json()["recomputed_predictions"] == 2

    response = client.get("/predictions", params={"tournament_id": tournament_id}, headers=auth_headers(creator_token))
    assert response.status_code == 200
    recalculated = {item["user_id"]: item["points_awarded"] for item in response.json()}
    assert recalculated[creator["id"]] == 1

    response = client.get("/predictions", params={"tournament_id": tournament_id}, headers=auth_headers(member_token))
    assert response.status_code == 200
    assert response.json()[0]["points_awarded"] == 11

    response = client.get(f"/tournaments/{tournament_code}/leaderboard", headers=auth_headers(member_token))
    assert response.status_code == 200
    entries = response.json()["entries"]
    assert entries[0]["user"]["id"] == member["id"]
    assert entries[0]["total_points"] == 11
    assert entries[1]["total_points"] == 1


def test_recompute_nonexistent_tournament_returns_404(client, db):
    register_user(client, "admin404@example.com", "admin404", "adminpass404")
    grant_admin(db, "admin404@example.com")
    token = login_user(client, "admin404@example.com", "adminpass404")
    response = client.post(
        "/admin/tournaments/00000000-0000-0000-0000-000000000000/recompute",
        headers=auth_headers(token),
    )
    assert response.status_code == 404
