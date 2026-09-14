import math
import time
from dataclasses import replace

import pytest

from xg.model.calibration import logit
from xg.scenario import Point, Scenario

PEN_SPOT = Scenario(shooter=Point(108, 40), goalkeeper=Point(118, 40), preferred_foot="Right")


def test_penalty_rule(predictor):
    p = predictor.predict(replace(PEN_SPOT, shot_type="Penalty"))
    assert p.rule == "penalty"
    assert p.xg == pytest.approx(0.78)
    assert p.explanation == []
    assert p.geometry["cone"][0] == [108.0, 40.0]


def test_explanation_is_additive_and_grouped(predictor):
    p = predictor.predict(replace(PEN_SPOT, body_part="Left Foot"))
    total = p.base_value_logit + sum(e["contribution"] for e in p.explanation)
    assert total == pytest.approx(p.logit, abs=1e-4)
    assert p.xg == pytest.approx(1 / (1 + math.exp(-p.logit)))
    names = [e["feature"] for e in p.explanation]
    assert "body_part" in names and not any(n.startswith("body_part_") for n in names)
    body = next(e for e in p.explanation if e["feature"] == "body_part")
    assert body["value"] == "Left Foot"
    assert names == sorted(
        names,
        key=lambda n: -abs(next(e for e in p.explanation if e["feature"] == n)["contribution"]),
    )


def test_fast_path_matches_explained_path(predictor):
    a = predictor.predict(PEN_SPOT, explain=True)
    b = predictor.predict(PEN_SPOT, explain=False)
    assert a.xg == pytest.approx(b.xg, abs=1e-6)
    assert b.explanation == []
    assert b.base_value_logit == pytest.approx(a.base_value_logit, abs=1e-6)


def test_closer_is_better_and_defenders_hurt(predictor):
    far = predictor.predict(replace(PEN_SPOT, shooter=Point(95, 40))).xg
    near = predictor.predict(replace(PEN_SPOT, shooter=Point(112, 40))).xg
    assert near > far
    blocked = predictor.predict(
        replace(PEN_SPOT, defenders=(Point(112, 40), Point(113, 39), Point(113, 41)))
    ).xg
    assert blocked < predictor.predict(PEN_SPOT).xg


def test_mirror_symmetry(predictor):
    left = Scenario(
        shooter=Point(104, 30),
        goalkeeper=Point(118.5, 38),
        defenders=(Point(110, 33),),
        preferred_foot="Right",
    )
    right = replace(
        left,
        shooter=Point(104, 50),
        goalkeeper=Point(118.5, 42),
        defenders=(Point(110, 47),),
    )
    assert predictor.predict(left).xg == pytest.approx(predictor.predict(right).xg, abs=1e-9)


def test_latency_budget(predictor):
    sc = replace(PEN_SPOT, defenders=tuple(Point(110 + i, 36 + i) for i in range(8)))
    predictor.predict(sc)
    times = []
    for _ in range(200):
        t = time.perf_counter()
        predictor.predict(sc, explain=True)
        times.append(time.perf_counter() - t)
    times.sort()
    assert times[int(0.95 * len(times))] < 0.020


def test_logit_helper_clamps():
    assert logit(0.5) == 0.0
    assert math.isfinite(logit(0.0)) and math.isfinite(logit(1.0))
