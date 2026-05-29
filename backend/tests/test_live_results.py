"""Tests for live results and leaderboard features."""
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.services.football_api import _map_api_status
from app.services.scoring import compute_provisional_points
from app.models.match import Match
from app.models.prediction import Prediction
from app.models.tournament import Tournament, TournamentScoringRules, TournamentMember
from app.models.point_event import PointEvent

from tests.helpers import auth_headers, grant_admin, login_user, register_user


# ── 7.1 Unit tests: _map_api_status ──────────────────────────────────────────

class TestMapApiStatus:
    def test_scheduled(self):
        assert _map_api_status("SCHEDULED") == "scheduled"

    def test_timed(self):
        assert _map_api_status("TIMED") == "scheduled"

    def test_in_play(self):
        assert _map_api_status("IN_PLAY") == "live"

    def test_paused(self):
        assert _map_api_status("PAUSED") == "live"

    def test_finished(self):
        assert _map_api_status("FINISHED") == "finished"

    def test_cancelled(self):
        assert _map_api_status("CANCELLED") == "suspended"

    def test_postponed(self):
        assert _map_api_status("POSTPONED") == "suspended"

    def test_suspended_status(self):
        assert _map_api_status("SUSPENDED") == "suspended"

    def test_awarded(self):
        assert _map_api_status("AWARDED") == "suspended"

    def test_unknown_defaults_to_suspended(self):
        assert _map_api_status("SOMETHING_NEW") == "suspended"


# ── 7.2 Unit tests: compute_provisional_points ───────────────────────────────

def test_compute_provisional_points_no_live_matches(db):
    tournament_id = uuid4()
    user_id = uuid4()
    # No live matches → 0 provisional points, no DB writes
    result = compute_provisional_points(db, tournament_id, user_id)
    assert result == 0
    assert db.query(PointEvent).count() == 0


def test_compute_provisional_points_with_live_match(db):
    from app.models.user import User

    # Set up user
    user = User(
        id=uuid4(),
        email="live@test.com",
        username="liveuser",
        hashed_password="x",
        is_admin=False,
    )
    db.add(user)

    # Set up tournament with scoring rules
    tournament = Tournament(
        id=uuid4(),
        name="Live Test Tournament",
        created_by=user.id,
        invite_code="LIVETEST1",
        is_active=True,
    )
    db.add(tournament)
    db.flush()

    scoring = TournamentScoringRules(
        tournament_id=tournament.id,
        correct_result_pts=5,
        correct_winner_pts=3,
        correct_goal_diff_pts=2,
        correct_goals_one_team_pts=1,
    )
    db.add(scoring)

    membership = TournamentMember(
        tournament_id=tournament.id,
        user_id=user.id,
        total_points=0,
    )
    db.add(membership)

    # Set up a live match with score 2-1
    match = Match(
        id=uuid4(),
        external_match_id="ext-live-1",
        home_team="Brazil",
        away_team="Argentina",
        kickoff_at=datetime(2026, 6, 1, 15, 0, tzinfo=timezone.utc),
        stage="group",
        status="live",
        home_score=2,
        away_score=1,
    )
    db.add(match)
    db.flush()

    # User predicts exact score 2-1
    prediction = Prediction(
        id=uuid4(),
        user_id=user.id,
        match_id=match.id,
        predicted_home=2,
        predicted_away=1,
        is_locked=True,
    )
    db.add(prediction)
    db.commit()

    point_events_before = db.query(PointEvent).count()
    result = compute_provisional_points(db, tournament.id, user.id)
    point_events_after = db.query(PointEvent).count()

    # Exact score → 5 pts
    assert result == 5
    # No PointEvent rows written
    assert point_events_after == point_events_before


