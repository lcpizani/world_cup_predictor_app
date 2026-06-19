from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_admin_user, get_current_user
from app.limiter import limiter
from app.logger import logger
from app.models.match import Match
from app.services import match as match_service
from app.services import scoring as scoring_service
from app.services import calendar as calendar_service
from app.services import email as email_service
from app.schemas.match import MatchCreate, MatchResponse, MatchResultUpdate, CrowdWisdom


_SUPPORTED_LOCALES = {"en", "pt"}


class CalendarEmailRequest(BaseModel):
    match_ids: List[str] = Field(max_length=200)
    locale: str = "en"

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, v: str) -> str:
        return v if v in _SUPPORTED_LOCALES else "en"

router = APIRouter()


@router.get("/calendar.ics")
def download_calendar(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    matches = (
        db.query(Match)
        .filter(Match.kickoff_at > now, Match.status == "scheduled")
        .order_by(Match.kickoff_at.asc())
        .all()
    )
    ics_bytes = calendar_service.generate_fixtures_ics(matches)
    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="wc2026-fixtures.ics"'},
    )


@router.post("/calendar/email", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/hour")
def email_calendar(
    request: Request,
    data: CalendarEmailRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not data.match_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No match IDs provided")

    try:
        ids_as_uuid = [UUID(mid) for mid in data.match_ids]
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid match ID format")

    matches = (
        db.query(Match)
        .filter(Match.id.in_(ids_as_uuid))
        .order_by(Match.kickoff_at.asc())
        .all()
    )
    if not matches:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No matches found")

    ics_bytes = calendar_service.generate_fixtures_ics(matches, locale=data.locale)
    try:
        email_service.send_calendar_email(current_user.email, matches, ics_bytes, locale=data.locale)
    except Exception as exc:
        logger.error("Calendar email failed", user_id=str(current_user.id), error=str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to send email")


@router.post("", response_model=MatchResponse, status_code=status.HTTP_201_CREATED)
def create_match(data: MatchCreate, db: Session = Depends(get_db), current_user=Depends(get_admin_user)):
    try:
        result = match_service.create_match(db, data)
    except HTTPException as exc:
        logger.error("Failed to create match", home_team=data.home_team, away_team=data.away_team, detail=exc.detail)
        raise
    logger.info("Match created", match_id=str(result.id), home_team=data.home_team, away_team=data.away_team)
    return result


@router.get("", response_model=List[MatchResponse])
def list_matches(
    stage: Optional[str] = None,
    match_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return match_service.list_matches(db, stage=stage, status=match_status)


@router.get("/{match_id}", response_model=MatchResponse)
def get_match(match_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        result = match_service.get_match(db, match_id)
    except HTTPException as exc:
        logger.error("Match not found", match_id=str(match_id), detail=exc.detail)
        raise
    return result


@router.get("/{match_id}/crowd-wisdom", response_model=CrowdWisdom)
def get_crowd_wisdom(match_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return match_service.get_crowd_wisdom(db, match_id, current_user)


@router.put("/{match_id}/result", response_model=MatchResponse)
def apply_result(
    match_id: UUID,
    data: MatchResultUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    try:
        result = scoring_service.apply_match_result(
            db, match_id, data.home_score, data.away_score, applied_by=current_user, status=data.status
        )
    except HTTPException as exc:
        logger.error("Failed to apply match result", match_id=str(match_id), detail=exc.detail)
        raise
    logger.info("Match result applied", match_id=str(match_id), home_score=data.home_score, away_score=data.away_score)
    return result
