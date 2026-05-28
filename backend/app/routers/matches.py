from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_admin_user, get_current_user
from app.logger import logger
from app.services import match as match_service
from app.services import scoring as scoring_service
from app.schemas.match import MatchCreate, MatchResponse, MatchResultUpdate

router = APIRouter()


@router.post("", response_model=MatchResponse, status_code=status.HTTP_201_CREATED)
def create_match(data: MatchCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
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
