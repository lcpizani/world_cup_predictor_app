from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.logger import logger
from app.services import prediction as prediction_service
from app.schemas.prediction import PredictionCreate, PredictionUpdate, PredictionResponse

router = APIRouter()


@router.post("", response_model=PredictionResponse, status_code=status.HTTP_201_CREATED)
def submit_prediction(data: PredictionCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        result = prediction_service.submit_prediction(db, data, current_user)
    except HTTPException as exc:
        logger.error("Failed to submit prediction", user_id=str(current_user.id), match_id=str(data.match_id), detail=exc.detail)
        raise
    logger.info("Prediction submitted", user_id=str(current_user.id), match_id=str(data.match_id))
    return result


@router.put("/{prediction_id}", response_model=PredictionResponse)
def update_prediction(prediction_id: UUID, data: PredictionUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        result = prediction_service.update_prediction(db, prediction_id, data, current_user)
    except HTTPException as exc:
        logger.error("Failed to update prediction", user_id=str(current_user.id), prediction_id=str(prediction_id), detail=exc.detail)
        raise
    logger.info("Prediction updated", user_id=str(current_user.id), prediction_id=str(prediction_id))
    return result


@router.get("", response_model=List[PredictionResponse])
def list_predictions(
    tournament_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return prediction_service.list_predictions(db, current_user, tournament_id)
