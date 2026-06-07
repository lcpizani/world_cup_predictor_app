"""Unit tests for football-data.org stage -> canonical stage normalization.

Guards the mismatch fixed in commit after ddb3747: the API returns LAST_16/LAST_32
while the app speaks round_of_16/round_of_32, which broke double points and the
knockout-scoring guard for those rounds.
"""
import pytest

from app.services.football_api import _normalize_stage
from app.services.scoring import STAGE_ORDER, KNOCKOUT_STAGES


@pytest.mark.parametrize(
    "api_stage,expected",
    [
        ("GROUP_STAGE", "group_stage"),
        ("LAST_64", "round_of_64"),
        ("LAST_32", "round_of_32"),
        ("LAST_16", "round_of_16"),
        ("QUARTER_FINALS", "quarter_finals"),
        ("SEMI_FINALS", "semi_finals"),
        ("THIRD_PLACE", "third_place"),
        ("FINAL", "final"),
    ],
)
def test_known_stages_map_to_canonical(api_stage, expected):
    assert _normalize_stage(api_stage) == expected


def test_all_normalized_knockout_stages_are_recognized_by_scoring():
    # Every knockout stage the API can hand us must be a stage the scoring engine
    # knows about, otherwise double points / the lock guard silently no-op.
    for api_stage in ("LAST_64", "LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"):
        canonical = _normalize_stage(api_stage)
        assert canonical in STAGE_ORDER, canonical
        assert canonical in KNOCKOUT_STAGES, canonical


def test_missing_stage_defaults_to_group_stage():
    assert _normalize_stage(None) == "group_stage"
    assert _normalize_stage("") == "group_stage"


def test_unknown_stage_falls_back_to_lowercase_without_crashing():
    # Stages we don't model (qualifiers, league seasons) shouldn't break a sync.
    assert _normalize_stage("PRELIMINARY_ROUND") == "preliminary_round"
    assert _normalize_stage("REGULAR_SEASON") == "regular_season"
