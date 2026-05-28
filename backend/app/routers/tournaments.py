from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.logger import logger
from app.services import tournament as tournament_service
from app.schemas.tournament import TournamentCreate, TournamentResponse, TournamentMemberResponse, JoinTournamentRequest
from app.schemas.leaderboard import LeaderboardResponse

router = APIRouter()


@router.post("", response_model=TournamentResponse, status_code=status.HTTP_201_CREATED)
def create_tournament(data: TournamentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        result = tournament_service.create_tournament(db, data, current_user)
    except HTTPException as exc:
        logger.error("Failed to create tournament", user_id=str(current_user.id), detail=exc.detail)
        raise
    logger.info("Tournament created", tournament_id=str(result.id), user_id=str(current_user.id))
    return result


@router.get("", response_model=List[TournamentResponse])
def list_tournaments(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.list_user_tournaments(db, current_user)


@router.post("/join", response_model=TournamentMemberResponse, status_code=status.HTTP_201_CREATED)
def join(request: JoinTournamentRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        result = tournament_service.join_tournament(db, request.invite_code, current_user)
    except HTTPException as exc:
        logger.warning("Failed to join tournament", user_id=str(current_user.id), detail=exc.detail)
        raise
    logger.info("User joined tournament", user_id=str(current_user.id), tournament_id=str(result.tournament_id))
    return result


@router.get("/{invite_code}/leaderboard", response_model=LeaderboardResponse)
def leaderboard(invite_code: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.get_leaderboard_by_code(db, invite_code, current_user)


@router.get("/{invite_code}", response_model=TournamentResponse)
def get_tournament(invite_code: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        result = tournament_service.get_tournament_by_code(db, invite_code, current_user)
    except HTTPException as exc:
        logger.error("Tournament not found or access denied", invite_code=invite_code, user_id=str(current_user.id), detail=exc.detail)
        raise
    return result
