import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.match import Match
from app.models.point_event import PointEvent
from app.models.prediction import Prediction
from app.models.tournament import Tournament, TournamentScoringRules, TournamentMember
from app.models.user import User
from app.schemas.match import MatchResponse
from app.schemas.tournament import TournamentCreate, TournamentComparePrediction, TournamentCompareMatch
from app.schemas.leaderboard import (
    LeaderboardResponse, LeaderboardEntry,
    LiveLeaderboardResponse, LiveLeaderboardEntry,
    RankingHistoryResponse, RankingHistorySeries, RankingHistoryUser,
)
from app.schemas.prediction_stats import (
    PredictionStatsResponse, GameStatEntry, GameStatMatch, PlayerStatEntry, PredictionStatsUser,
)
from app.models.match import Match as MatchModel

RANK_DELTA_WINDOW_MINUTES = 30
SESSION_LOOKBACK_HOURS = 2


def _apply_spoiler(is_finished: bool, is_own: bool, predicted_home: int, predicted_away: int, is_live: bool = False):
    """Return (predicted_home, predicted_away) with spoiler rule applied."""
    if is_finished or is_own or is_live:
        return predicted_home, predicted_away
    return None, None


def _generate_invite_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def create_tournament(db: Session, data: TournamentCreate, creator: User) -> Tournament:
    # ensure unique invite code
    while True:
        code = _generate_invite_code()
        if not db.query(Tournament).filter(Tournament.invite_code == code).first():
            break

    tournament = Tournament(name=data.name, created_by=creator.id, invite_code=code)
    db.add(tournament)
    db.flush()

    rules = TournamentScoringRules(
        tournament_id=tournament.id,
        correct_result_pts=data.scoring_rules.correct_result_pts,
        correct_winner_pts=data.scoring_rules.correct_winner_pts,
        correct_goal_diff_pts=data.scoring_rules.correct_goal_diff_pts,
        correct_goals_one_team_pts=data.scoring_rules.correct_goals_one_team_pts,
    )
    db.add(rules)

    member = TournamentMember(tournament_id=tournament.id, user_id=creator.id, total_points=0)
    db.add(member)

    db.commit()
    db.refresh(tournament)
    return tournament


