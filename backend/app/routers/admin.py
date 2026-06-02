import uuid
from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_admin_user
from app.logger import logger
from app.services import scoring as scoring_service
from app.services import football_api
from app.services.football_api import FOOTBALL_API_BASE
from app.services.standings import recalculate_standings_from_matches
from app.services.scoring import update_provisional_points
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


@router.post("/standings/recalculate", status_code=status.HTTP_200_OK)
def recalculate_standings(
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
) -> dict:
    """Recompute all group standings from finished match results in the DB."""
    logger.info("Recalculating standings from match results", admin=str(admin.id))
    result = recalculate_standings_from_matches(db)
    logger.info("Standings recalculated", recalculated=result.get("recalculated"))
    return result


@router.post("/seed/live-match", status_code=status.HTTP_200_OK)
def seed_live_match(
    home_team: str = Body(...),
    away_team: str = Body(...),
    home_score: int = Body(...),
    away_score: int = Body(...),
    group: str = Body("Group A"),
    minute: int = Body(45),
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
) -> dict:
    """Seed a fake live match for testing the standings/points pipeline.

    Creates or updates a match row with status=live so the scheduler pipeline
    can be verified without a real football API key. After calling this, the
    next scheduler tick will update provisional points and standings — or you
    can call POST /admin/standings/recalculate and GET /standings immediately.
    """
    ext_id = f"seed-{home_team[:3].lower()}-{away_team[:3].lower()}"
    existing = db.query(Match).filter(Match.external_match_id == ext_id).first()
    if existing:
        existing.home_score = home_score
        existing.away_score = away_score
        existing.status = "live"
        existing.minute = minute
        db.add(existing)
        match = existing
    else:
        match = Match(
            id=uuid.uuid4(),
            external_match_id=ext_id,
            home_team=home_team,
            away_team=away_team,
            kickoff_at=datetime.now(timezone.utc),
            stage="group_stage",
            group=group,
            status="live",
            home_score=home_score,
            away_score=away_score,
            minute=minute,
        )
        db.add(match)

    db.commit()

    recalculate_standings_from_matches(db)
    update_provisional_points(db)

    logger.info("Seeded live match", home=home_team, away=away_team,
                score=f"{home_score}-{away_score}", group=group)
    return {
        "match_id": str(match.id),
        "home_team": home_team,
        "away_team": away_team,
        "score": f"{home_score}-{away_score}",
        "group": group,
        "status": "live",
    }


@router.post("/seed/finish-match", status_code=status.HTTP_200_OK)
def seed_finish_match(
    home_team: str = Body(...),
    away_team: str = Body(...),
    home_score: int = Body(...),
    away_score: int = Body(...),
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
) -> dict:
    """Mark the seeded live match as finished and run scoring."""
    ext_id = f"seed-{home_team[:3].lower()}-{away_team[:3].lower()}"
    match = db.query(Match).filter(Match.external_match_id == ext_id).first()
    if match is None:
        raise HTTPException(status_code=404, detail="Seeded match not found — call /seed/live-match first")
    if match.status == "finished":
        raise HTTPException(status_code=400, detail="Match already finished")

    scoring_service.apply_match_result(db, match.id, home_score, away_score, status="finished")
    recalculate_standings_from_matches(db)

    logger.info("Finished seeded match", home=home_team, away=away_team,
                score=f"{home_score}-{away_score}")
    return {"match_id": str(match.id), "final_score": f"{home_score}-{away_score}", "status": "finished"}


