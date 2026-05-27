from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_admin_user, get_current_user
from app.services import match as match_service
from app.services import scoring as scoring_service
from app.schemas.match import MatchCreate, MatchResponse, MatchResultUpdate

router = APIRouter()


@router.post("/", response_model=MatchResponse, status_code=status.HTTP_201_CREATED)
def create_match(data: MatchCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return match_service.create_match(db, data)


@router.get("/", response_model=List[MatchResponse])
def list_matches(
    stage: Optional[str] = None,
    match_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return match_service.list_matches(db, stage=stage, status=match_status)


@router.get("/{match_id}", response_model=MatchResponse)
def get_match(match_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return match_service.get_match(db, match_id)


@router.put("/{match_id}/result", response_model=MatchResponse)
def apply_result(
    match_id: UUID,
    data: MatchResultUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    return scoring_service.apply_match_result(
        db, match_id, data.home_score, data.away_score, applied_by=current_user, status=data.status
    )
