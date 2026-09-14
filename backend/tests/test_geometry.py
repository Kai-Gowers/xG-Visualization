import math

import pytest

from xg.geometry import (
    complement_on_goal,
    in_shot_cone,
    merge_intervals,
    occluded_interval,
    point_in_triangle,
    union_length,
    visible_goal_angle,
)

PEN_SPOT = (108.0, 40.0)


def test_penalty_spot_angle_and_symmetry():
    assert visible_goal_angle(PEN_SPOT) == pytest.approx(2 * math.atan(4 / 12))
    assert visible_goal_angle((108.0, 30.0)) == pytest.approx(visible_goal_angle((108.0, 50.0)))


def test_touchline_angle_is_small_and_wide_positions_do_not_wrap():
    assert visible_goal_angle((100.0, 0.0)) < 0.2
    # Level with the goal line, wide: the naive atan2 difference would wrap here.
    assert 0 < visible_goal_angle((119.5, 0.0)) < math.pi


def test_degenerate_shooter_positions_do_not_raise():
    assert visible_goal_angle((120.0, 36.0)) == pytest.approx(math.pi / 2)
    assert visible_goal_angle((121.0, 40.0)) > 0


def test_point_in_triangle_edges_and_outside():
    a, b, c = PEN_SPOT, (120.0, 36.0), (120.0, 44.0)
    assert point_in_triangle((117.0, 40.0), a, b, c)
    assert point_in_triangle((120.0, 36.0), a, b, c)  # on a vertex
    assert point_in_triangle((114.0, 38.0), a, b, c)  # on an edge
    assert not point_in_triangle((117.0, 60.0), a, b, c)
    assert not point_in_triangle((100.0, 40.0), a, b, c)  # behind the shooter


def test_in_shot_cone_wraps_triangle_helper():
    assert in_shot_cone(PEN_SPOT, (116.0, 41.0))
    assert not in_shot_cone(PEN_SPOT, (116.0, 47.0))


def test_occlusion_straight_ahead_is_symmetric():
    iv = occluded_interval(PEN_SPOT, (117.0, 40.0), 0.4375)
    assert iv is not None
    lo, hi = iv
    assert (lo + hi) / 2 == pytest.approx(40.0)
    expected_half_width = 12 * math.tan(math.asin(0.4375 / 9))
    assert hi - lo == pytest.approx(2 * expected_half_width, rel=1e-6)


def test_occlusion_misses_and_behind():
    assert occluded_interval(PEN_SPOT, (117.0, 60.0), 0.4375) is None
    assert occluded_interval(PEN_SPOT, (100.0, 40.0), 0.4375) is None


def test_occlusion_overlapping_blocker_covers_whole_goal():
    assert occluded_interval(PEN_SPOT, (108.2, 40.0), 0.4375) == (36.0, 44.0)


def test_occlusion_clips_to_goal_and_keeper_on_line():
    iv = occluded_interval(PEN_SPOT, (119.9, 43.8), 0.875)
    assert iv is not None
    assert iv[1] == pytest.approx(44.0)
    assert iv[0] > 36.0


def test_occlusion_blocker_beside_shooter_extends_to_one_side():
    # Blocker just ahead and beside the shooter: one tangent ray never reaches the
    # goal line, the other does, so the shadow runs to the far post.
    iv = occluded_interval((108.0, 40.0), (108.5, 40.8), 0.875)
    assert iv is not None
    assert iv[1] == 44.0
    assert iv[0] < 40.0
    # Level with the shooter, the whole shadow falls wide of the goal.
    assert occluded_interval((108.0, 40.0), (108.0, 41.0), 0.875) is None


def test_merge_union_and_complement():
    merged = merge_intervals([(37.0, 39.0), (38.0, 40.0), (42.0, 43.0)])
    assert merged == [(37.0, 40.0), (42.0, 43.0)]
    assert union_length(merged) == pytest.approx(4.0)
    assert complement_on_goal(merged) == [(36.0, 37.0), (40.0, 42.0), (43.0, 44.0)]
    assert complement_on_goal([]) == [(36.0, 44.0)]
    assert complement_on_goal([(36.0, 44.0)]) == []
