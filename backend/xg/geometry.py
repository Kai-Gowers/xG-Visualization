"""Pure geometry helpers shared by training and serving.

All functions take and return plain floats/tuples in StatsBomb units so they can be
unit-tested exhaustively and never drift between the pipeline and the API.
"""

from __future__ import annotations

import math

from xg.constants import GOAL_X, POST_HIGH, POST_HIGH_Y, POST_LOW, POST_LOW_Y

Point = tuple[float, float]
Interval = tuple[float, float]

_EPS = 1e-9


def distance(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def visible_goal_angle(shooter: Point) -> float:
    """Angle (radians) subtended by the two posts as seen from the shooter.

    Uses the dot product of the two post vectors, which is immune to the atan2 wrap
    around +-pi that breaks a naive angle difference for wide positions.
    """
    v1 = (POST_LOW[0] - shooter[0], POST_LOW[1] - shooter[1])
    v2 = (POST_HIGH[0] - shooter[0], POST_HIGH[1] - shooter[1])
    n1 = math.hypot(*v1)
    n2 = math.hypot(*v2)
    if n1 < _EPS or n2 < _EPS:
        return math.pi / 2
    cos_theta = (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)
    return math.acos(max(-1.0, min(1.0, cos_theta)))


def _cross(a: Point, b: Point, q: Point) -> float:
    return (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])


def point_in_triangle(q: Point, a: Point, b: Point, c: Point, eps: float = _EPS) -> bool:
    """Inclusive point-in-triangle test using edge signs (points on an edge count)."""
    d1 = _cross(a, b, q)
    d2 = _cross(b, c, q)
    d3 = _cross(c, a, q)
    has_neg = d1 < -eps or d2 < -eps or d3 < -eps
    has_pos = d1 > eps or d2 > eps or d3 > eps
    return not (has_neg and has_pos)


def in_shot_cone(shooter: Point, q: Point) -> bool:
    """True if ``q`` lies inside the triangle shooter -> low post -> high post."""
    return point_in_triangle(q, shooter, POST_LOW, POST_HIGH)


def occluded_interval(shooter: Point, blocker: Point, radius: float) -> Interval | None:
    """Part of the goal line [36, 44] hidden behind a blocking disc, seen from the shooter.

    The two tangent rays from the shooter to the disc are projected onto x = GOAL_X.
    Returns ``None`` when the blocker is behind the shooter or its shadow misses the
    goal, and the full goal when the blocker overlaps the shooter.
    """
    dx = blocker[0] - shooter[0]
    dy = blocker[1] - shooter[1]
    dist = math.hypot(dx, dy)
    if dist <= radius:
        return (POST_LOW_Y, POST_HIGH_Y)
    alpha = math.asin(radius / dist)
    theta = math.atan2(dy, dx)
    run = GOAL_X - shooter[0]
    ys: list[float] = []
    forward = 0
    for ray in (theta - alpha, theta + alpha):
        c = math.cos(ray)
        if c <= 1e-12:
            # The ray never reaches the goal line going forward: it escapes to +-infinity
            # on the side it is pointing.
            ys.append(math.inf if math.sin(ray) > 0 else -math.inf)
        else:
            forward += 1
            ys.append(shooter[1] + run * math.tan(ray))
    if forward == 0:
        return None
    lo = max(min(ys), POST_LOW_Y)
    hi = min(max(ys), POST_HIGH_Y)
    if hi - lo <= _EPS:
        return None
    return (lo, hi)


def merge_intervals(intervals: list[Interval]) -> list[Interval]:
    """Union of closed intervals, returned sorted and non-overlapping."""
    merged: list[Interval] = []
    for lo, hi in sorted(intervals):
        if merged and lo <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], hi))
        else:
            merged.append((lo, hi))
    return merged


def union_length(intervals: list[Interval]) -> float:
    return sum(hi - lo for lo, hi in merge_intervals(intervals))


def complement_on_goal(merged: list[Interval]) -> list[Interval]:
    """Free segments of the goal line given already-merged covered intervals."""
    free: list[Interval] = []
    cursor = POST_LOW_Y
    for lo, hi in merged:
        if lo - cursor > _EPS:
            free.append((cursor, lo))
        cursor = max(cursor, hi)
    if POST_HIGH_Y - cursor > _EPS:
        free.append((cursor, POST_HIGH_Y))
    return free
