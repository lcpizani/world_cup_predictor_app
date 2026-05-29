from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.prediction import Prediction
from app.models.point_event import PointEvent
from app.models.match import Match
from app.models.tournament import Tournament, TournamentScoringRules, TournamentMember


def compute_points_for_prediction(
    prediction: Prediction,
    scoring: TournamentScoringRules,
    match: Match,
) -> List[Tuple[str, int]]:
    """Returns one (reason, points) pair per scoring category earned.

    Raises ValueError if the match result is not yet set.
    """
    if match.home_score is None or match.away_score is None:
        raise ValueError("Match result not set")

    ph, pa = prediction.predicted_home, prediction.predicted_away
    ah, aa = match.home_score, match.away_score

    def outcome(h: int, a: int) -> int:
        if h > a:
            return 1
        if h < a:
            return -1
        return 0

    events: List[Tuple[str, int]] = []

    # Exact score — does not stack with any other category
    if ph == ah and pa == aa:
        pts = scoring.correct_result_pts
        return [("correct_result", pts)] if pts > 0 else []

    # All remaining categories stack freely
    if outcome(ph, pa) == outcome(ah, aa):
        events.append(("correct_winner", scoring.correct_winner_pts))

    if (ph - pa) == (ah - aa):
        events.append(("correct_goal_diff", scoring.correct_goal_diff_pts))

    if ph == ah or pa == aa:
        events.append(("correct_goals_one_team", scoring.correct_goals_one_team_pts))

    return [(reason, pts) for reason, pts in events if pts > 0]


def _default_scoring(tournament_id: UUID) -> TournamentScoringRules:
    return TournamentScoringRules(
        tournament_id=tournament_id,
        correct_result_pts=0,
        correct_winner_pts=0,
        correct_goal_diff_pts=0,
        correct_goals_one_team_pts=0,
    )


def apply_match_result(
    db: Session,
    match_id: UUID,
    home_score: int,
    away_score: int,
    applied_by=None,
    status: Optional[str] = None,
) -> Match:
    match = db.query(Match).filter(Match.id == match_id).first()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.status == "finished":
        raise HTTPException(status_code=400, detail="Match result already applied")

    existing_pe = db.query(PointEvent).filter(PointEvent.match_id == match.id).first()
    if existing_pe:
        raise HTTPException(status_code=400, detail="Match results already processed")

    match.home_score = home_score
    match.away_score = away_score
    match.status = status or "finished"
    db.add(match)
    db.flush()

    # Predictions are now global — one per user per match
    predictions = db.query(Prediction).filter(Prediction.match_id == match.id).all()
    if not predictions:
        db.commit()
        db.refresh(match)
        return match

    # Batch-load all memberships for the predicting users in one query.
    # Previously this issued one query per prediction; with N predictions × M
    # tournaments per user that's O(N) joinedload queries per finished match.
    user_ids = [p.user_id for p in predictions]
    memberships = (
        db.query(TournamentMember)
        .options(joinedload(TournamentMember.tournament).joinedload(Tournament.scoring_rules))
        .filter(TournamentMember.user_id.in_(user_ids))
        .all()
    )
    memberships_by_user: dict = {}
    for m in memberships:
        memberships_by_user.setdefault(m.user_id, []).append(m)

    for pred in predictions:
        # Score this prediction in every tournament the user belongs to.
        # Track the per-prediction total across tournaments so we can persist
        # it on Prediction.points_awarded for the user history endpoint.
        total_across_tournaments = 0
        for membership in memberships_by_user.get(pred.user_id, []):
            scoring = membership.tournament.scoring_rules or _default_scoring(membership.tournament_id)
            events = compute_points_for_prediction(pred, scoring, match)
            total_points = sum(pts for _, pts in events)

            for reason, pts in events:
                db.add(PointEvent(
                    prediction_id=pred.id,
                    user_id=pred.user_id,
                    tournament_id=membership.tournament_id,
                    match_id=match.id,
                    reason=reason,
                    points=pts,
                ))

            membership.total_points = (membership.total_points or 0) + total_points
            db.add(membership)
            total_across_tournaments += total_points

        pred.is_locked = True
        pred.points_awarded = total_across_tournaments
        db.add(pred)

    db.commit()
    db.refresh(match)
    return match


def recompute_tournament_scores(db: Session, tournament_id: UUID) -> dict:
    tournament = (
        db.query(Tournament)
        .options(joinedload(Tournament.scoring_rules))
        .filter(Tournament.id == tournament_id)
        .first()
    )
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    db.query(PointEvent).filter(PointEvent.tournament_id == tournament_id).delete(synchronize_session=False)
    db.query(TournamentMember).filter(TournamentMember.tournament_id == tournament_id).update(
        {"total_points": 0}, synchronize_session=False
    )

    scoring = tournament.scoring_rules or _default_scoring(tournament_id)

    member_ids = [
        m.user_id
        for m in db.query(TournamentMember).filter(TournamentMember.tournament_id == tournament_id).all()
    ]
    if not member_ids:
        # No members means nothing to score. Avoid `IN ()` queries downstream.
        db.commit()
        return {"recomputed_matches": 0, "recomputed_predictions": 0}

    finished_matches = (
        db.query(Match)
        .join(Prediction, Prediction.match_id == Match.id)
        .filter(
            Prediction.user_id.in_(member_ids),
            Match.status == "finished",
            Match.home_score.is_not(None),
            Match.away_score.is_not(None),
        )
        .distinct()
        .all()
    )

    recomputed_matches = 0
    recomputed_predictions = 0

    for match in finished_matches:
        predictions = (
            db.query(Prediction)
            .filter(
                Prediction.match_id == match.id,
                Prediction.user_id.in_(member_ids),
            )
            .all()
        )
        if not predictions:
            continue

        recomputed_matches += 1
        for pred in predictions:
            events = compute_points_for_prediction(pred, scoring, match)
            total_points = sum(pts for _, pts in events)

            for reason, pts in events:
                db.add(PointEvent(
                    prediction_id=pred.id,
                    user_id=pred.user_id,
                    tournament_id=tournament_id,
                    match_id=match.id,
                    reason=reason,
                    points=pts,
                ))

            member = (
                db.query(TournamentMember)
                .filter(
                    TournamentMember.tournament_id == tournament_id,
                    TournamentMember.user_id == pred.user_id,
                )
                .first()
            )
            if member:
                member.total_points = (member.total_points or 0) + total_points
                db.add(member)

            recomputed_predictions += 1

    db.commit()
    return {"recomputed_matches": recomputed_matches, "recomputed_predictions": recomputed_predictions}
