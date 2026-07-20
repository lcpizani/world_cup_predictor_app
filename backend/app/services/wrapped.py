from collections import Counter
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.match import Match
from app.models.point_event import PointEvent
from app.models.prediction import Prediction
from app.models.tournament import TournamentMember
from app.models.user import User


STAGE_ORDER = [
    "group_stage",
    "round_of_32",
    "round_of_16",
    "quarter_finals",
    "semi_finals",
    "third_place",
    "final",
]


def get_wrapped_stats(db: Session, user_id: UUID, tournament_id: UUID) -> dict:
    # All finished predictions for this user in this tournament
    finished_predictions = (
        db.query(Prediction, Match)
        .join(Match, Prediction.match_id == Match.id)
        .filter(
            Prediction.user_id == user_id,
            Match.status == "finished",
        )
        .all()
    )

    total_predictions = len(finished_predictions)

    # Accuracy stats from point_events
    point_events = (
        db.query(PointEvent)
        .filter(
            PointEvent.user_id == user_id,
            PointEvent.tournament_id == tournament_id,
        )
        .all()
    )

    exact_scores = sum(1 for pe in point_events if pe.reason == "correct_result")
    correct_winners = sum(1 for pe in point_events if pe.reason == "correct_winner")
    hit_rate_pct = round((exact_scores + correct_winners) / total_predictions * 100, 1) if total_predictions > 0 else 0.0

    # Best match — prediction with most points_awarded
    best_match = None
    best_pts = -1
    for pred, match in finished_predictions:
        pts = pred.points_awarded or 0
        if pts > best_pts:
            best_pts = pts
            best_match = {
                "home_team": match.home_team,
                "away_team": match.away_team,
                "actual_home": match.home_score,
                "actual_away": match.away_score,
                "predicted_home": pred.predicted_home,
                "predicted_away": pred.predicted_away,
                "points_awarded": pts,
            }

    # Points by stage
    points_by_stage: dict[str, int] = {s: 0 for s in STAGE_ORDER}
    match_stage_by_id: dict[UUID, str] = {match.id: match.stage for _, match in finished_predictions}

    for pe in point_events:
        stage = match_stage_by_id.get(pe.match_id)
        if stage and stage in points_by_stage:
            points_by_stage[stage] += pe.points

    # Remove stages with no points and no predictions for cleaner output
    active_stages = {match.stage for _, match in finished_predictions}
    points_by_stage = {s: points_by_stage.get(s, 0) for s in STAGE_ORDER if s in active_stages}

    # Favorite team — team predicted to win most often (non-draw predictions on finished matches)
    team_wins: Counter = Counter()
    team_latest: dict[str, str] = {}
    for pred, match in finished_predictions:
        if pred.predicted_home == pred.predicted_away:
            continue  # draw prediction, skip
        if pred.predicted_home > pred.predicted_away:
            winner = match.home_team
        else:
            winner = match.away_team
        team_wins[winner] += 1
        # track latest kickoff for tie-breaking
        existing = team_latest.get(winner)
        kickoff = match.kickoff_at.isoformat() if match.kickoff_at else ""
        if existing is None or kickoff > existing:
            team_latest[winner] = kickoff

    favorite_team: Optional[str] = None
    favorite_team_count: int = 0
    if team_wins:
        max_count = max(team_wins.values())
        if max_count >= 3:
            candidates = [t for t, c in team_wins.items() if c == max_count]
            # tie-break by latest kickoff
            favorite_team = max(candidates, key=lambda t: team_latest.get(t, ""))
            favorite_team_count = max_count

    # Best-score teams — teams where user nailed the most exact scores
    exact_teams: Counter = Counter()
    for pred, match in finished_predictions:
        if (
            match.home_score is not None
            and match.away_score is not None
            and pred.predicted_home == match.home_score
            and pred.predicted_away == match.away_score
        ):
            exact_teams[match.home_team] += 1
            exact_teams[match.away_team] += 1

    best_score_teams = [
        {"team": team, "count": count}
        for team, count in exact_teams.most_common(2)
    ]

    # User rank and top 3 within this tournament
    all_members = (
        db.query(TournamentMember, User)
        .join(User, TournamentMember.user_id == User.id)
        .filter(TournamentMember.tournament_id == tournament_id)
        .order_by(TournamentMember.total_points.desc(), TournamentMember.joined_at)
        .all()
    )

    total_members = len(all_members)
    user_rank = next(
        (i + 1 for i, (m, _) in enumerate(all_members) if m.user_id == user_id),
        total_members,
    )

    top_three = [
        {
            "rank": i + 1,
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "total_points": m.total_points,
            "is_current_user": m.user_id == user_id,
        }
        for i, (m, u) in enumerate(all_members[:3])
    ]

    return {
        "total_predictions": total_predictions,
        "exact_scores": exact_scores,
        "correct_winners": correct_winners,
        "hit_rate_pct": hit_rate_pct,
        "best_match": best_match,
        "points_by_stage": points_by_stage,
        "favorite_team": favorite_team,
        "favorite_team_count": favorite_team_count,
        "best_score_teams": best_score_teams,
        "user_rank": user_rank,
        "total_members": total_members,
        "top_three": top_three,
    }