def join_tournament(db: Session, invite_code: str, user: User) -> TournamentMember:
    tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if not tournament.is_active:
        raise HTTPException(status_code=400, detail="Tournament is not active")
    existing = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id, TournamentMember.user_id == user.id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already a member")
    member = TournamentMember(tournament_id=tournament.id, user_id=user.id, total_points=0)
    db.add(member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Already a member")
    db.refresh(member)
    return member


def get_tournament(db: Session, tournament_id: UUID, user: User) -> Tournament:
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    membership = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id, TournamentMember.user_id == user.id
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of tournament")
    return tournament


def get_tournament_by_code(db: Session, invite_code: str, user: User) -> Tournament:
    tournament = db.query(Tournament).options(joinedload(Tournament.creator)).filter(Tournament.invite_code == invite_code).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    membership = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id, TournamentMember.user_id == user.id
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of tournament")
    return tournament


def list_user_tournaments(db: Session, user: User) -> List[Tournament]:
    members = (
        db.query(TournamentMember)
        .options(joinedload(TournamentMember.tournament).joinedload(Tournament.creator))
        .filter(TournamentMember.user_id == user.id)
        .all()
    )
    return [m.tournament for m in members]


def delete_tournament(db: Session, invite_code: str, user: User) -> None:
    tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.created_by != user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete this tournament")
    db.delete(tournament)
    db.commit()


def _world_cup_started(db: Session) -> bool:
    """True once any match has kicked off (gone live or finished)."""
    return (
        db.query(Match.id)
        .filter(Match.status.in_(("live", "halftime", "finished")))
        .first()
    ) is not None


def _group_stage_complete(db: Session) -> bool:
    """True once every group-stage match has finished (knockouts about to begin)."""
    group_q = db.query(Match).filter(Match.stage == "group_stage")
    total = group_q.count()
    if total == 0:
        return False
    remaining = group_q.filter(Match.status != "finished").count()
    return remaining == 0


def update_tournament(db: Session, invite_code: str, data, user: User) -> Tournament:
    tournament = db.query(Tournament).options(joinedload(Tournament.creator)).filter(
        Tournament.invite_code == invite_code
    ).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.created_by != user.id:
        raise HTTPException(status_code=403, detail="Only the creator can update this tournament")

    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        tournament.name = name

    if data.scoring_rules is not None:
        scoring = db.query(TournamentScoringRules).filter(
            TournamentScoringRules.tournament_id == tournament.id
        ).first()
        if scoring is None:
            raise HTTPException(status_code=404, detail="Scoring rules not found")

        rules = data.scoring_rules
        provided = rules.model_dump(exclude_unset=True)

        # Only fields whose value actually differs from what's stored count as a
        # change. This lets the frontend resend the whole scoring object while a
        # field is locked, as long as it isn't trying to alter that field.
        point_fields = (
            "correct_result_pts",
            "correct_winner_pts",
            "correct_goal_diff_pts",
            "correct_goals_one_team_pts",
        )
        changing_point_values = any(
            field in provided
            and provided[field] is not None
            and provided[field] != getattr(scoring, field)
            for field in point_fields
        )
        changing_double = (
            "double_points_from_stage" in provided
            and provided["double_points_from_stage"] != scoring.double_points_from_stage
        )

        # Point values freeze the moment the tournament kicks off. The 2x
        # multiplier stays editable through the group stage (the feature ships
        # close to kickoff) but locks once the group stage is complete — before
        # any knockout match it could affect is played.
        if changing_point_values and _world_cup_started(db):
            raise HTTPException(
                status_code=400,
                detail="Scoring values can no longer be changed once the World Cup has started",
            )
        if changing_double and _group_stage_complete(db):
            raise HTTPException(
                status_code=400,
                detail="Double points can no longer be changed once the group stage is over",
            )

        for field in point_fields:
            if field in provided and provided[field] is not None:
                setattr(scoring, field, provided[field])
        # double_points_from_stage may be explicitly set to None to clear it
        if "double_points_from_stage" in provided:
            scoring.double_points_from_stage = rules.double_points_from_stage
        db.add(scoring)

    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


def list_members(db: Session, invite_code: str, user: User) -> List[TournamentMember]:
    tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    membership = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id, TournamentMember.user_id == user.id
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of tournament")
    return (
        db.query(TournamentMember)
        .filter(TournamentMember.tournament_id == tournament.id)
        .options(joinedload(TournamentMember.user))
        .order_by(TournamentMember.joined_at)
        .all()
    )


def remove_member(db: Session, invite_code: str, member_user_id: UUID, user: User) -> None:
    tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.created_by != user.id:
        raise HTTPException(status_code=403, detail="Only the creator can remove members")
    if member_user_id == tournament.created_by:
        raise HTTPException(status_code=400, detail="The creator cannot be removed")

    member = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id,
        TournamentMember.user_id == member_user_id,
    ).first()
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(member)
    db.commit()


def transfer_ownership(db: Session, invite_code: str, new_owner_user_id: UUID, user: User) -> Tournament:
    tournament = db.query(Tournament).options(joinedload(Tournament.creator)).filter(
        Tournament.invite_code == invite_code
    ).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.created_by != user.id:
        raise HTTPException(status_code=403, detail="Only the creator can transfer ownership")
    if new_owner_user_id == tournament.created_by:
        raise HTTPException(status_code=400, detail="That user is already the creator")

    new_owner_membership = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id,
        TournamentMember.user_id == new_owner_user_id,
    ).first()
    if new_owner_membership is None:
        raise HTTPException(status_code=404, detail="New owner must be a member of the tournament")

    tournament.created_by = new_owner_user_id
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


