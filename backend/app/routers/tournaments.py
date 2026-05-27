from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.services import tournament as tournament_service
from app.schemas.tournament import TournamentCreate, TournamentResponse, TournamentMemberResponse, JoinTournamentRequest
from app.schemas.leaderboard import LeaderboardResponse

router = APIRouter()


@router.post("/", response_model=TournamentResponse, status_code=status.HTTP_201_CREATED)
def create_tournament(data: TournamentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.create_tournament(db, data, current_user)


@router.get("/", response_model=List[TournamentResponse])
def list_tournaments(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.list_user_tournaments(db, current_user)


@router.post("/join", response_model=TournamentMemberResponse, status_code=status.HTTP_201_CREATED)
def join(request: JoinTournamentRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.join_tournament(db, request.invite_code, current_user)


@router.get("/{tournament_id}", response_model=TournamentResponse)
def get_tournament(tournament_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.get_tournament(db, tournament_id, current_user)


@router.get("/{tournament_id}/leaderboard", response_model=LeaderboardResponse)
def leaderboard(tournament_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.get_leaderboard(db, tournament_id, current_user)
