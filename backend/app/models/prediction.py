import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.database import Base


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        UniqueConstraint("user_id", "match_id", name="uq_prediction_user_match"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    match_id = Column(PGUUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    predicted_home = Column(Integer, nullable=False)
    predicted_away = Column(Integer, nullable=False)
    is_locked = Column(Boolean, nullable=False, server_default="false")
    points_awarded = Column(Integer, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="predictions")
    match = relationship("Match", back_populates="predictions")
    point_events = relationship("PointEvent", back_populates="prediction", cascade="all, delete-orphan")
