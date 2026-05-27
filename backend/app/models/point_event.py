import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.database import Base


class PointEvent(Base):
    __tablename__ = "point_events"
    __table_args__ = (
        Index("ix_point_events_user_tournament", "user_id", "tournament_id"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prediction_id = Column(PGUUID(as_uuid=True), ForeignKey("predictions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    tournament_id = Column(PGUUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    match_id = Column(PGUUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(50), nullable=False)
    points = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    prediction = relationship("Prediction", back_populates="point_events")
    user = relationship("User", back_populates="point_events")
    tournament = relationship("Tournament", back_populates="point_events")
    match = relationship("Match", back_populates="point_events")
