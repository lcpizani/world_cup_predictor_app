"""
End-to-end pipeline tests: match sync → standings → points → leaderboard.

Covers the complete data flow:
  1. Scheduled matches → standings fallback shows all groups (zero stats)
  2. Match goes live with score → GroupStanding rows update
  3. Provisional points compute correctly for live matches
  4. Match finishes → PointEvents written, total_points updated, provisional cleared
  5. Standings reflect the final result
"""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.models.group_standing import GroupStanding
from app.models.match import Match
from app.models.point_event import PointEvent
from app.models.prediction import Prediction
from app.models.tournament import Tournament, TournamentMember, TournamentScoringRules
from app.models.user import User
from app.services.football_api import sync_matches
from app.services.scoring import apply_match_result, update_provisional_points
from app.services.standings import recalculate_standings_from_matches


# ── Fixtures ──────────────────────────────────────────────────────────────────

KICKOFF = datetime(2026, 6, 15, 15, 0, tzinfo=timezone.utc)
JOINED  = datetime(2026, 6,  1,  0, 0, tzinfo=timezone.utc)


def _make_user(db, email="u@test.com", username="user1"):
    u = User(id=uuid4(), email=email, username=username, hashed_password="x", is_admin=False)
    db.add(u)
    db.flush()
    return u


def _make_tournament(db, creator_id, invite_code="T1",
                     correct_result=5, correct_winner=3, goal_diff=2, one_team=1):
    t = Tournament(id=uuid4(), name="Test", created_by=creator_id, invite_code=invite_code, is_active=True)
    db.add(t)
    db.flush()
    sr = TournamentScoringRules(
        tournament_id=t.id,
        correct_result_pts=correct_result,
        correct_winner_pts=correct_winner,
        correct_goal_diff_pts=goal_diff,
        correct_goals_one_team_pts=one_team,
    )
    db.add(sr)
    db.flush()
    return t


def _make_member(db, tournament_id, user_id, joined_at=JOINED):
    m = TournamentMember(tournament_id=tournament_id, user_id=user_id,
                         total_points=0, provisional_points=0, joined_at=joined_at)
    db.add(m)
    db.flush()
    return m


def _make_match(db, home="Brazil", away="Argentina", group="Group A",
                stage="group_stage", status="scheduled",
                home_score=None, away_score=None, kickoff=KICKOFF):
    m = Match(
        id=uuid4(),
        external_match_id=str(uuid4()),
        home_team=home,
        away_team=away,
        kickoff_at=kickoff,
        stage=stage,
        group=group,
        status=status,
        home_score=home_score,
        away_score=away_score,
    )
    db.add(m)
    db.flush()
    return m


def _make_prediction(db, user_id, match_id, predicted_home, predicted_away):
    p = Prediction(
        id=uuid4(),
        user_id=user_id,
        match_id=match_id,
        predicted_home=predicted_home,
        predicted_away=predicted_away,
        is_locked=True,
    )
    db.add(p)
    db.flush()
    return p


# ── 1. Standings fallback: scheduled matches → zero-stat rows via API ─────────

