"""Tune, fit, calibrate and save an XGBoost xG model as a versioned artifact."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import optuna
import pandas as pd
import pyarrow.parquet as pq
import xgboost as xgb
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import GroupKFold

from xg.features import FEATURE_NAMES, feature_spec_base
from xg.model.artifact import save_artifact, set_current
from xg.model.calibration import PlattCalibrator
from xg.pipeline import paths

log = logging.getLogger(__name__)

MONOTONE = {
    "distance_to_goal": -1,
    "angle_to_goal": 1,
    "goal_open_fraction": 1,
    "n_defenders_in_cone": -1,
    "defenders_covered_fraction": -1,
}
N_FOLDS = 5
MAX_ROUNDS = 3000
EARLY_STOP = 100
FALLBACK_PENALTY_XG = 0.76
MIN_CALIBRATION_GAIN = 2e-4


def load_training_frame() -> pd.DataFrame:
    feats = pq.read_table(paths.FEATURES_PARQUET).to_pandas()
    splits = pq.read_table(paths.SPLITS_PARQUET).to_pandas()
    df = feats.merge(splits, on="match_id", how="left")
    df["split"] = df["split"].fillna("train")
    return df


def base_params(seed: int, nthread: int = 8) -> dict[str, Any]:
    return {
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "tree_method": "hist",
        "nthread": nthread,
        "seed": seed,
        "monotone_constraints": tuple(MONOTONE.get(f, 0) for f in FEATURE_NAMES),
    }


def _dmatrix(df: pd.DataFrame) -> xgb.DMatrix:
    return xgb.DMatrix(
        df[list(FEATURE_NAMES)].to_numpy(np.float32),
        label=df["is_goal"].to_numpy(np.float32),
        feature_names=list(FEATURE_NAMES),
    )


def cross_validate(
    train_df: pd.DataFrame, params: dict[str, Any], seed: int
) -> tuple[float, list[int], np.ndarray]:
    """Grouped CV by match. Returns (mean logloss, best iterations, OOF margins)."""
    gkf = GroupKFold(n_splits=N_FOLDS)
    oof = np.zeros(len(train_df), dtype=np.float64)
    losses, iters = [], []
    y = train_df["is_goal"].to_numpy(np.float32)
    for fold_train, fold_val in gkf.split(train_df, y, groups=train_df["match_id"]):
        dtr = _dmatrix(train_df.iloc[fold_train])
        dva = _dmatrix(train_df.iloc[fold_val])
        booster = xgb.train(
            params,
            dtr,
            num_boost_round=MAX_ROUNDS,
            evals=[(dva, "val")],
            early_stopping_rounds=EARLY_STOP,
            verbose_eval=False,
        )
        best = booster.best_iteration
        margins = booster.predict(dva, iteration_range=(0, best + 1), output_margin=True)
        oof[fold_val] = margins
        p = 1 / (1 + np.exp(-margins))
        losses.append(log_loss(y[fold_val], p, labels=[0, 1]))
        iters.append(best + 1)
    return float(np.mean(losses)), iters, oof


def tune(train_df: pd.DataFrame, trials: int, seed: int) -> dict[str, Any]:
    def objective(trial: optuna.Trial) -> float:
        params = base_params(seed) | {
            "max_depth": trial.suggest_int("max_depth", 3, 7),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.1, log=True),
            "min_child_weight": trial.suggest_float("min_child_weight", 1.0, 50.0, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-2, 10.0, log=True),
            "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 5.0),
            "gamma": trial.suggest_float("gamma", 0.0, 5.0),
        }
        loss, iters, _ = cross_validate(train_df, params, seed)
        trial.set_user_attr("iters", iters)
        return loss

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    study = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=seed))
    study.optimize(objective, n_trials=trials, show_progress_bar=True)
    log.info("best CV logloss %.5f with %s", study.best_value, study.best_params)
    return study.best_params | {"_iters": study.best_trial.user_attrs["iters"]}


def _metrics(y: np.ndarray, p: np.ndarray) -> dict[str, float]:
    return {
        "logloss": float(log_loss(y, p, labels=[0, 1])),
        "brier": float(brier_score_loss(y, p)),
        "auroc": float(roc_auc_score(y, p)),
        "n": int(len(y)),
    }


def train(version: str, trials: int = 60, seed: int = 42) -> Path:
    df = load_training_frame()
    penalties = df[df["shot_type_raw"] == "Penalty"]
    train_pens = penalties[penalties["split"] == "train"]
    penalty_xg = (
        float(train_pens["is_goal"].mean()) if len(train_pens) >= 20 else FALLBACK_PENALTY_XG
    )
    model_df = df[(df["shot_type_raw"] != "Penalty") & df["has_freeze_frame"]].reset_index(
        drop=True
    )
    train_df = model_df[model_df["split"] == "train"].reset_index(drop=True)
    test_df = model_df[model_df["split"] == "test"].reset_index(drop=True)
    log.info(
        "train %d shots (%d matches), test %d shots, penalty_xg=%.3f",
        len(train_df),
        train_df["match_id"].nunique(),
        len(test_df),
        penalty_xg,
    )

    best = tune(train_df, trials, seed)
    iters = best.pop("_iters")
    params = base_params(seed) | best
    n_rounds = int(np.mean(iters) * 1.1)

    # One more grouped pass with the chosen params to get honest OOF margins for Platt.
    _, _, oof_margins = cross_validate(train_df, params, seed)

    booster = xgb.train(params, _dmatrix(train_df), num_boost_round=n_rounds)

    y_test = test_df["is_goal"].to_numpy(np.float32)
    test_margin = booster.predict(_dmatrix(test_df), output_margin=True)
    p_raw = 1 / (1 + np.exp(-test_margin))
    raw_metrics = _metrics(y_test, p_raw)

    platt = PlattCalibrator.fit(oof_margins, train_df["is_goal"].to_numpy(np.float32))
    p_cal = np.asarray(platt.apply_prob(test_margin))
    cal_metrics = _metrics(y_test, p_cal)
    if raw_metrics["brier"] - cal_metrics["brier"] >= MIN_CALIBRATION_GAIN:
        calibrator = platt
        log.info(
            "keeping Platt calibration: brier %.5f -> %.5f",
            raw_metrics["brier"],
            cal_metrics["brier"],
        )
    else:
        calibrator = PlattCalibrator.identity()
        log.info(
            "calibration did not help (brier %.5f vs %.5f); using identity",
            raw_metrics["brier"],
            cal_metrics["brier"],
        )

    manifest = json.loads(paths.MANIFEST_JSON.read_text()) if paths.MANIFEST_JSON.exists() else {}
    spec = feature_spec_base() | {
        "model_version": version,
        "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "library": "xgboost",
        "library_version": xgb.__version__,
        "penalty_xg": penalty_xg,
        "monotone_constraints": MONOTONE,
        "n_rounds": n_rounds,
        "training_data": {
            "open_data_commit": manifest.get("open_data_commit"),
            "n_train_shots": int(len(train_df)),
            "n_test_shots": int(len(test_df)),
            "n_train_matches": int(train_df["match_id"].nunique()),
            "n_test_matches": int(test_df["match_id"].nunique()),
            "n_competition_seasons": int(
                model_df[["competition_id", "season_id"]].drop_duplicates().shape[0]
            ),
            "excluded": ["Penalty", "no_freeze_frame"],
        },
    }
    config = {
        "params": params,
        "best_iterations_per_fold": iters,
        "n_rounds": n_rounds,
        "trials": trials,
        "seed": seed,
        "preliminary_test_metrics": {"raw": raw_metrics, "calibrated": cal_metrics},
    }
    out = paths.MODELS_DIR / f"xg-v{version}"
    save_artifact(out, booster, spec, calibrator, config)
    set_current(paths.MODELS_DIR, version)
    return out
