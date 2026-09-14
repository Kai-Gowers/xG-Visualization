import math
from dataclasses import replace

import pytest

from xg.features import FEATURE_GROUPS, FEATURE_NAMES, compute_features, feature_spec_base
from xg.scenario import Point, Scenario

PEN = Scenario(shooter=Point(108, 40), goalkeeper=Point(118, 40), preferred_foot="Right")


def test_vector_matches_spec_order_and_length():
    res = compute_features(PEN)
    assert len(FEATURE_NAMES) == 43
    assert len(res.vector) == len(FEATURE_NAMES)
    assert res.vector == [res.values[n] for n in FEATURE_NAMES]
    assert set(feature_spec_base()["features"]) == set(res.values)
    for names in FEATURE_GROUPS.values():
        assert sum(res.values[n] for n in names) in (0.0, 1.0)


def test_no_nan_with_empty_defenders_and_missing_gk():
    res = compute_features(Scenario(shooter=Point(95, 20)))
    assert all(math.isfinite(v) for v in res.vector)
    assert res.values["gk_present"] == 0.0
    assert res.values["closest_defender_distance"] == 30.0
    assert res.values["gk_covered_fraction"] > 0  # imputed keeper still shades the goal
    assert res.geometry["goalkeeper_used"]["imputed"] is True


def test_weak_foot_truth_table():
    def wf(body_part: str, pref: str) -> tuple[float, float]:
        v = compute_features(replace(PEN, body_part=body_part, preferred_foot=pref)).values
        return v["weak_foot"], v["preferred_foot_known"]

    assert wf("Left Foot", "Right") == (1.0, 1.0)
    assert wf("Right Foot", "Right") == (0.0, 1.0)
    assert wf("Head", "Right") == (0.0, 1.0)
    assert wf("Left Foot", "Unknown") == (0.0, 0.0)


def test_mirror_invariance():
    base = Scenario(
        shooter=Point(104, 30),
        goalkeeper=Point(118.5, 38),
        defenders=(Point(110, 33), Point(112, 44)),
        teammates=(Point(106, 41),),
    )

    def mirror(p: Point) -> Point:
        return Point(p.x, 80 - p.y)

    flipped = replace(
        base,
        shooter=mirror(base.shooter),
        goalkeeper=mirror(base.goalkeeper),
        defenders=tuple(mirror(d) for d in base.defenders),
        teammates=tuple(mirror(t) for t in base.teammates),
    )
    a = compute_features(base).vector
    b = compute_features(flipped).vector
    assert a == pytest.approx(b, abs=1e-9)


def test_defender_sliding_into_cone_reduces_open_goal():
    baseline = compute_features(PEN).values["goal_open_fraction"]
    assert 0 < baseline < 1  # the keeper alone shades part of the goal
    open_fracs, covered = [], []
    for y in (52.0, 44.0, 42.0, 41.5):
        v = compute_features(replace(PEN, defenders=(Point(114, y),))).values
        open_fracs.append(v["goal_open_fraction"])
        covered.append(v["defenders_covered_fraction"])
    assert covered[0] == 0.0 and open_fracs[0] == baseline
    assert all(a <= b for a, b in zip(covered, covered[1:], strict=False))
    assert all(a >= b for a, b in zip(open_fracs, open_fracs[1:], strict=False))
    assert covered[-1] > 0.1


def test_cone_counts_and_geometry_block():
    sc = replace(PEN, defenders=(Point(114, 40), Point(114, 60)), teammates=(Point(116, 42),))
    res = compute_features(sc)
    assert res.values["n_defenders_in_cone"] == 1.0
    assert res.values["n_teammates_in_cone"] == 1.0
    kinds = [(p["kind"], p["index"], p["in_cone"]) for p in res.geometry["players"]]
    assert kinds == [
        ("defender", 0, True),
        ("defender", 1, False),
        ("goalkeeper", 0, True),
        ("teammate", 0, True),
    ]
    covered = res.geometry["goal_covered_intervals"]
    free = res.geometry["goal_free_intervals"]
    total = sum(hi - lo for lo, hi in covered) + sum(hi - lo for lo, hi in free)
    assert total == pytest.approx(8.0)


def test_gk_lateral_offset_sign_is_relative_to_shooter_side():
    left = compute_features(replace(PEN, shooter=Point(108, 30), goalkeeper=Point(118, 38)))
    right = compute_features(replace(PEN, shooter=Point(108, 50), goalkeeper=Point(118, 42)))
    assert left.values["gk_lateral_offset_toward_shooter"] == pytest.approx(2.0)
    assert right.values["gk_lateral_offset_toward_shooter"] == pytest.approx(2.0)


def test_penalty_has_no_shot_type_one_hot():
    res = compute_features(replace(PEN, shot_type="Penalty"))
    assert sum(res.values[n] for n in FEATURE_GROUPS["shot_type"]) == 0.0


def test_shooter_beyond_goal_line_is_clamped():
    res = compute_features(replace(PEN, shooter=Point(120, 40)))
    assert res.geometry["shooter_used"]["clamped"] is True
    assert all(math.isfinite(v) for v in res.vector)