def test_standings_api_returns_groups_from_scheduled_matches(client, db):
    """When only scheduled matches exist, API still returns all groups with 0 stats."""
    from tests.helpers import register_user, login_user, auth_headers

    # Seed group-stage fixtures for two groups
    for home, away, group in [
        ("Mexico",  "Poland",    "Group C"),
        ("Saudi Arabia", "Argentina", "Group C"),
        ("France",  "Australia", "Group D"),
        ("Denmark", "Tunisia",   "Group D"),
    ]:
        _make_match(db, home=home, away=away, group=group, status="scheduled")
    db.commit()

    register_user(client, "s@test.com", "suser", "pass1234")
    token = login_user(client, "s@test.com", "pass1234")

    resp = client.get("/standings", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()

    group_names = {g["group"] for g in data}
    assert "GROUP_C" in group_names
    assert "GROUP_D" in group_names

    # All stats zero — no games played yet
    for g in data:
        for row in g["standings"]:
            assert row["played"] == 0
            assert row["points"] == 0


# ── 2. Live match → GroupStanding rows update ─────────────────────────────────

def test_live_match_updates_group_standings(db):
    """recalculate_standings_from_matches writes rows for live matches."""
    _make_match(db, home="Spain", away="Costa Rica", group="Group E",
                stage="group_stage", status="live", home_score=7, away_score=0)
    _make_match(db, home="Germany", away="Japan", group="Group E",
                stage="group_stage", status="live", home_score=1, away_score=2)
    db.commit()

    result = recalculate_standings_from_matches(db)
    assert result["recalculated"] == 4  # 2 teams × 2 matches = 4 rows (but actually 4 unique teams)

    rows = db.query(GroupStanding).filter(GroupStanding.group == "GROUP_E").order_by(GroupStanding.position).all()
    assert len(rows) == 4

    by_team = {r.team_name: r for r in rows}
    # Spain won 7-0
    assert by_team["Spain"].won == 1
    assert by_team["Spain"].goals_for == 7
    assert by_team["Spain"].goals_against == 0
    assert by_team["Spain"].points == 3
    # Japan won 2-1
    assert by_team["Japan"].won == 1
    assert by_team["Japan"].points == 3
    # Costa Rica lost
    assert by_team["Costa Rica"].lost == 1
    assert by_team["Costa Rica"].points == 0
    # Germany lost
    assert by_team["Germany"].lost == 1
    assert by_team["Germany"].goals_for == 1


# ── 3. Provisional points from live match ────────────────────────────────────

def test_provisional_points_computed_from_live_match(db):
    """update_provisional_points writes correct values into TournamentMember."""
    user = _make_user(db)
    tournament = _make_tournament(db, user.id)
    member = _make_member(db, tournament.id, user.id)

    match = _make_match(db, status="live", home_score=2, away_score=1)
    _make_prediction(db, user.id, match.id, predicted_home=2, predicted_away=1)
    db.commit()

    update_provisional_points(db)

    db.expire_all()
    member = db.query(TournamentMember).filter_by(
        tournament_id=tournament.id, user_id=user.id
    ).first()
    # Exact score (2-1) → correct_result_pts = 5
    assert member.provisional_points == 5
    # No PointEvents written — only confirmed matches get those
    assert db.query(PointEvent).count() == 0


# ── 4. Match finishes → points confirmed, provisional cleared ─────────────────

def test_apply_match_result_writes_point_events_and_clears_provisional(db):
    user = _make_user(db)
    tournament = _make_tournament(db, user.id)
    _make_member(db, tournament.id, user.id)

    match = _make_match(db, status="live", home_score=2, away_score=1,
                        stage="group_stage", group="Group A")
    _make_prediction(db, user.id, match.id, predicted_home=2, predicted_away=1)

    # Simulate provisional points set from a previous sync cycle
    db.query(TournamentMember).filter_by(
        tournament_id=tournament.id, user_id=user.id
    ).update({"provisional_points": 5})
    db.commit()

    apply_match_result(db, match.id, home_score=2, away_score=1, status="finished")

    db.expire_all()
    member = db.query(TournamentMember).filter_by(
        tournament_id=tournament.id, user_id=user.id
    ).first()

    # Points confirmed
    assert member.total_points == 5
    # Provisional cleared
    assert member.provisional_points == 0

    # PointEvent created
    events = db.query(PointEvent).filter_by(user_id=user.id).all()
    assert len(events) == 1
    assert events[0].reason == "correct_result"
    assert events[0].points == 5


# ── 5. Finished match → standings persist correctly ───────────────────────────

def test_finished_match_in_standings(db):
    """Finished matches appear in group_standings via apply_match_result."""
    user = _make_user(db)
    match = _make_match(db, home="Uruguay", away="South Korea", group="Group H",
                        stage="group_stage", status="scheduled")
    db.commit()

    apply_match_result(db, match.id, home_score=3, away_score=0, status="finished")

    rows = db.query(GroupStanding).filter(GroupStanding.group == "GROUP_H").all()
    by_team = {r.team_name: r for r in rows}

    assert by_team["Uruguay"].won == 1
    assert by_team["Uruguay"].goals_for == 3
    assert by_team["Uruguay"].points == 3
    assert by_team["South Korea"].lost == 1
    assert by_team["South Korea"].goals_for == 0


# ── 6. No live matches → provisional_points reset to 0 ───────────────────────

def test_provisional_points_cleared_when_no_live_matches(db):
    """If all matches are finished/scheduled, stale provisional values get zeroed."""
    user = _make_user(db)
    tournament = _make_tournament(db, user.id)
    _make_member(db, tournament.id, user.id)
    db.query(TournamentMember).filter_by(
        tournament_id=tournament.id, user_id=user.id
    ).update({"provisional_points": 99})
    db.commit()

    # No live matches in DB
    update_provisional_points(db)

    db.expire_all()
    member = db.query(TournamentMember).filter_by(
        tournament_id=tournament.id, user_id=user.id
    ).first()
    assert member.provisional_points == 0


# ── 7. Snapshot-at-join: late joiner gets no points ──────────────────────────

def test_late_joiner_earns_no_provisional_points(db):
    user = _make_user(db)
    tournament = _make_tournament(db, user.id)

    match = _make_match(db, status="live", home_score=1, away_score=0,
                        kickoff=datetime(2026, 6, 10, 15, 0, tzinfo=timezone.utc))
    _make_prediction(db, user.id, match.id, predicted_home=1, predicted_away=0)

    # User joined AFTER kickoff
    late_joined = datetime(2026, 6, 11, 0, 0, tzinfo=timezone.utc)
    _make_member(db, tournament.id, user.id, joined_at=late_joined)
    db.commit()

    update_provisional_points(db)

    db.expire_all()
    member = db.query(TournamentMember).filter_by(
        tournament_id=tournament.id, user_id=user.id
    ).first()
    assert member.provisional_points == 0


# ── 8. Multiple groups recalculated correctly ────────────────────────────────

def test_multiple_groups_recalculated_independently(db):
    _make_match(db, home="Brazil", away="Serbia", group="Group G",
                stage="group_stage", status="finished", home_score=2, away_score=0)
    _make_match(db, home="Switzerland", away="Cameroon", group="Group G",
                stage="group_stage", status="finished", home_score=1, away_score=0)
    _make_match(db, home="Portugal", away="Ghana", group="Group H",
                stage="group_stage", status="finished", home_score=3, away_score=2)
    db.commit()

    recalculate_standings_from_matches(db)

    g_rows = db.query(GroupStanding).filter(GroupStanding.group == "GROUP_G").all()
    h_rows = db.query(GroupStanding).filter(GroupStanding.group == "GROUP_H").all()

    assert len(g_rows) == 4  # Brazil, Serbia, Switzerland, Cameroon
    assert len(h_rows) == 2  # Portugal, Ghana

    g_by_team = {r.team_name: r for r in g_rows}
    assert g_by_team["Brazil"].won == 1
    assert g_by_team["Switzerland"].won == 1
    assert g_by_team["Serbia"].lost == 1

    h_by_team = {r.team_name: r for r in h_rows}
    assert h_by_team["Portugal"].won == 1
    assert h_by_team["Ghana"].lost == 1


# ── 9. sync_matches populates zeroed standings immediately ────────────────────

def test_sync_matches_populates_zeroed_standings(db):
    """After sync_matches, group_standings has rows for all teams with zero stats."""
    fake_fixtures = {
        "matches": [
            {
                "id": 1001,
                "utcDate": "2026-06-15T15:00:00Z",
                "status": "SCHEDULED",
                "stage": "GROUP_STAGE",
                "group": "GROUP_F",
                "homeTeam": {"name": "Brazil"},
                "awayTeam": {"name": "Serbia"},
                "score": {"fullTime": {"home": None, "away": None}},
            },
            {
                "id": 1002,
                "utcDate": "2026-06-15T18:00:00Z",
                "status": "SCHEDULED",
                "stage": "GROUP_STAGE",
                "group": "GROUP_F",
                "homeTeam": {"name": "Switzerland"},
                "awayTeam": {"name": "Cameroon"},
                "score": {"fullTime": {"home": None, "away": None}},
            },
        ]
    }

    mock_resp = MagicMock()
    mock_resp.is_success = True
    mock_resp.json.return_value = fake_fixtures

    with patch("app.services.football_api.httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_resp
        sync_matches(db)

    rows = db.query(GroupStanding).filter(GroupStanding.group == "GROUP_F").all()
    assert len(rows) == 4

    by_team = {r.team_name: r for r in rows}
    assert set(by_team.keys()) == {"Brazil", "Serbia", "Switzerland", "Cameroon"}
    for row in rows:
        assert row.played == 0
        assert row.won == 0
        assert row.points == 0
        assert row.goals_for == 0


# ── 10. Unplayed teams still appear after partial group results ───────────────

def test_recalculate_includes_unplayed_teams(db):
    """Teams with no finished games still appear in standings with zero stats."""
    # Group K: 4 teams, only one match played
    _make_match(db, home="Brazil",      away="Serbia",      group="Group K", status="scheduled")
    _make_match(db, home="Switzerland", away="Cameroon",    group="Group K", status="scheduled")
    played = _make_match(db, home="Brazil", away="Switzerland", group="Group K",
                         status="finished", home_score=2, away_score=0)
    db.commit()

    recalculate_standings_from_matches(db, group="Group K")

    rows = db.query(GroupStanding).filter(GroupStanding.group == "GROUP_K").all()
    by_team = {r.team_name: r for r in rows}

    # All four teams must appear
    assert set(by_team.keys()) == {"Brazil", "Switzerland", "Serbia", "Cameroon"}

    # Teams that played have correct stats
    assert by_team["Brazil"].won == 1
    assert by_team["Brazil"].points == 3
    assert by_team["Switzerland"].lost == 1

    # Teams that haven't played yet show zeros
    assert by_team["Serbia"].played == 0
    assert by_team["Serbia"].points == 0
    assert by_team["Cameroon"].played == 0
    assert by_team["Cameroon"].points == 0