def _compute_session_points(
    db: Session, tournament_id: UUID
) -> Tuple[dict, Optional[datetime]]:
    """Return (session_pts_by_user_id, last_event_time) for the most recent scoring session.

    A session is all PointEvents within SESSION_LOOKBACK_HOURS of the most recent event.
    Returns empty dict and None if no PointEvents exist for this tournament.
    """
    last_event_time = db.query(func.max(PointEvent.created_at)).filter(
        PointEvent.tournament_id == tournament_id
    ).scalar()

    if last_event_time is None:
        return {}, None

    session_start = last_event_time - timedelta(hours=SESSION_LOOKBACK_HOURS)

    rows = (
        db.query(PointEvent.user_id, func.sum(PointEvent.points))
        .filter(
            PointEvent.tournament_id == tournament_id,
            PointEvent.created_at >= session_start,
        )
        .group_by(PointEvent.user_id)
        .all()
    )

    return {user_id: total for user_id, total in rows}, last_event_time


def _compute_exact_scores(db: Session, tournament_id: UUID, member_user_ids: list) -> dict:
    """Return {user_id: exact_score_count} for finished matches the user was eligible for.

    Eligibility mirrors get_compare: predictions for matches that kicked off before
    the user joined this tournament don't count.
    """
    if not member_user_ids:
        return {}
    rows = (
        db.query(Prediction.user_id, func.count().label("cnt"))
        .join(Match, Prediction.match_id == Match.id)
        .join(
            TournamentMember,
            (TournamentMember.user_id == Prediction.user_id)
            & (TournamentMember.tournament_id == tournament_id),
        )
        .filter(
            Prediction.user_id.in_(member_user_ids),
            Match.status == "finished",
            Prediction.predicted_home == Match.home_score,
            Prediction.predicted_away == Match.away_score,
            TournamentMember.joined_at <= Match.kickoff_at,
        )
        .group_by(Prediction.user_id)
        .all()
    )
    return {user_id: cnt for user_id, cnt in rows}


def _dense_rank(members_sorted_by_score: list, score_fn) -> dict:
    """Return {member: rank} using dense ranking (ties share the same rank)."""
    ranks = {}
    last_score = None
    last_rank = 0
    for idx, m in enumerate(members_sorted_by_score, start=1):
        score = score_fn(m)
        if last_score is None or score != last_score:
            last_rank = idx
        ranks[m] = last_rank
        last_score = score
    return ranks


def get_leaderboard_by_code(db: Session, invite_code: str, user: User) -> LeaderboardResponse:
    tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return get_leaderboard(db, tournament.id, user)


def get_leaderboard(db: Session, tournament_id: UUID, user: User) -> LeaderboardResponse:
    # verify tournament and membership
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    membership = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id, TournamentMember.user_id == user.id
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of tournament")

    has_live = db.query(MatchModel).filter(MatchModel.status.in_(("live", "halftime"))).first() is not None

    members = (
        db.query(TournamentMember)
        .filter(TournamentMember.tournament_id == tournament.id)
        .options(joinedload(TournamentMember.user))
        .all()
    )

    session_pts, last_event_time = _compute_session_points(db, tournament_id)
    now = datetime.now(timezone.utc)
    if last_event_time is not None and last_event_time.tzinfo is None:
        last_event_time = last_event_time.replace(tzinfo=timezone.utc)
    show_rank_change = has_live or (
        last_event_time is not None
        and (now - last_event_time) < timedelta(minutes=RANK_DELTA_WINDOW_MINUTES)
    )

    user_ids = [m.user_id for m in members]
    exact_scores = _compute_exact_scores(db, tournament_id, user_ids)

    pre_pts: dict = {m.user_id: (m.total_points - session_pts.get(m.user_id, 0)) for m in members}
    members_by_pre = sorted(
        members,
        key=lambda m: (pre_pts[m.user_id], exact_scores.get(m.user_id, 0)),
        reverse=True,
    )
    pre_positions = {m.user_id: i for i, m in enumerate(members_by_pre, start=1)}

    members_sorted = sorted(
        members,
        key=lambda m: (m.total_points + m.provisional_points, exact_scores.get(m.user_id, 0)),
        reverse=True,
    )
    current_ranks = _dense_rank(
        members_sorted,
        lambda m: (m.total_points + m.provisional_points, exact_scores.get(m.user_id, 0)),
    )

    entries = []
    for i, m in enumerate(members_sorted, start=1):
        live_total = m.total_points + m.provisional_points
        rank = current_ranks[m]
        rank_delta = pre_positions[m.user_id] - i
        entries.append(LeaderboardEntry(
            rank=rank,
            user=m.user,
            total_points=m.total_points,
            provisional_points=m.provisional_points,
            live_total=live_total,
            rank_delta=rank_delta,
            exact_scores=exact_scores.get(m.user_id, 0),
        ))

    return LeaderboardResponse(
        tournament_id=tournament.id,
        has_live_matches=has_live,
        show_rank_change=show_rank_change,
        entries=entries,
    )


