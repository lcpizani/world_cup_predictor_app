from contextlib import asynccontextmanager
from typing import Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, tournaments, matches, predictions, admin
from app.services.scheduler import start_scheduler, stop_scheduler
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="World Cup Predictor API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(tournaments.router, prefix="/tournaments", tags=["tournaments"])
app.include_router(matches.router, prefix="/matches", tags=["matches"])
app.include_router(predictions.router, prefix="/predictions", tags=["predictions"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
