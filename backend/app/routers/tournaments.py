from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.limiter import limiter
from app.logger import logger
from app.models.tournament import Tournament
from app.services import tournament as tournament_service
from app.schemas.tournament import (
    TournamentCreate,
    TournamentResponse,
    TournamentMemberResponse,
    JoinTournamentRequest,
    TournamentCompareMatch,
    TournamentUpdate,
    TransferOwnershipRequest,
)
from app.schemas.leaderboard import LeaderboardResponse, LiveLeaderboardResponse, RankingHistoryResponse
from app.schemas.prediction_stats import PredictionStatsResponse

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


@router.get("/{invite_code}/preview", status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
def preview_tournament(request: Request, invite_code: str, db: Session = Depends(get_db)) -> dict:
    """Public endpoint — returns just the league name for an invite code, no auth required.

    Rate-limited because the endpoint is unauthenticated and the 8-char invite
    code keyspace is small enough that an attacker could otherwise enumerate codes."""
    tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
    if not tournament:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite link not found")
    return {"name": tournament.name}


@router.get("/{invite_code}/leaderboard", response_model=LeaderboardResponse)
def leaderboard(invite_code: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.get_leaderboard_by_code(db, invite_code, current_user)


@router.get("/{invite_code}/leaderboard/live", response_model=LiveLeaderboardResponse)
def live_leaderboard(invite_code: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.get_live_leaderboard(db, invite_code, current_user)


@router.get("/{invite_code}/ranking-history", response_model=RankingHistoryResponse)
def ranking_history(invite_code: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.get_ranking_history(db, invite_code, current_user)


@router.get("/{invite_code}/compare", response_model=List[TournamentCompareMatch])
def compare(invite_code: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.get_compare(db, invite_code, current_user)


@router.get("/{invite_code}/prediction-stats", response_model=PredictionStatsResponse)
def prediction_stats(invite_code: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.get_prediction_stats(db, invite_code, current_user)


@router.get("/{invite_code}", response_model=TournamentResponse)
def get_tournament(invite_code: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        result = tournament_service.get_tournament_by_code(db, invite_code, current_user)
    except HTTPException as exc:
        logger.error("Tournament not found or access denied", invite_code=invite_code, user_id=str(current_user.id), detail=exc.detail)
        raise
    return result


@router.get("/{invite_code}/members", response_model=List[TournamentMemberResponse])
def list_members(invite_code: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return tournament_service.list_members(db, invite_code, current_user)


@router.patch("/{invite_code}", response_model=TournamentResponse)
def update_tournament(
    invite_code: str,
    data: TournamentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        result = tournament_service.update_tournament(db, invite_code, data, current_user)
    except HTTPException as exc:
        logger.warning("Failed to update tournament", invite_code=invite_code, user_id=str(current_user.id), detail=exc.detail)
        raise
    logger.info("Tournament updated", invite_code=invite_code, user_id=str(current_user.id))
    return result


@router.delete("/{invite_code}/members/{member_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    invite_code: str,
    member_user_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        tournament_service.remove_member(db, invite_code, member_user_id, current_user)
    except HTTPException as exc:
        logger.warning("Failed to remove member", invite_code=invite_code, member_user_id=str(member_user_id), user_id=str(current_user.id), detail=exc.detail)
        raise
    logger.info("Member removed", invite_code=invite_code, member_user_id=str(member_user_id), user_id=str(current_user.id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{invite_code}/transfer", response_model=TournamentResponse)
def transfer_ownership(
    invite_code: str,
    data: TransferOwnershipRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        result = tournament_service.transfer_ownership(db, invite_code, data.new_owner_user_id, current_user)
    except HTTPException as exc:
        logger.warning("Failed to transfer ownership", invite_code=invite_code, user_id=str(current_user.id), detail=exc.detail)
        raise
    logger.info("Ownership transferred", invite_code=invite_code, new_owner=str(data.new_owner_user_id), user_id=str(current_user.id))
    return result


@router.delete("/{invite_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tournament(invite_code: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        tournament_service.delete_tournament(db, invite_code, current_user)
    except HTTPException as exc:
        logger.warning("Failed to delete tournament", invite_code=invite_code, user_id=str(current_user.id), detail=exc.detail)
        raise
    logger.info("Tournament deleted", invite_code=invite_code, user_id=str(current_user.id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
