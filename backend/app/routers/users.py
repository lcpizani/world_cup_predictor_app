from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.dependencies import get_current_user
from app.limiter import limiter
from app.models.user import User
from app.models.tournament import TournamentMember
from app.models.prediction import Prediction
from app.models.match import Match
from app.schemas.user import UserResponse, UserUpdate, UserStatsResponse, PredictionHistoryItem

router = APIRouter()


@router.put("/me", response_model=UserResponse)
@limiter.limit("20/minute")
def update_me(request: Request, data: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.username is not None and data.username != current_user.username:
        taken = db.query(User).filter(User.username == data.username, User.id != current_user.id).first()
        if taken:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
        current_user.username = data.username
    if data.display_name is not None:
        current_user.display_name = data.display_name
    if data.language is not None:
        current_user.language = data.language
    if data.timezone is not None:
        current_user.timezone = data.timezone
    try:
        db.commit()
    except IntegrityError:
        # Lost the TOCTOU race against a concurrent rename — the DB unique
        # constraint is the source of truth, so report as a user-facing 400.
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
    db.refresh(current_user)
    return current_user


@router.get("/{username}", response_model=UserStatsResponse)
@limiter.limit("60/minute")
def get_profile(request: Request, username: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    tournaments_count = db.query(func.count(TournamentMember.id)).filter(
        TournamentMember.user_id == user.id
    ).scalar() or 0

    total_points = db.query(func.sum(TournamentMember.total_points)).filter(
        TournamentMember.user_id == user.id
    ).scalar() or 0

    return UserStatsResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        created_at=user.created_at,
        tournaments_count=tournaments_count,
        total_points=total_points,
    )


@router.get("/{username}/predictions", response_model=list[PredictionHistoryItem])
@limiter.limit("60/minute")
def get_predictions(request: Request, username: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    rows = (
        db.query(Prediction, Match)
        .join(Match, Prediction.match_id == Match.id)
        .filter(Prediction.user_id == user.id)
        .order_by(Match.kickoff_at.desc())
        .all()
    )

    is_self = current_user.id == user.id
    items: list[PredictionHistoryItem] = []
    for pred, match in rows:
        # Hide picks for unfinished matches from anyone but the owner —
        # otherwise the per-user predictions endpoint leaks spoilers and
        # defeats the in-tournament compare-view spoiler controls.
        hide_pick = (match.status != "finished") and not is_self
        items.append(PredictionHistoryItem(
            match_id=match.id,
            home_team=match.home_team,
            away_team=match.away_team,
            kickoff_at=match.kickoff_at,
            predicted_home=None if hide_pick else pred.predicted_home,
            predicted_away=None if hide_pick else pred.predicted_away,
            actual_home=match.home_score,
            actual_away=match.away_score,
            points_awarded=pred.points_awarded,
        ))
    return items
