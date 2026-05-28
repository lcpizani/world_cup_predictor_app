import secrets
import string
from typing import List
from uuid import UUID

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.tournament import Tournament, TournamentScoringRules, TournamentMember
from app.models.user import User
from app.schemas.tournament import TournamentCreate
from app.schemas.leaderboard import LeaderboardResponse, LeaderboardEntry


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
    db.commit()
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
    tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    membership = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id, TournamentMember.user_id == user.id
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of tournament")
    return tournament


def list_user_tournaments(db: Session, user: User) -> List[Tournament]:
    members = db.query(TournamentMember).options(joinedload(TournamentMember.tournament)).filter(
        TournamentMember.user_id == user.id
    ).all()
    return [m.tournament for m in members]


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
