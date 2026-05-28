from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_admin_user
from app.logger import logger
from app.services import scoring as scoring_service
from app.services import football_api
from app.models.match import Match
from app.models.prediction import Prediction
from app.models.point_event import PointEvent
from app.models.tournament import TournamentMember

router = APIRouter()


@router.get("/registration-invite", status_code=status.HTTP_200_OK)
def get_registration_invite(admin=Depends(get_admin_user)) -> dict:
    """Returns the platform-level invite code for admin to share as a registration link."""
    return {"invite_code": settings.INVITE_CODE or ""}


@router.post("/tournaments/{tournament_id}/recompute", status_code=status.HTTP_200_OK)
def recompute_tournament_scores(
    tournament_id: UUID,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
) -> dict:
    logger.info("Recomputing tournament scores", tournament_id=str(tournament_id), admin=str(admin.id))
    try:
        result = scoring_service.recompute_tournament_scores(db, tournament_id)
    except HTTPException as exc:
        logger.error("Failed to recompute tournament scores", tournament_id=str(tournament_id), detail=exc.detail)
        raise
    logger.info("Tournament scores recomputed", tournament_id=str(tournament_id), result=result)
    return result


@router.delete("/matches/reset", status_code=status.HTTP_200_OK)
def reset_all_matches(
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
) -> dict:
    logger.warning("Resetting all matches, predictions, and point events", admin=str(admin.id))
    db.query(PointEvent).delete(synchronize_session=False)
    db.query(Prediction).delete(synchronize_session=False)
    db.query(Match).delete(synchronize_session=False)
    db.query(TournamentMember).update({"total_points": 0}, synchronize_session=False)
    db.commit()
    logger.info("All matches reset successfully")
    return {"ok": True}


@router.post("/sync/matches", status_code=status.HTTP_200_OK)
def sync_matches(
    competition_code: str = "WC",
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
) -> dict:
    logger.info("Syncing matches from football-data.org", competition_code=competition_code)
    try:
        result = football_api.sync_matches(db, competition_code)
    except HTTPException as exc:
        logger.error("Failed to sync matches", competition_code=competition_code, detail=exc.detail)
        raise
    logger.info("Matches synced", competition_code=competition_code, upserted=result.get("upserted"))
    return result


@router.post("/sync/results", status_code=status.HTTP_200_OK)
def sync_results(
    competition_code: str = "WC",
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
) -> dict:
    logger.info("Syncing results from football-data.org", competition_code=competition_code)
    try:
        result = football_api.sync_results(db, competition_code)
    except HTTPException as exc:
        logger.error("Failed to sync results", competition_code=competition_code, detail=exc.detail)
        raise
    logger.info("Results synced", competition_code=competition_code, scored=result.get("scored"))
    return result
