from types import SimpleNamespace

import pytest

from app.services.scoring import compute_points_for_prediction


def make_scoring_rules(correct_result_pts=5, correct_winner_pts=3, correct_goal_diff_pts=2, correct_goals_one_team_pts=1):
    return SimpleNamespace(
        correct_result_pts=correct_result_pts,
        correct_winner_pts=correct_winner_pts,
        correct_goal_diff_pts=correct_goal_diff_pts,
        correct_goals_one_team_pts=correct_goals_one_team_pts,
    )


def make_prediction(predicted_home, predicted_away):
    return SimpleNamespace(predicted_home=predicted_home, predicted_away=predicted_away)


def make_match(home_score, away_score):
    return SimpleNamespace(home_score=home_score, away_score=away_score)


def test_exact_score_earns_only_correct_result():
    prediction = make_prediction(2, 1)
    match = make_match(2, 1)
    scoring = make_scoring_rules()

    events = compute_points_for_prediction(prediction, scoring, match)
    assert events == [("correct_result", 5)]


def test_correct_winner_only():
    # predict 3-0, actual 2-1: same outcome (home win), different goal diff (+3 vs +1), no individual score match
    prediction = make_prediction(3, 0)
    match = make_match(2, 1)
    scoring = make_scoring_rules()

    events = compute_points_for_prediction(prediction, scoring, match)
    assert events == [("correct_winner", 3)]


def test_correct_goal_difference_with_same_outcome():
    prediction = make_prediction(3, 1)
    match = make_match(2, 0)
    scoring = make_scoring_rules()

    events = compute_points_for_prediction(prediction, scoring, match)
    assert events == [
        ("correct_winner", 3),
        ("correct_goal_diff", 2),
    ]


def test_correct_goals_one_team_only():
    prediction = make_prediction(2, 1)
    match = make_match(2, 3)
    scoring = make_scoring_rules()

    events = compute_points_for_prediction(prediction, scoring, match)
    assert events == [("correct_goals_one_team", 1)]


def test_draw_predicted_draw_actual_earns_correct_winner_and_goal_diff():
    prediction = make_prediction(1, 1)
    match = make_match(0, 0)
    scoring = make_scoring_rules()

    events = compute_points_for_prediction(prediction, scoring, match)
    assert events == [
        ("correct_winner", 3),
        ("correct_goal_diff", 2),
    ]


def test_exact_draw_earns_only_correct_result():
    prediction = make_prediction(0, 0)
    match = make_match(0, 0)
    scoring = make_scoring_rules()

    events = compute_points_for_prediction(prediction, scoring, match)
    assert events == [("correct_result", 5)]


def test_complete_miss_returns_empty_list():
    prediction = make_prediction(2, 0)
    match = make_match(0, 2)
    scoring = make_scoring_rules()

    events = compute_points_for_prediction(prediction, scoring, match)
    assert events == []


def test_zero_point_exact_score_returns_empty():
    # exact score but correct_result_pts=0 → filtered out, nothing else stacks
    prediction = make_prediction(2, 1)
    match = make_match(2, 1)
    scoring = make_scoring_rules(correct_result_pts=0)

    events = compute_points_for_prediction(prediction, scoring, match)
    assert events == []


def test_raises_value_error_when_match_result_unset():
    prediction = make_prediction(1, 1)
    match = make_match(None, 0)
    scoring = make_scoring_rules()

    with pytest.raises(ValueError):
        compute_points_for_prediction(prediction, scoring, match)
