"""Tests for the destructive-admin-ops hardening:

  * ALLOW_ADMIN_MATCH_UPDATES gates reset + seed endpoints (403 when off)
  * reset requires echoing the current match count (400 otherwise)
  * reset wipes matches/predictions/point events and zeroes points, users survive
  * predictions.match_id ON DELETE RESTRICT blocks deleting a match with predictions
"""
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base
from app.models.match import Match
from app.models.point_event import PointEvent
from app.models.prediction import Prediction
from app.models.tournament import Tournament, TournamentMember, TournamentScoringRules
from app.models.user import User
from tests.helpers import auth_headers, grant_admin, login_user, register_user

KICKOFF = datetime(2026, 6, 15, 15, 0, tzinfo=timezone.utc)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _seed_dataset(db):
    """One admin user, a tournament with a member, a match, a prediction, a point event."""
    user = User(id=uuid4(), email="a@test.com", username="admin1", hashed_password="x", is_admin=True)
    db.add(user)
    db.flush()
    t = Tournament(id=uuid4(), name="T", created_by=user.id, invite_code="INV1", is_active=True)
    db.add(t)
    db.flush()
    db.add(TournamentScoringRules(tournament_id=t.id, correct_result_pts=5,
                                  correct_winner_pts=3, correct_goal_diff_pts=2,
                                  correct_goals_one_team_pts=1))
    db.add(TournamentMember(tournament_id=t.id, user_id=user.id,
                            total_points=10, provisional_points=4,
                            joined_at=datetime(2026, 6, 1, tzinfo=timezone.utc)))
    match = Match(id=uuid4(), external_match_id=str(uuid4()), home_team="Brazil",
                  away_team="Argentina", kickoff_at=KICKOFF, stage="group_stage",
                  group="Group A", status="finished", home_score=2, away_score=1)
    db.add(match)
    db.flush()
    pred = Prediction(id=uuid4(), user_id=user.id, match_id=match.id,
                      predicted_home=2, predicted_away=1, is_locked=True)
    db.add(pred)
    db.flush()
    db.add(PointEvent(prediction_id=pred.id, user_id=user.id, tournament_id=t.id,
                      match_id=match.id, reason="correct_result", points=5))
    db.commit()
    return user, match


def _admin_token(client, db):
    register_user(client, "boss@test.com", "boss", "password123")
    grant_admin(db, "boss@test.com")
    return login_user(client, "boss@test.com", "password123")


# ── 7.1 — flag gating ──────────────────────────────────────────────────────────

def test_reset_forbidden_when_flag_off(client, db, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_ADMIN_MATCH_UPDATES", False)
    token = _admin_token(client, db)
    resp = client.request("DELETE", "/admin/matches/reset",
                          json={"confirm": "RESET", "expected_match_count": 0},
                          headers=auth_headers(token))
    assert resp.status_code == 403


def test_seed_endpoints_forbidden_when_flag_off(client, db, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_ADMIN_MATCH_UPDATES", False)
    token = _admin_token(client, db)
    live = client.post("/admin/seed/live-match",
                       json={"home_team": "Brazil", "away_team": "Chile",
                             "home_score": 1, "away_score": 0},
                       headers=auth_headers(token))
    assert live.status_code == 403
    finish = client.post("/admin/seed/finish-match",
                         json={"home_team": "Brazil", "away_team": "Chile",
                               "home_score": 1, "away_score": 0},
                         headers=auth_headers(token))
    assert finish.status_code == 403


# ── 7.1 / 7.3 — reset with flag on requires correct match count ─────────────────

def test_reset_rejects_wrong_match_count(client, db, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_ADMIN_MATCH_UPDATES", True)
    _seed_dataset(db)  # 1 match in DB
    token = _admin_token(client, db)

    # Missing/blind confirmation (count mismatch) → 400, nothing deleted
    bad = client.request("DELETE", "/admin/matches/reset",
                         json={"confirm": "RESET", "expected_match_count": 0},
                         headers=auth_headers(token))
    assert bad.status_code == 400
    assert db.query(Prediction).count() == 1

    # Wrong confirm token → 400
    bad2 = client.request("DELETE", "/admin/matches/reset",
                          json={"confirm": "nope", "expected_match_count": 1},
                          headers=auth_headers(token))
    assert bad2.status_code == 400
    assert db.query(Prediction).count() == 1


def test_reset_wipes_data_but_keeps_users(client, db, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_ADMIN_MATCH_UPDATES", True)
    _seed_dataset(db)
    token = _admin_token(client, db)
    users_before = db.query(User).count()

    actual = db.query(Match).count()
    ok = client.request("DELETE", "/admin/matches/reset",
                        json={"confirm": "RESET", "expected_match_count": actual},
                        headers=auth_headers(token))
    assert ok.status_code == 200

    db.expire_all()
    assert db.query(PointEvent).count() == 0
    assert db.query(Prediction).count() == 0
    assert db.query(Match).count() == 0
    assert db.query(User).count() == users_before  # users survive
    member = db.query(TournamentMember).first()
    assert member.total_points == 0 and member.provisional_points == 0


# ── 7.2 — FK RESTRICT (needs SQLite FK enforcement, so use a dedicated engine) ──

@pytest.fixture
def fk_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                           poolclass=StaticPool, future=True)

    @event.listens_for(engine, "connect")
    def _enable_fk(dbapi_con, _record):
        dbapi_con.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, future=True)
    s = Session()
    try:
        yield s
    finally:
        s.close()
        Base.metadata.drop_all(bind=engine)


def test_delete_match_with_predictions_is_blocked(fk_session):
    db = fk_session
    user = User(id=uuid4(), email="u@test.com", username="u", hashed_password="x", is_admin=False)
    db.add(user)
    db.flush()
    match = Match(id=uuid4(), external_match_id="m1", home_team="A", away_team="B",
                  kickoff_at=KICKOFF, stage="group_stage", group="Group A", status="scheduled")
    db.add(match)
    db.flush()
    db.add(Prediction(id=uuid4(), user_id=user.id, match_id=match.id,
                      predicted_home=1, predicted_away=0, is_locked=False))
    db.commit()

    db.delete(match)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_delete_match_without_predictions_succeeds(fk_session):
    db = fk_session
    match = Match(id=uuid4(), external_match_id="m2", home_team="A", away_team="B",
                  kickoff_at=KICKOFF, stage="group_stage", group="Group A", status="scheduled")
    db.add(match)
    db.commit()

    db.delete(match)
    db.commit()
    assert db.query(Match).count() == 0
