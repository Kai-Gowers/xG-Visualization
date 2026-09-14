"""Session fixtures: a small synthetic model artifact and a tiny shot library.

Nothing here touches the real data directory, so the suite runs on a fresh clone.
"""

from __future__ import annotations

import math
import random
import uuid
from pathlib import Path

import numpy as np
import pyarrow as pa
import pytest
import xgboost as xgb
from fastapi.testclient import TestClient

from xg.api.app import create_app
from xg.api.config import Settings
from xg.features import FEATURE_NAMES, compute_features, feature_spec_base
from xg.model.artifact import save_artifact
from xg.model.calibration import PlattCalibrator
from xg.model.predictor import XGPredictor
from xg.pipeline.extract import SHOT_SCHEMA
from xg.pipeline.library import annotate_shots, write_library
from xg.scenario import Point, Scenario, from_shot_row

BODY_PARTS = ("Right Foot", "Left Foot", "Head")
TECHNIQUES = ("Normal", "Volley", "Half Volley", "Lob")


def _random_scenario(rng: random.Random) -> Scenario:
    shooter = Point(rng.uniform(85, 119), rng.uniform(15, 65))
    n_def = rng.randint(0, 5)
    defenders = tuple(
        Point(rng.uniform(shooter.x, 119.5), rng.uniform(25, 55)) for _ in range(n_def)
    )
    gk = Point(rng.uniform(115, 119.5), rng.uniform(35, 45)) if rng.random() > 0.05 else None
    return Scenario(
        shooter=shooter,
        goalkeeper=gk,
        defenders=defenders,
        teammates=tuple(
            Point(rng.uniform(90, 118), rng.uniform(20, 60)) for _ in range(rng.randint(0, 2))
        ),
        body_part=rng.choice(BODY_PARTS),
        technique=rng.choice(TECHNIQUES),
        first_time=rng.random() < 0.3,
        under_pressure=rng.random() < 0.3,
        preferred_foot=rng.choice(("Right", "Left", "Unknown")),
    )


def _synthetic_label(values: dict[str, float], rng: random.Random) -> int:
    z = (
        1.5
        - 0.18 * values["distance_to_goal"]
        + 1.2 * values["angle_to_goal"]
        + 1.6 * values["goal_open_fraction"]
        - 0.4 * values["n_defenders_in_cone"]
        - 0.5 * values["weak_foot"]
        - 0.6 * values["body_part_Head"]
    )
    return int(rng.random() < 1 / (1 + math.exp(-z)))


@pytest.fixture(scope="session")
def artifact_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    rng = random.Random(0)
    rows, labels = [], []
    for _ in range(4000):
        res = compute_features(_random_scenario(rng))
        rows.append(res.vector)
        labels.append(_synthetic_label(res.values, rng))
    dtrain = xgb.DMatrix(
        np.asarray(rows, dtype=np.float32),
        label=np.asarray(labels, dtype=np.float32),
        feature_names=list(FEATURE_NAMES),
    )
    monotone = {"distance_to_goal": -1, "angle_to_goal": 1, "goal_open_fraction": 1}
    params = {
        "objective": "binary:logistic",
        "max_depth": 3,
        "learning_rate": 0.1,
        "monotone_constraints": tuple(monotone.get(f, 0) for f in FEATURE_NAMES),
        "seed": 0,
        "nthread": 2,
    }
    booster = xgb.train(params, dtrain, num_boost_round=120)
    spec = feature_spec_base() | {
        "model_version": "test",
        "created_at": "2026-01-01T00:00:00+00:00",
        "library": "xgboost",
        "library_version": xgb.__version__,
        "penalty_xg": 0.78,
        "monotone_constraints": monotone,
        "training_data": {"n_train_shots": 4000, "synthetic": True},
    }
    out = tmp_path_factory.mktemp("models") / "xg-vtest"
    save_artifact(out, booster, spec, PlattCalibrator.identity(), {"params": params})
    return out


@pytest.fixture(scope="session")
def predictor(artifact_dir: Path) -> XGPredictor:
    return XGPredictor.load(artifact_dir)


