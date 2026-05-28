from app.services.tournament import _apply_spoiler


def test_scheduled_match_hides_others_scores():
    ph, pa = _apply_spoiler(is_finished=False, is_own=False, predicted_home=2, predicted_away=1)
    assert ph is None
    assert pa is None


def test_scheduled_match_shows_own_scores():
    ph, pa = _apply_spoiler(is_finished=False, is_own=True, predicted_home=2, predicted_away=1)
    assert ph == 2
    assert pa == 1


def test_finished_match_shows_all_scores():
    ph, pa = _apply_spoiler(is_finished=True, is_own=False, predicted_home=3, predicted_away=0)
    assert ph == 3
    assert pa == 0


def test_finished_match_shows_own_scores():
    ph, pa = _apply_spoiler(is_finished=True, is_own=True, predicted_home=1, predicted_away=1)
    assert ph == 1
    assert pa == 1
