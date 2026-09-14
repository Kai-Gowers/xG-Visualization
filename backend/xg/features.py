"""Feature engineering: Scenario -> ordered feature vector plus drawable geometry.

This module is the only place features are defined. The pipeline calls it once per
historical shot; the API calls it once per request. ``FEATURE_NAMES`` fixes the column
order that the trained booster expects.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from xg.constants import (
    BODY_PARTS,
    DEFENDER_RADIUS,
    DIST_CAP,
    FOOT_BODY_PARTS,
    GK_IMPUTE,
    GK_RADIUS,
    GK_X_CLAMP_MAX,
    GOAL_CENTRE,
    GOAL_CENTRE_Y,
    GOAL_WIDTH,
    GOAL_X,
    PLAY_PATTERNS,
    PRESSURE_RADIUS,
    SHOT_TYPES,
    TECHNIQUES,
    X_CLAMP_MAX,
)
from xg.geometry import (
    Interval,
    Point,
    complement_on_goal,
    distance,
    in_shot_cone,
    merge_intervals,
    occluded_interval,
    union_length,
    visible_goal_angle,
)
from xg.scenario import Scenario

NUMERIC_FEATURES: tuple[str, ...] = (
    "distance_to_goal",
    "angle_to_goal",
    "abs_lateral_offset",
    "shooter_x",
    "n_defenders_in_cone",
    "n_defenders_within_3",
    "closest_defender_distance",
    "closest_defender_in_cone_distance",
    "defenders_covered_fraction",
    "n_teammates_in_cone",
    "gk_present",
    "gk_distance_to_shooter",
    "gk_depth",
    "gk_lateral_offset_toward_shooter",
    "gk_in_cone",
    "gk_covered_fraction",
    "goal_open_fraction",
)
FLAG_FEATURES: tuple[str, ...] = (
    "first_time",
    "under_pressure",
    "one_on_one",
    "open_goal",
    "weak_foot",
    "preferred_foot_known",
)
CATEGORICAL_GROUPS: dict[str, tuple[str, ...]] = {
    "body_part": BODY_PARTS,
    "technique": TECHNIQUES,
    "shot_type": SHOT_TYPES,
    "play_pattern": PLAY_PATTERNS,
}


def _one_hot_names(group: str) -> list[str]:
    return [f"{group}_{v}" for v in CATEGORICAL_GROUPS[group]]


FEATURE_NAMES: tuple[str, ...] = (
    *NUMERIC_FEATURES,
    *(name for group in CATEGORICAL_GROUPS for name in _one_hot_names(group)),
    *FLAG_FEATURES,
)
FEATURE_GROUPS: dict[str, list[str]] = {g: _one_hot_names(g) for g in CATEGORICAL_GROUPS}


@dataclass(frozen=True, slots=True)
class FeatureResult:
    values: dict[str, float]
    vector: list[float]
    geometry: dict[str, Any]


def _cap(d: float) -> float:
    return min(d, DIST_CAP)


def _interval_list(iv: Interval | None) -> list[float] | None:
    return [iv[0], iv[1]] if iv else None


def compute_features(sc: Scenario) -> FeatureResult:
    sx = min(sc.shooter.x, X_CLAMP_MAX)
    sy = sc.shooter.y
    shooter: Point = (sx, sy)
    shooter_clamped = sx != sc.shooter.x
    side = 1.0 if sy >= GOAL_CENTRE_Y else -1.0

    # --- goalkeeper -------------------------------------------------------------
    gk_present = sc.goalkeeper is not None
    gk_raw = sc.goalkeeper.as_tuple() if sc.goalkeeper else GK_IMPUTE
    gk: Point = (min(gk_raw[0], GK_X_CLAMP_MAX), gk_raw[1])
    gk_in_cone = in_shot_cone(shooter, gk)
    gk_interval = occluded_interval(shooter, gk, GK_RADIUS)

    # --- defenders --------------------------------------------------------------
    players_geom: list[dict[str, Any]] = []
    defender_intervals: list[Interval] = []
    n_in_cone = 0
    n_within = 0
    closest = DIST_CAP
    closest_in_cone = DIST_CAP
    for i, d in enumerate(sc.defenders):
        p = d.as_tuple()
        dist = distance(shooter, p)
        cone = in_shot_cone(shooter, p)
        iv = occluded_interval(shooter, p, DEFENDER_RADIUS) if p[0] <= GOAL_X else None
        if cone:
            n_in_cone += 1
            closest_in_cone = min(closest_in_cone, dist)
        if dist <= PRESSURE_RADIUS:
            n_within += 1
        closest = min(closest, dist)
        if iv:
            defender_intervals.append(iv)
        players_geom.append(
            {
                "kind": "defender",
                "index": i,
                "in_cone": cone,
                "distance": dist,
                "goal_interval": _interval_list(iv),
            }
        )

    players_geom.append(
        {
            "kind": "goalkeeper",
            "index": 0,
            "in_cone": gk_in_cone,
            "distance": distance(shooter, gk),
            "goal_interval": _interval_list(gk_interval),
        }
    )

    n_teammates_in_cone = 0
    for i, t in enumerate(sc.teammates):
        p = t.as_tuple()
        cone = in_shot_cone(shooter, p)
        n_teammates_in_cone += cone
        players_geom.append(
            {
                "kind": "teammate",
                "index": i,
                "in_cone": cone,
                "distance": distance(shooter, p),
                "goal_interval": None,
            }
        )

    all_intervals = defender_intervals + ([gk_interval] if gk_interval else [])
    covered = merge_intervals(all_intervals)
    free = complement_on_goal(covered)

    # --- assemble ---------------------------------------------------------------
    values: dict[str, float] = {
        "distance_to_goal": distance(shooter, GOAL_CENTRE),
        "angle_to_goal": visible_goal_angle(shooter),
        "abs_lateral_offset": abs(sy - GOAL_CENTRE_Y),
        "shooter_x": sx,
        "n_defenders_in_cone": float(n_in_cone),
        "n_defenders_within_3": float(n_within),
        "closest_defender_distance": _cap(closest),
        "closest_defender_in_cone_distance": _cap(closest_in_cone),
        "defenders_covered_fraction": union_length(defender_intervals) / GOAL_WIDTH,
        "n_teammates_in_cone": float(n_teammates_in_cone),
        "gk_present": float(gk_present),
        "gk_distance_to_shooter": distance(shooter, gk),
        "gk_depth": GOAL_X - gk[0],
        "gk_lateral_offset_toward_shooter": (gk[1] - GOAL_CENTRE_Y) * side,
        "gk_in_cone": float(gk_in_cone),
        "gk_covered_fraction": (union_length([gk_interval]) if gk_interval else 0.0) / GOAL_WIDTH,
        "goal_open_fraction": 1.0 - union_length(all_intervals) / GOAL_WIDTH,
    }
    current = {
        "body_part": sc.body_part,
        "technique": sc.technique,
        "shot_type": sc.shot_type,
        "play_pattern": sc.play_pattern,
    }
    for group, vocab in CATEGORICAL_GROUPS.items():
        for v in vocab:
            values[f"{group}_{v}"] = float(current[group] == v)

    foot_of_shot = FOOT_BODY_PARTS.get(sc.body_part)
    known = sc.preferred_foot in ("Right", "Left")
    values["first_time"] = float(sc.first_time)
    values["under_pressure"] = float(sc.under_pressure)
    values["one_on_one"] = float(sc.one_on_one)
    values["open_goal"] = float(sc.open_goal)
    values["weak_foot"] = float(
        known and foot_of_shot is not None and foot_of_shot != sc.preferred_foot
    )
    values["preferred_foot_known"] = float(known)

    geometry = {
        "cone": [[sx, sy], [GOAL_X, 36.0], [GOAL_X, 44.0]],
        "shooter_used": {"x": sx, "y": sy, "clamped": shooter_clamped},
        "goalkeeper_used": {"x": gk[0], "y": gk[1], "imputed": not gk_present},
        "players": players_geom,
        "goal_covered_intervals": [[lo, hi] for lo, hi in covered],
        "goal_free_intervals": [[lo, hi] for lo, hi in free],
    }
    return FeatureResult(
        values=values, vector=[values[n] for n in FEATURE_NAMES], geometry=geometry
    )


def feature_spec_base() -> dict[str, Any]:
    """The code-derived part of feature_spec.json (training adds model metadata)."""
    return {
        "units": "statsbomb_yards_120x80",
        "features": list(FEATURE_NAMES),
        "groups": FEATURE_GROUPS,
        "vocab": {g: list(v) for g, v in CATEGORICAL_GROUPS.items()}
        | {"preferred_foot": ["Right", "Left", "Unknown"]},
        "constants": {
            "gk_impute": list(GK_IMPUTE),
            "defender_radius": DEFENDER_RADIUS,
            "gk_radius": GK_RADIUS,
            "pressure_radius": PRESSURE_RADIUS,
            "dist_cap": DIST_CAP,
            "x_clamp_max": X_CLAMP_MAX,
        },
    }
