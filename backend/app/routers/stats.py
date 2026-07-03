from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.prediction_stats import GlobalPredictionStatsResponse
from app.services import stats as stats_service

router = APIRouter()


@router.get("/prediction-stats", response_model=GlobalPredictionStatsResponse)
def prediction_stats(db: Session = Depends(get_db)):
    return stats_service.get_global_prediction_stats(db)
