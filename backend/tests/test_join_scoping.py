from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.models.match import Match
from app.models.point_event import PointEvent
from app.models.tournament import TournamentMember
from tests.helpers import auth_headers, grant_admin, login_user, register_user


SCORING_RULES = {
    "correct_result_pts": 5,
    "correct_winner_pts": 3,
    "correct_goal_diff_pts": 2,
    "correct_goals_one_team_pts": 1,
}


def _make_match(client, token, kickoff="2030-11-02T19:00:00Z"):
    return client.post(
        "/matches",
        json={"home_team": "A", "away_team": "B", "kickoff_at": kickoff, "stage": "group"},
        headers=auth_headers(token),
    ).json()


def _bump_membership_joined_at(db, tournament_id: str, user_email: str, joined_at: datetime):
    from app.models.user import User
    user = db.query(User).filter(User.email == user_email).first()
    member = (
        db.query(TournamentMember)
        .filter(
            TournamentMember.tournament_id == UUID(tournament_id),
            TournamentMember.user_id == user.id,
        )
        .first()
    )
    member.joined_at = joined_at
    db.add(member)
    db.commit()


def test_member_joining_after_kickoff_is_not_scored_in_tournament(client, db):
    """A user who joins a tournament after a match's kickoff must not earn
    points for that match in that tournament — even if their (global)
    prediction was correct."""
    creator = register_user(client, "creator@example.com", "creator", "password123")
    creator_token = login_user(client, "creator@example.com", "password123")
    grant_admin(db, "creator@example.com")

    tournament = client.post(
        "/tournaments",
        json={"name": "League", "scoring_rules": SCORING_RULES},
        headers=auth_headers(creator_token),
    ).json()
    tournament_id = tournament["id"]
    tournament_code = tournament["invite_code"]

    match = _make_match(client, creator_token, kickoff="2030-11-02T19:00:00Z")
    match_id = match["id"]

    # Member joins. They submit a prediction.
    register_user(client, "late@example.com", "late", "password123")
    late_token = login_user(client, "late@example.com", "password123")
    client.post(
        "/tournaments/join",
        json={"invite_code": tournament_code},
        headers=auth_headers(late_token),
    )
    client.post(
        "/predictions",
        json={"match_id": match_id, "predicted_home": 2, "predicted_away": 1},
        headers=auth_headers(late_token),
    )

    # Simulate them having joined *after* the kickoff (e.g., next day).
    _bump_membership_joined_at(
        db,
        tournament_id,
        "late@example.com",
        datetime(2030, 11, 3, 0, 0, tzinfo=timezone.utc),
    )

    # Creator's prediction was made before kickoff and they're an original member.
    client.post(
        "/predictions",
        json={"match_id": match_id, "predicted_home": 2, "predicted_away": 1},
        headers=auth_headers(creator_token),
    )

    res = client.put(
        f"/matches/{match_id}/result",
        json={"home_score": 2, "away_score": 1, "status": "finished"},
        headers=auth_headers(creator_token),
    )
    assert res.status_code == 200

    # Only the creator should have a PointEvent for this match in this tournament.
    events = (
        db.query(PointEvent)
        .filter(PointEvent.match_id == UUID(match_id), PointEvent.tournament_id == UUID(tournament_id))
        .all()
    )
    user_ids_scored = {e.user_id for e in events}
    from app.models.user import User
    creator_user = db.query(User).filter(User.email == "creator@example.com").first()
    late_user = db.query(User).filter(User.email == "late@example.com").first()
    assert creator_user.id in user_ids_scored
    assert late_user.id not in user_ids_scored

    # Leaderboard: late member is on it but with zero points.
    res = client.get(f"/tournaments/{tournament_code}/leaderboard", headers=auth_headers(creator_token))
    entries = {e["user"]["username"]: e["total_points"] for e in res.json()["entries"]}
    assert entries["creator"] == 5
    assert entries["late"] == 0


def test_compare_view_hides_predictions_made_before_member_joined(client, db):
    """A member who joins a tournament after a match's kickoff should not have
    their (global) prediction for that match shown on the compare page."""
    creator = register_user(client, "creator@example.com", "creator", "password123")
    creator_token = login_user(client, "creator@example.com", "password123")
    grant_admin(db, "creator@example.com")

    tournament = client.post(
        "/tournaments",
        json={"name": "League", "scoring_rules": SCORING_RULES},
        headers=auth_headers(creator_token),
    ).json()
    tournament_code = tournament["invite_code"]
    tournament_id = tournament["id"]

    match = _make_match(client, creator_token, kickoff="2030-11-02T19:00:00Z")
    match_id = match["id"]

    # Late member joins and predicts globally.
    register_user(client, "late@example.com", "late", "password123")
    late_token = login_user(client, "late@example.com", "password123")
    client.post(
        "/tournaments/join",
        json={"invite_code": tournament_code},
        headers=auth_headers(late_token),
    )
    client.post(
        "/predictions",
        json={"match_id": match_id, "predicted_home": 2, "predicted_away": 1},
        headers=auth_headers(late_token),
    )
    _bump_membership_joined_at(
        db,
        tournament_id,
        "late@example.com",
        datetime(2030, 11, 3, 0, 0, tzinfo=timezone.utc),
    )

    # Creator predicts and result is applied.
    client.post(
        "/predictions",
        json={"match_id": match_id, "predicted_home": 2, "predicted_away": 1},
        headers=auth_headers(creator_token),
    )
    client.put(
        f"/matches/{match_id}/result",
        json={"home_score": 2, "away_score": 1, "status": "finished"},
        headers=auth_headers(creator_token),
    )

    res = client.get(f"/tournaments/{tournament_code}/compare", headers=auth_headers(creator_token))
    assert res.status_code == 200
    match_entry = next(m for m in res.json() if m["match"]["id"] == match_id)
    by_username = {p["username"]: p for p in match_entry["predictions"]}
    # Late member's pick is hidden in this tournament (joined after kickoff)
    # and they get no points credit.
    assert by_username["late"]["predicted_home"] is None
    assert by_username["late"]["predicted_away"] is None
    assert by_username["late"]["points_awarded"] is None
    # Creator's pick is visible and scored (exact result = 5 pts).
    assert by_username["creator"]["predicted_home"] == 2
    assert by_username["creator"]["predicted_away"] == 1
    assert by_username["creator"]["points_awarded"] == 5