def get_live_leaderboard(db: Session, invite_code: str, user: User) -> LiveLeaderboardResponse:
    tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    membership = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id, TournamentMember.user_id == user.id
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of tournament")

    has_live = db.query(MatchModel).filter(MatchModel.status.in_(("live", "halftime"))).first() is not None

    members = (
        db.query(TournamentMember)
        .filter(TournamentMember.tournament_id == tournament.id)
        .options(joinedload(TournamentMember.user))
        .all()
    )

    session_pts, last_event_time = _compute_session_points(db, tournament.id)
    now = datetime.now(timezone.utc)
    if last_event_time is not None and last_event_time.tzinfo is None:
        last_event_time = last_event_time.replace(tzinfo=timezone.utc)
    show_rank_change = has_live or (
        last_event_time is not None
        and (now - last_event_time) < timedelta(minutes=RANK_DELTA_WINDOW_MINUTES)
    )

    user_ids = [m.user_id for m in members]
    exact_scores = _compute_exact_scores(db, tournament.id, user_ids)

    pre_pts = {m.user_id: (m.total_points - session_pts.get(m.user_id, 0)) for m in members}
    members_by_pre = sorted(
        members,
        key=lambda m: (pre_pts[m.user_id], exact_scores.get(m.user_id, 0)),
        reverse=True,
    )
    pre_positions = {m.user_id: i for i, m in enumerate(members_by_pre, start=1)}

    members_sorted = sorted(
        members,
        key=lambda m: (m.total_points + m.provisional_points, exact_scores.get(m.user_id, 0)),
        reverse=True,
    )
    current_ranks = _dense_rank(
        members_sorted,
        lambda m: (m.total_points + m.provisional_points, exact_scores.get(m.user_id, 0)),
    )

    entries = []
    for i, m in enumerate(members_sorted, start=1):
        live_total = m.total_points + m.provisional_points
        rank = current_ranks[m]
        rank_delta = pre_positions[m.user_id] - i
        entries.append(LiveLeaderboardEntry(
            rank=rank,
            user=m.user,
            total_points=m.total_points,
            provisional_points=m.provisional_points,
            live_total=live_total,
            rank_delta=rank_delta,
            exact_scores=exact_scores.get(m.user_id, 0),
        ))

    return LiveLeaderboardResponse(
        tournament_id=tournament.id,
        has_live_matches=has_live,
        show_rank_change=show_rank_change,
        entries=entries,
    )


