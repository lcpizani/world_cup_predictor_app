from collections import defaultdict
from typing import Literal

from sqlalchemy.orm import Session, joinedload

from app.models.match import Match
from app.models.prediction import Prediction
from app.schemas.prediction_stats import (
    GameStatMatch,
    GlobalGameStatEntry,
    GlobalGameStatScore,
    GlobalPredictionStatsSummary,
    GlobalPredictionStatsResponse,
)


def _outcome(home: int, away: int) -> Literal["home", "draw", "away"]:
    if home > away:
        return "home"
    if home < away:
        return "away"
    return "draw"


def get_global_prediction_stats(db: Session) -> GlobalPredictionStatsResponse:
    predictions = (
        db.query(Prediction)
        .join(Match, Prediction.match_id == Match.id)
        .filter(
            Match.status == "finished",
            Match.home_score.isnot(None),
            Match.away_score.isnot(None),
        )
        .options(joinedload(Prediction.match))
        .all()
    )

    by_match: dict = defaultdict(list)
    user_ids: set = set()
    for pred in predictions:
        by_match[pred.match_id].append(pred)
        user_ids.add(pred.user_id)

    game_stats: list[GlobalGameStatEntry] = []
    total_predictions = len(predictions)
    total_users = len(user_ids)
    total_hits = 0
    total_exacts = 0

    for match_id, preds in by_match.items():
        match = preds[0].match
        actual_outcome = _outcome(match.home_score, match.away_score)

        hits = 0
        exacts = 0
        outcome_counts: dict = defaultdict(int)
        score_counts: dict = defaultdict(int)

        for p in preds:
            pred_outcome = _outcome(p.predicted_home, p.predicted_away)
            outcome_counts[pred_outcome] += 1
            score_counts[(p.predicted_home, p.predicted_away)] += 1
            if pred_outcome == actual_outcome:
                hits += 1
            if p.predicted_home == match.home_score and p.predicted_away == match.away_score:
                exacts += 1

        # Accumulate summary totals over ALL finished games regardless of predictor count
        total_hits += hits
        total_exacts += exacts

        # Spotlight cards only meaningful with ≥2 predictors
        if len(preds) < 2:
            continue

        count = len(preds)
        # Secondary key ensures deterministic result on tied vote counts
        consensus_pick, max_consensus_count = max(
            outcome_counts.items(), key=lambda x: (x[1], x[0])
        )
        (common_home, common_away), max_same_score_count = max(
            score_counts.items(), key=lambda x: (x[1], x[0][0], x[0][1])
        )

        game_stats.append(GlobalGameStatEntry(
            match=GameStatMatch(
                id=match.id,
                home_team=match.home_team,
                away_team=match.away_team,
                home_score=match.home_score,
                away_score=match.away_score,
                stage=match.stage,
                kickoff_at=match.kickoff_at.isoformat(),
            ),
            hit_rate=round(hits / count, 4),
            exact_rate=round(exacts / count, 4),
            prediction_count=count,
            max_consensus_count=max_consensus_count,
            consensus_pick=consensus_pick,
            max_same_score_count=max_same_score_count,
            most_common_score=GlobalGameStatScore(home=common_home, away=common_away),
        ))

    overall_hit_rate = round(total_hits / total_predictions, 4) if total_predictions > 0 else 0.0
    overall_exact_rate = round(total_exacts / total_predictions, 4) if total_predictions > 0 else 0.0

    return GlobalPredictionStatsResponse(
        game_stats=game_stats,
        summary=GlobalPredictionStatsSummary(
            total_users=total_users,
            total_predictions=total_predictions,
            overall_hit_rate=overall_hit_rate,
            overall_exact_rate=overall_exact_rate,
        ),
    )
