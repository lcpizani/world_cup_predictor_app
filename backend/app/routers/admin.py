from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_admin_user
from app.logger import logger
from app.services import scoring as scoring_service
from app.services import football_api
from app.services.football_api import FOOTBALL_API_BASE
from app.models.match import Match
from app.models.prediction import Prediction
from app.models.point_event import PointEvent
from app.models.tournament import TournamentMember

router = APIRouter()


@router.get("/sync/health", status_code=status.HTTP_200_OK)
def sync_health(admin=Depends(get_admin_user)) -> dict:
    """Verify football-data.org API key is valid and return rate-limit metadata."""
    if not settings.FOOTBALL_API_KEY:
        raise HTTPException(status_code=503, detail="FOOTBALL_API_KEY not configured")
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                f"{FOOTBALL_API_BASE}/competitions/WC",
                headers={"X-Auth-Token": settings.FOOTBALL_API_KEY},
            )
    except httpx.RequestError as exc:
        logger.error("Football API health check network error", error=str(exc))
        raise HTTPException(status_code=503, detail=f"Network error: {exc}")

    if not resp.is_success:
        logger.warning("Football API health check failed", status_code=resp.status_code)
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"football-data.org returned {resp.status_code}",
        )

    return {
        "status": "ok",
        "rate_limit_remaining": resp.headers.get("X-Requests-Available-Minute"),
        "rate_limit_reset": resp.headers.get("X-RequestCounter-Reset"),
    }


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


@router.post("/sync/standings", status_code=status.HTTP_200_OK)
def sync_standings(
    competition_code: str = "WC",
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
) -> dict:
    logger.info("Syncing standings from football-data.org", competition_code=competition_code)
    try:
        result = football_api.sync_standings(db, competition_code)
    except HTTPException as exc:
        logger.error("Failed to sync standings", competition_code=competition_code, detail=exc.detail)
        raise
    logger.info("Standings synced", competition_code=competition_code, synced=result.get("synced"))
    return result