def test_compute_provisional_points_non_member_returns_zero(db):
    from app.models.user import User

    user = User(
        id=uuid4(),
        email="nonmember@test.com",
        username="nonmember",
        hashed_password="x",
        is_admin=False,
    )
    db.add(user)

    tournament = Tournament(
        id=uuid4(),
        name="Other Tournament",
        created_by=user.id,
        invite_code="OTHERT001",
        is_active=True,
    )
    db.add(tournament)

    match = Match(
        id=uuid4(),
        external_match_id="ext-live-2",
        home_team="X",
        away_team="Y",
        kickoff_at=datetime(2026, 6, 1, 15, 0, tzinfo=timezone.utc),
        stage="group",
        status="live",
        home_score=1,
        away_score=0,
    )
    db.add(match)
    db.commit()

    result = compute_provisional_points(db, tournament.id, user.id)
    assert result == 0


# ── 7.3 Integration tests: GET /admin/sync/health ────────────────────────────

def test_sync_health_ok(client, db):
    admin_email = "admin@test.com"
    register_user(client, admin_email, "adminuser", "adminpass1")
    grant_admin(db, admin_email)
    token = login_user(client, admin_email, "adminpass1")

    mock_response = MagicMock()
    mock_response.is_success = True
    mock_response.status_code = 200
    mock_response.headers = {
        "X-Requests-Available-Minute": "9",
        "X-RequestCounter-Reset": "30",
    }

    with patch("app.routers.admin.httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_response
        resp = client.get("/admin/sync/health", headers=auth_headers(token))

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["rate_limit_remaining"] == "9"


def test_sync_health_api_error(client, db):
    admin_email = "admin2@test.com"
    register_user(client, admin_email, "adminuser2", "adminpass1")
    grant_admin(db, admin_email)
    token = login_user(client, admin_email, "adminpass1")

    mock_response = MagicMock()
    mock_response.is_success = False
    mock_response.status_code = 403

    with patch("app.routers.admin.httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_response
        resp = client.get("/admin/sync/health", headers=auth_headers(token))

    assert resp.status_code == 403


def test_sync_health_requires_admin(client):
    register_user(client, "nonadmin@test.com", "nonadmin", "pass1234")
    token = login_user(client, "nonadmin@test.com", "pass1234")
    resp = client.get("/admin/sync/health", headers=auth_headers(token))
    assert resp.status_code == 403


# ── 7.4 Integration tests: GET /tournaments/{code}/leaderboard/live ──────────

def _setup_tournament(client, invite_code="LIVELBTEST"):
    register_user(client, f"{invite_code}@lb.com", f"lbcreator{invite_code}", "pass1234")
    token = login_user(client, f"{invite_code}@lb.com", "pass1234")
    resp = client.post(
        "/tournaments",
        json={
            "name": "Live LB",
            "scoring_rules": {
                "correct_result_pts": 5,
                "correct_winner_pts": 3,
                "correct_goal_diff_pts": 2,
                "correct_goals_one_team_pts": 1,
            },
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 201
    return resp.json(), token


def test_live_leaderboard_member_gets_200(client):
    tournament, token = _setup_tournament(client)
    code = tournament["invite_code"]
    resp = client.get(f"/tournaments/{code}/leaderboard/live", headers=auth_headers(token))
    assert resp.status_code == 200
    body = resp.json()
    assert "entries" in body
    assert "has_live_matches" in body
    assert body["tournament_id"] == tournament["id"]


def test_live_leaderboard_non_member_gets_403(client):
    tournament, _ = _setup_tournament(client, invite_code="LIVELBTEST2")
    code = tournament["invite_code"]

    register_user(client, "outsider@lb.com", "outsider", "pass1234")
    outsider_token = login_user(client, "outsider@lb.com", "pass1234")
    resp = client.get(f"/tournaments/{code}/leaderboard/live", headers=auth_headers(outsider_token))
    assert resp.status_code == 403


def test_live_leaderboard_no_live_matches_provisional_zero(client):
    tournament, token = _setup_tournament(client, invite_code="LIVELBTEST3")
    code = tournament["invite_code"]
    resp = client.get(f"/tournaments/{code}/leaderboard/live", headers=auth_headers(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["has_live_matches"] is False
    for entry in body["entries"]:
        assert entry["provisional_points"] == 0
