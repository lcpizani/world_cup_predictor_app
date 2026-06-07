from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.prediction import Prediction
from app.models.point_event import PointEvent
from app.models.match import Match
from app.models.tournament import Tournament, TournamentScoringRules, TournamentMember
from app.services.standings import recalculate_standings_from_matches

STAGE_ORDER = [
    "group_stage",
    "round_of_64",
    "round_of_32",
    "round_of_16",
    "quarter_finals",
    "semi_finals",
    "third_place",
    "final",
]

KNOCKOUT_STAGES = set(STAGE_ORDER[1:])


def _points_multiplier(scoring: TournamentScoringRules, match_stage: str) -> int:
    threshold = scoring.double_points_from_stage
    if not threshold:
        return 1
    try:
        if STAGE_ORDER.index(match_stage) >= STAGE_ORDER.index(threshold):
            return 2
    except ValueError:
        pass
    return 1


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
    multiplier = _points_multiplier(scoring, match.stage)

    def outcome(h: int, a: int) -> int:
        if h > a:
            return 1
        if h < a:
            return -1
        return 0

    events: List[Tuple[str, int]] = []

    # Exact score — does not stack with any other category
    if ph == ah and pa == aa:
        pts = scoring.correct_result_pts * multiplier
        return [("correct_result", pts)] if pts > 0 else []

    # All remaining categories stack freely
    if outcome(ph, pa) == outcome(ah, aa):
        events.append(("correct_winner", scoring.correct_winner_pts * multiplier))

    if (ph - pa) == (ah - aa):
        events.append(("correct_goal_diff", scoring.correct_goal_diff_pts * multiplier))

    if ph == ah or pa == aa:
        events.append(("correct_goals_one_team", scoring.correct_goals_one_team_pts * multiplier))

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
        if match.stage == "group_stage" and match.group:
            recalculate_standings_from_matches(db, group=match.group)
        return match

    # Batch-load all memberships for the predicting users in one query.
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

    affected_member_ids = set()

    for pred in predictions:
        total_across_tournaments = 0
        for membership in memberships_by_user.get(pred.user_id, []):
            # Snapshot-at-join fairness: only score under tournaments the user
            # was already a member of before kickoff.
            if membership.joined_at > match.kickoff_at:
                continue
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
            # Clear provisional — confirmed points now replace the estimate
            membership.provisional_points = 0
            db.add(membership)
            affected_member_ids.add(membership.id)
            total_across_tournaments += total_points

        pred.is_locked = True
        pred.points_awarded = total_across_tournaments
        db.add(pred)

    db.commit()
    db.refresh(match)

    if match.stage == "group_stage" and match.group:
        recalculate_standings_from_matches(db, group=match.group)

    return match


def update_provisional_points(db: Session) -> None:
    """Recompute and persist provisional_points for every TournamentMember.

    Called by the scheduler after every sync_results cycle that finds live
    matches. Sets provisional_points = 0 for all members when no live matches
    exist (so stale values don't linger after games end).
    """
    live_matches = db.query(Match).filter(
        Match.status == "live",
        Match.home_score.isnot(None),
        Match.away_score.isnot(None),
    ).all()

    if not live_matches:
        # Clear any stale provisional values
        db.query(TournamentMember).filter(
            TournamentMember.provisional_points != 0
        ).update({"provisional_points": 0}, synchronize_session=False)
        db.commit()
        return

    # Build prediction lookup: user_id -> match_id -> Prediction
    live_match_ids = [m.id for m in live_matches]
    predictions = (
        db.query(Prediction)
        .filter(Prediction.match_id.in_(live_match_ids))
        .all()
    )
    pred_by_user_match: dict = {}
    for p in predictions:
        pred_by_user_match.setdefault(p.user_id, {})[p.match_id] = p

    # Load all memberships with scoring rules in one query
    memberships = (
        db.query(TournamentMember)
        .options(joinedload(TournamentMember.tournament).joinedload(Tournament.scoring_rules))
        .all()
    )

    for membership in memberships:
        scoring = membership.tournament.scoring_rules or _default_scoring(membership.tournament_id)
        total = 0
        user_preds = pred_by_user_match.get(membership.user_id, {})
        for match in live_matches:
            prediction = user_preds.get(match.id)
            if prediction is None:
                continue
            # Snapshot-at-join: only count if user joined before kickoff
            if membership.joined_at > match.kickoff_at:
                continue
            try:
                events = compute_points_for_prediction(prediction, scoring, match)
                total += sum(pts for _, pts in events)
            except ValueError:
                pass
        if membership.provisional_points != total:
            membership.provisional_points = total
            db.add(membership)

    db.commit()


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
        {"total_points": 0, "provisional_points": 0}, synchronize_session=False
    )

    scoring = tournament.scoring_rules or _default_scoring(tournament_id)

    members = db.query(TournamentMember).filter(TournamentMember.tournament_id == tournament_id).all()
    if not members:
        db.commit()
        return {"recomputed_matches": 0, "recomputed_predictions": 0}
    member_ids = [m.user_id for m in members]
    joined_at_by_user = {m.user_id: m.joined_at for m in members}

    finished_matches = (
        db.query(Match)
        .join(Prediction, Prediction.match_id == Match.id)
        .filter(
            Prediction.user_id.in_(member_ids),
            Match.status == "finished",
            Match.home_score.isnot(None),
            Match.away_score.isnot(None),
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
        predictions = [
            p for p in predictions
            if joined_at_by_user[p.user_id] <= match.kickoff_at
        ]
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
    update_provisional_points(db)
    return {"recomputed_matches": recomputed_matches, "recomputed_predictions": recomputed_predictions}