def get_ranking_history(db: Session, invite_code: str, user: User) -> RankingHistoryResponse:
    tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    membership = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id,
        TournamentMember.user_id == user.id,
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of tournament")

    members = (
        db.query(TournamentMember)
        .filter(TournamentMember.tournament_id == tournament.id)
        .options(joinedload(TournamentMember.user))
        .order_by(TournamentMember.joined_at)
        .all()
    )

    # Per-day point deltas grouped by match kickoff date (not scoring date)
    rows = (
        db.query(
            PointEvent.user_id,
            func.date(Match.kickoff_at).label("match_day"),
            func.sum(PointEvent.points).label("day_points"),
        )
        .join(Match, PointEvent.match_id == Match.id)
        .filter(PointEvent.tournament_id == tournament.id)
        .group_by(PointEvent.user_id, func.date(Match.kickoff_at))
        .order_by(func.date(Match.kickoff_at))
        .all()
    )

    if not rows:
        return RankingHistoryResponse(match_days=[], series=[])

    all_days = sorted({row.match_day for row in rows})

    user_day_deltas: dict = {m.user_id: {} for m in members}
    for row in rows:
        if row.user_id in user_day_deltas:
            user_day_deltas[row.user_id][row.match_day] = int(row.day_points)

    # Cumulative points per user per day (carry-forward for days with no events)
    cumulative: dict = {}
    for uid, day_map in user_day_deltas.items():
        running = 0
        cumulative[uid] = {}
        for day in all_days:
            running += day_map.get(day, 0)
            cumulative[uid][day] = running

    # Dense rank all users on each match day; also collect cumulative points
    series_ranks: dict = {m.user_id: [] for m in members}
    series_points: dict = {m.user_id: [] for m in members}
    for day in all_days:
        day_scores = sorted(
            [(uid, cumulative[uid][day]) for uid in cumulative],
            key=lambda x: x[1],
            reverse=True,
        )
        last_score: int | None = None
        last_rank = 0
        ranks: dict = {}
        for idx, (uid, score) in enumerate(day_scores, start=1):
            if score != last_score:
                last_rank = idx
            ranks[uid] = last_rank
            last_score = score
        for uid in series_ranks:
            series_ranks[uid].append(ranks[uid])
            series_points[uid].append(cumulative[uid][day])

    series = [
        RankingHistorySeries(
            user=RankingHistoryUser(
                id=m.user.id,
                username=m.user.username,
                display_name=m.user.display_name,
            ),
            ranks=series_ranks[m.user_id],
            points=series_points[m.user_id],
            is_current_user=(m.user_id == user.id),
        )
        for m in members
    ]

    return RankingHistoryResponse(
        match_days=[str(d) for d in all_days],
        series=series,
    )


def get_compare(db: Session, invite_code: str, current_user: User) -> List[TournamentCompareMatch]:
    tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    membership = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id,
        TournamentMember.user_id == current_user.id,
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of tournament")

    members = (
        db.query(TournamentMember)
        .filter(TournamentMember.tournament_id == tournament.id)
        .options(joinedload(TournamentMember.user))
        .all()
    )
    member_user_ids = [m.user_id for m in members]

    # Load all predictions for tournament members in one query
    predictions = db.query(Prediction).filter(Prediction.user_id.in_(member_user_ids)).all()
    pred_by_user_match = {(p.user_id, p.match_id): p for p in predictions}

    # Sum points per (user_id, match_id) for this tournament
    point_events = (
        db.query(PointEvent)
        .filter(PointEvent.tournament_id == tournament.id)
        .all()
    )
    points_by_user_match: dict = {}
    for pe in point_events:
        key = (pe.user_id, pe.match_id)
        points_by_user_match[key] = points_by_user_match.get(key, 0) + pe.points

    matches = db.query(Match).order_by(Match.kickoff_at).all()

    result = []
    for match in matches:
        is_finished = match.status == "finished"
        is_live = match.status in ("live", "halftime")
        entries = []
        for member in members:
            # Snapshot-at-join: predictions for matches that kicked off before
            # this member joined the tournament don't count and aren't shown.
            # Their global prediction may exist (they're in another league) but
            # within this league they joined too late to participate.
            eligible_here = member.joined_at <= match.kickoff_at
            pred = pred_by_user_match.get((member.user_id, match.id))
            if pred is not None and eligible_here:
                ph, pa = _apply_spoiler(
                    is_finished,
                    member.user_id == current_user.id,
                    pred.predicted_home,
                    pred.predicted_away,
                    is_live=is_live,
                )
            else:
                ph, pa = None, None
            pts = points_by_user_match.get((member.user_id, match.id)) if (is_finished and eligible_here) else None
            entries.append(TournamentComparePrediction(
                user_id=member.user_id,
                username=member.user.username,
                predicted_home=ph,
                predicted_away=pa,
                points_awarded=pts,
            ))
        result.append(TournamentCompareMatch(
            match=MatchResponse.model_validate(match),
            predictions=entries,
        ))

    return result


