import pytest

from xg.scenario import Point, Scenario, from_statsbomb_shot


def _event(**overrides):
    ev = {
        "id": "abc",
        "location": [108.0, 40.0],
        "player": {"id": 7, "name": "Shooter"},
        "play_pattern": {"name": "From Kick Off"},
        "under_pressure": True,
        "shot": {
            "body_part": {"name": "Left Foot"},
            "technique": {"name": "Volley"},
            "type": {"name": "Kick Off"},
            "first_time": True,
            "freeze_frame": [
                {
                    "location": [118.0, 39.0],
                    "teammate": False,
                    "position": {"id": 1, "name": "Goalkeeper"},
                    "player": {"id": 1, "name": "GK"},
                },
                {
                    "location": [113.0, 41.0],
                    "teammate": False,
                    "position": {"id": 3, "name": "Right Center Back"},
                    "player": {"id": 2, "name": "CB"},
                },
                {
                    "location": [110.0, 45.0],
                    "teammate": True,
                    "position": {"id": 23, "name": "Center Forward"},
                    "player": {"id": 3, "name": "CF"},
                },
            ],
        },
    }
    ev.update(overrides)
    return ev


def test_parses_frame_roles_and_normalises_categories():
    parsed = from_statsbomb_shot(_event(), {7: "Right"})
    sc = parsed.scenario
    assert sc.goalkeeper == Point(118.0, 39.0)
    assert sc.defenders == (Point(113.0, 41.0),)
    assert sc.teammates == (Point(110.0, 45.0),)
    assert sc.shot_type == "Open Play"  # Kick Off mapped
    assert sc.play_pattern == "Other"  # From Kick Off mapped
    assert sc.body_part == "Left Foot" and sc.technique == "Volley"
    assert sc.first_time and sc.under_pressure and not sc.one_on_one
    assert sc.preferred_foot == "Right"
    assert parsed.gk_present and parsed.has_freeze_frame


def test_missing_goalkeeper_and_unknown_player():
    ev = _event()
    ev["shot"]["freeze_frame"] = [f for f in ev["shot"]["freeze_frame"] if not f["teammate"]][1:]
    parsed = from_statsbomb_shot(ev, {})
    assert parsed.scenario.goalkeeper is None
    assert parsed.gk_present is False
    assert parsed.scenario.preferred_foot == "Unknown"


def test_no_freeze_frame_is_flagged_and_out_of_pitch_points_clamped():
    ev = _event(location=[125.0, -3.0])
    del ev["shot"]["freeze_frame"]
    parsed = from_statsbomb_shot(ev)
    assert parsed.has_freeze_frame is False
    assert parsed.scenario.shooter == Point(120.0, 0.0)


def test_scenario_rejects_unknown_vocab():
    with pytest.raises(ValueError):
        Scenario(shooter=Point(100, 40), body_part="Knee")
