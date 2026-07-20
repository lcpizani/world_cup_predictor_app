import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.database import Base


class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    created_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    invite_code = Column(String(20), nullable=False, unique=True, index=True)
    is_active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    creator = relationship("User", back_populates="tournaments_created")
    scoring_rules = relationship(
        "TournamentScoringRules",
        uselist=False,
        back_populates="tournament",
        cascade="all, delete-orphan",
    )
    members = relationship("TournamentMember", back_populates="tournament", cascade="all, delete-orphan")
    point_events = relationship("PointEvent", back_populates="tournament", cascade="all, delete-orphan")


class TournamentScoringRules(Base):
    __tablename__ = "tournament_scoring_rules"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id = Column(
        PGUUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    correct_result_pts = Column(Integer, nullable=False, default=0)
    correct_winner_pts = Column(Integer, nullable=False, default=0)
    correct_goal_diff_pts = Column(Integer, nullable=False, default=0)
    correct_goals_one_team_pts = Column(Integer, nullable=False, default=0)
    double_points_from_stage = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    tournament = relationship("Tournament", back_populates="scoring_rules")


class TournamentMember(Base):
    __tablename__ = "tournament_members"
    __table_args__ = (UniqueConstraint("tournament_id", "user_id", name="uq_tournament_member"),)

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id = Column(
        PGUUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    total_points = Column(Integer, nullable=False, default=0)
    provisional_points = Column(Integer, nullable=False, default=0)
    wrapped_seen = Column(Boolean, nullable=False, server_default="false")
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    tournament = relationship("Tournament", back_populates="members")
    user = relationship("User", back_populates="memberships")
