import uuid

from sqlalchemy import Column, DateTime, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.database import Base


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (
        Index("ix_matches_kickoff_at", "kickoff_at"),
        Index("ix_matches_status", "status"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_match_id = Column(String(100), unique=True, nullable=True)
    home_team = Column(String(100), nullable=False)
    away_team = Column(String(100), nullable=False)
    kickoff_at = Column(DateTime(timezone=True), nullable=False)
    stage = Column(String(50), nullable=False)
    group = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, server_default="scheduled")
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    minute = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # No delete cascade on predictions: the DB-level FK is ON DELETE RESTRICT, so
    # deleting a match that still has predictions must fail loudly. An ORM-level
    # "all, delete-orphan" here would delete the predictions in Python first and
    # silently defeat that guard. (The reset endpoint deletes predictions
    # explicitly via bulk query before deleting matches, so it is unaffected.)
    predictions = relationship("Prediction", back_populates="match", passive_deletes="all")
    point_events = relationship("PointEvent", back_populates="match", cascade="all, delete-orphan")
