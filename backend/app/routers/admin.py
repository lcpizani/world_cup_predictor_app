from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_admin_user
from app.services import scoring as scoring_service
from app.services import football_api
from app.models.match import Match
from app.models.prediction import Prediction
from app.models.point_event import PointEvent
from app.models.tournament import TournamentMember

router = APIRouter()


@router.post("/tournaments/{tournament_id}/recompute", status_code=status.HTTP_200_OK)
def recompute_tournament_scores(
    tournament_id: UUID,
    db: Session = Depends(get_db),
    _: object = Depends(get_admin_user),
) -> dict:
    return scoring_service.recompute_tournament_scores(db, tournament_id)


@router.delete("/matches/reset", status_code=status.HTTP_200_OK)
def reset_all_matches(
    db: Session = Depends(get_db),
    _: object = Depends(get_admin_user),
) -> dict:
    """Delete all matches, predictions, and point events. Reset leaderboard points."""
    db.query(PointEvent).delete(synchronize_session=False)
    db.query(Prediction).delete(synchronize_session=False)
    db.query(Match).delete(synchronize_session=False)
    db.query(TournamentMember).update({"total_points": 0}, synchronize_session=False)
    db.commit()
    return {"ok": True}


@router.post("/sync/matches", status_code=status.HTTP_200_OK)
def sync_matches(
    competition_code: str = "WC",
    db: Session = Depends(get_db),
    _: object = Depends(get_admin_user),
) -> dict:
    """Fetch upcoming fixtures from football-data.org and upsert Match rows."""
    return football_api.sync_matches(db, competition_code)


@router.post("/sync/results", status_code=status.HTTP_200_OK)
def sync_results(
    competition_code: str = "WC",
    db: Session = Depends(get_db),
    _: object = Depends(get_admin_user),
) -> dict:
    """Fetch finished fixtures from football-data.org and score un-scored matches."""
    return football_api.sync_results(db, competition_code)
