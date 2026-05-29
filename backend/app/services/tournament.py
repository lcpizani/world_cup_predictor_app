import secrets
import string
from typing import List
from uuid import UUID

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
from app.schemas.leaderboard import LeaderboardResponse, LeaderboardEntry


def _apply_spoiler(is_finished: bool, is_own: bool, predicted_home: int, predicted_away: int):
    """Return (predicted_home, predicted_away) with spoiler rule applied."""
    if is_finished or is_own:
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

    members = (
        db.query(TournamentMember)
        .filter(TournamentMember.tournament_id == tournament.id)
        .options(joinedload(TournamentMember.user))
        .all()
    )

    # sort by total_points desc
    members_sorted = sorted(members, key=lambda m: m.total_points, reverse=True)

    entries = []
    last_points = None
    last_rank = 0
    for idx, m in enumerate(members_sorted, start=1):
        if last_points is None or m.total_points != last_points:
            rank = idx
            last_rank = rank
        else:
            rank = last_rank
        last_points = m.total_points
        entries.append(LeaderboardEntry(rank=rank, user=m.user, total_points=m.total_points))

    return LeaderboardResponse(tournament_id=tournament.id, entries=entries)


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