def _outcome(home: int, away: int) -> int:
    if home > away:
        return 1
    if home < away:
        return -1
    return 0


def get_prediction_stats(db: Session, invite_code: str, user: User) -> PredictionStatsResponse:
    tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    membership = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id, TournamentMember.user_id == user.id
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of tournament")

    members = (
        db.query(TournamentMember)
        .filter(TournamentMember.tournament_id == tournament.id)
        .options(joinedload(TournamentMember.user))
        .all()
    )
    member_ids = {m.user_id for m in members}
    member_joined_at = {m.user_id: m.joined_at for m in members}

    # Fetch all predictions for league members that have been scored
    predictions = (
        db.query(Prediction)
        .join(MatchModel, Prediction.match_id == MatchModel.id)
        .filter(
            Prediction.user_id.in_(member_ids),
            Prediction.points_awarded.isnot(None),
            MatchModel.status == "finished",
            MatchModel.home_score.isnot(None),
            MatchModel.away_score.isnot(None),
        )
        .options(joinedload(Prediction.match))
        .all()
    )

    # Group predictions by match_id, respecting joined_at eligibility
    from collections import defaultdict
    by_match: dict = defaultdict(list)
    for pred in predictions:
        joined = member_joined_at.get(pred.user_id)
        if joined is not None and joined <= pred.match.kickoff_at:
            by_match[pred.match_id].append(pred)

    # Build game stats — only matches with >1 qualifying prediction
    game_stats: list[GameStatEntry] = []
    for match_id, preds in by_match.items():
        if len(preds) <= 1:
            continue
        match = preds[0].match
        actual_outcome = _outcome(match.home_score, match.away_score)
        hits = 0
        exacts = 0
        total_pts = 0
        for p in preds:
            total_pts += p.points_awarded
            if _outcome(p.predicted_home, p.predicted_away) == actual_outcome:
                hits += 1
            if p.predicted_home == match.home_score and p.predicted_away == match.away_score:
                exacts += 1
        count = len(preds)
        game_stats.append(GameStatEntry(
            match=GameStatMatch(
                id=match.id,
                home_team=match.home_team,
                away_team=match.away_team,
                home_score=match.home_score,
                away_score=match.away_score,
                stage=match.stage,
                kickoff_at=match.kickoff_at.isoformat(),
            ),
            avg_points=round(total_pts / count, 2),
            hit_rate=round(hits / count, 4),
            exact_rate=round(exacts / count, 4),
            prediction_count=count,
        ))

    # Build player stats for all members
    pts_by_user: dict = defaultdict(int)
    games_by_user: dict = defaultdict(int)
    for pred in predictions:
        joined = member_joined_at.get(pred.user_id)
        if joined is not None and joined <= pred.match.kickoff_at:
            pts_by_user[pred.user_id] += pred.points_awarded
            games_by_user[pred.user_id] += 1

    player_stats: list[PlayerStatEntry] = []
    for m in members:
        total = pts_by_user.get(m.user_id, 0)
        games = games_by_user.get(m.user_id, 0)
        player_stats.append(PlayerStatEntry(
            user=PredictionStatsUser(
                id=m.user.id,
                username=m.user.username,
                display_name=m.user.display_name,
                avatar_url=m.user.avatar_url,
            ),
            total_points=total,
            games_predicted=games,
            avg_points_per_game=round(total / games, 2) if games > 0 else 0.0,
        ))

    return PredictionStatsResponse(game_stats=game_stats, player_stats=player_stats)
