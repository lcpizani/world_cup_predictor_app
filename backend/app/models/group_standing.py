import uuid

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base


class GroupStanding(Base):
    __tablename__ = "group_standings"
    __table_args__ = (
        UniqueConstraint("group", "position", name="uq_group_standings_group_position"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group = Column(String(50), nullable=False)
    position = Column(Integer, nullable=False)
    team_name = Column(String(100), nullable=False)
    played = Column(Integer, nullable=False, default=0)
    won = Column(Integer, nullable=False, default=0)
    drawn = Column(Integer, nullable=False, default=0)
    lost = Column(Integer, nullable=False, default=0)
    goals_for = Column(Integer, nullable=False, default=0)
    goals_against = Column(Integer, nullable=False, default=0)
    goal_difference = Column(Integer, nullable=False, default=0)
    points = Column(Integer, nullable=False, default=0)
    synced_at = Column(DateTime(timezone=True), nullable=False)