def _shot_rows(rng: random.Random) -> list[dict]:
    rows = []
    matches = [
        (1001, 55, 282, "UEFA Euro", "2024", "2024-07-14", "Spain", "England"),
        (1002, 43, 106, "FIFA World Cup", "2022", "2022-12-18", "Argentina", "France"),
    ]
    players = [(10, "Alice Striker"), (11, "Bob Winger"), (12, "Cara Forward")]
    for match_id, cid, sid, comp, season, date, home, away in matches:
        for i in range(12):
            sc = _random_scenario(rng)
            pid, pname = players[i % 3]
            is_pen = i == 11
            frame = [
                {
                    "x": d.x,
                    "y": d.y,
                    "teammate": False,
                    "is_gk": False,
                    "player_id": 100 + k,
                    "position_id": 3,
                }
                for k, d in enumerate(sc.defenders)
            ]
            if sc.goalkeeper:
                frame.append(
                    {
                        "x": sc.goalkeeper.x,
                        "y": sc.goalkeeper.y,
                        "teammate": False,
                        "is_gk": True,
                        "player_id": 99,
                        "position_id": 1,
                    }
                )
            frame += [
                {
                    "x": t.x,
                    "y": t.y,
                    "teammate": True,
                    "is_gk": False,
                    "player_id": 200 + k,
                    "position_id": 23,
                }
                for k, t in enumerate(sc.teammates)
            ]
            goal = rng.random() < 0.3
            rows.append(
                {
                    "shot_id": str(uuid.UUID(int=rng.getrandbits(128))),
                    "match_id": match_id,
                    "competition_id": cid,
                    "season_id": sid,
                    "competition_name": comp,
                    "season_name": season,
                    "competition_gender": "male",
                    "match_date": date,
                    "home_team": home,
                    "away_team": away,
                    "home_score": 2,
                    "away_score": 1,
                    "stage": "Final",
                    "team_id": 1,
                    "team_name": home,
                    "player_id": pid,
                    "player_name": pname,
                    "position_name": "Center Forward",
                    "period": 1 + i // 6,
                    "minute": 5 * i,
                    "second": 0,
                    "timestamp": "00:00:00.000",
                    "possession": i,
                    "play_pattern": "Regular Play",
                    "shot_type": "Penalty" if is_pen else "Open Play",
                    "body_part": sc.body_part,
                    "technique": sc.technique,
                    "x": 108.0 if is_pen else sc.shooter.x,
                    "y": 40.0 if is_pen else sc.shooter.y,
                    "end_x": 120.0,
                    "end_y": 39.0,
                    "end_z": 0.5,
                    "outcome": "Goal" if goal else "Saved",
                    "is_goal": goal,
                    "statsbomb_xg": rng.uniform(0.02, 0.6),
                    "first_time": sc.first_time,
                    "one_on_one": False,
                    "open_goal": False,
                    "aerial_won": False,
                    "deflected": False,
                    "follows_dribble": False,
                    "redirect": False,
                    "under_pressure": sc.under_pressure,
                    "key_pass_id": None,
                    "freeze_frame": [] if is_pen else frame,
                    "n_ff_players": 0 if is_pen else len(frame),
                    "gk_present": (not is_pen) and sc.goalkeeper is not None,
                    "has_freeze_frame": not is_pen and len(frame) > 0,
                    "shot_fidelity_version": "2",
                }
            )
    return rows


@pytest.fixture(scope="session")
def library_dir(tmp_path_factory: pytest.TempPathFactory, predictor: XGPredictor) -> Path:
    rng = random.Random(1)
    rows = _shot_rows(rng)
    shots = pa.Table.from_pylist(rows, schema=SHOT_SCHEMA)
    players = pa.table(
        {
            "player_id": pa.array([10, 11, 12, 99, 100, 101], pa.int32()),
            "player_name": [
                "Alice Striker",
                "Bob Winger",
                "Cara Forward",
                "Gigi Keeper",
                "Dan Back",
                "Ed Back",
            ],
            "dominant_foot": ["Right", "Left", "Unknown", "Right", "Right", "Left"],
        }
    )
    foot = dict(
        zip(players["player_id"].to_pylist(), players["dominant_foot"].to_pylist(), strict=True)
    )
    feat_rows = []
    for row in rows:
        res = compute_features(from_shot_row(row, foot.get(row["player_id"], "Unknown")))
        feat_rows.append({"shot_id": row["shot_id"], **res.values})
    features = pa.Table.from_pylist(feat_rows)
    annotated = annotate_shots(shots, features, players, predictor)
    out = tmp_path_factory.mktemp("library")
    write_library(annotated, players, out, {(55, 282): True})
    return out


@pytest.fixture(scope="session")
def client(artifact_dir: Path, library_dir: Path):
    app = create_app(Settings(model_dir=artifact_dir, library_dir=library_dir))
    with TestClient(app) as c:
        yield c
