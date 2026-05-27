from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.services import prediction as prediction_service
from app.schemas.prediction import PredictionCreate, PredictionResponse

router = APIRouter()


@router.post("/", response_model=PredictionResponse, status_code=status.HTTP_201_CREATED)
def submit_prediction(data: PredictionCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return prediction_service.submit_prediction(db, data, current_user)


@router.put("/{prediction_id}", response_model=PredictionResponse)
def update_prediction(prediction_id: UUID, data: PredictionCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return prediction_service.update_prediction(db, prediction_id, data, current_user)


@router.get("/", response_model=List[PredictionResponse])
def list_predictions(
    tournament_id: UUID,
    match_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return prediction_service.list_predictions(db, tournament_id, current_user, match_id)
