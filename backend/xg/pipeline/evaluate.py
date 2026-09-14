"""Held-out evaluation: our model vs StatsBomb xG vs a distance+angle baseline, with plots."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pyarrow.parquet as pq
import xgboost as xgb
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score, roc_curve

from xg.features import FEATURE_GROUPS, FEATURE_NAMES
from xg.model.artifact import METRICS_FILE, load_artifact
from xg.model.predictor import XGPredictor
from xg.pipeline import paths
from xg.pipeline.train import load_training_frame

log = logging.getLogger(__name__)

DISTANCE_BINS = [0, 6, 12, 18, 24, 30, 100]
DISTANCE_LABELS = ["0-6", "6-12", "12-18", "18-24", "24-30", "30+"]


def ece(y: np.ndarray, p: np.ndarray, bins: int = 10) -> float:
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges) - 1, 0, bins - 1)
    total = 0.0
    for b in range(bins):
        mask = idx == b
        if mask.any():
            total += abs(p[mask].mean() - y[mask].mean()) * mask.sum() / len(p)
    return float(total)


def metrics(y: np.ndarray, p: np.ndarray) -> dict[str, float]:
    if len(y) == 0 or len(np.unique(y)) < 2:
        return {"n": int(len(y))}
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return {
        "logloss": float(log_loss(y, p, labels=[0, 1])),
        "brier": float(brier_score_loss(y, p)),
        "auroc": float(roc_auc_score(y, p)),
        "ece": ece(y, p),
        "n": int(len(y)),
        "mean_pred": float(p.mean()),
        "goal_rate": float(y.mean()),
    }


def _body_part(df: pd.DataFrame) -> pd.Series:
    cols = FEATURE_GROUPS["body_part"]
    return df[cols].idxmax(axis=1).str.replace("body_part_", "", regex=False)


def _plots(
    out_dir: Path,
    y: np.ndarray,
    ours: np.ndarray,
    sb: np.ndarray | None,
    booster: xgb.Booster,
    contribs: np.ndarray,
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    out_dir.mkdir(parents=True, exist_ok=True)

    # Reliability diagram
    fig, ax = plt.subplots(figsize=(5, 5))
    edges = np.linspace(0, 1, 11)
    for name, p in (("ours", ours), ("statsbomb", sb)):
        if p is None:
            continue
        idx = np.clip(np.digitize(p, edges) - 1, 0, 9)
        xs, ys = [], []
        for b in range(10):
            m = idx == b
            if m.sum() >= 20:
                xs.append(p[m].mean())
                ys.append(y[m].mean())
        ax.plot(xs, ys, marker="o", label=name)
    ax.plot([0, 1], [0, 1], "k--", lw=1)
    ax.set_xlabel("predicted xG")
    ax.set_ylabel("goal rate")
    ax.set_title("Reliability (test matches)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(out_dir / "reliability.png", dpi=120)
    plt.close(fig)

    # ROC
    fig, ax = plt.subplots(figsize=(5, 5))
    for name, p in (("ours", ours), ("statsbomb", sb)):
        if p is None:
            continue
        fpr, tpr, _ = roc_curve(y, p)
        ax.plot(fpr, tpr, label=f"{name} AUC={roc_auc_score(y, p):.3f}")
    ax.plot([0, 1], [0, 1], "k--", lw=1)
    ax.set_xlabel("FPR")
    ax.set_ylabel("TPR")
    ax.legend()
    fig.tight_layout()
    fig.savefig(out_dir / "roc.png", dpi=120)
    plt.close(fig)

    if sb is not None:
        fig, ax = plt.subplots(figsize=(5, 5))
        ax.scatter(sb, ours, s=4, alpha=0.3)
        ax.plot([0, 1], [0, 1], "r--", lw=1)
        ax.set_xlabel("StatsBomb xG")
        ax.set_ylabel("our xG")
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.set_title(f"r={np.corrcoef(sb, ours)[0, 1]:.3f}, MAE={np.abs(sb - ours).mean():.3f}")
        fig.tight_layout()
        fig.savefig(out_dir / "ours_vs_statsbomb.png", dpi=120)
        plt.close(fig)

    # Importance: mean |contribution| on the test set
    mean_abs = pd.Series(np.abs(contribs[:, :-1]).mean(axis=0), index=list(FEATURE_NAMES))
    top = mean_abs.sort_values(ascending=True).tail(20)
    fig, ax = plt.subplots(figsize=(7, 6))
    top.plot.barh(ax=ax)
    ax.set_xlabel("mean |log-odds contribution|")
    ax.set_title("Feature importance (test set)")
    fig.tight_layout()
    fig.savefig(out_dir / "importance.png", dpi=120)
    plt.close(fig)


def evaluate(model_dir: Path | str) -> dict[str, Any]:
    artifact = load_artifact(model_dir)
    predictor = XGPredictor(artifact)
    df = load_training_frame()
    shots_meta = pq.read_table(
        paths.SHOTS_PARQUET, columns=["shot_id", "competition_gender", "competition_name"]
    ).to_pandas()
    df = df.merge(shots_meta, on="shot_id", how="left")
    model_df = df[(df["shot_type_raw"] != "Penalty") & df["has_freeze_frame"]]
    train_df = model_df[model_df["split"] == "train"]
    test_df = model_df[model_df["split"] == "test"].reset_index(drop=True)

    X_test = test_df[list(FEATURE_NAMES)].to_numpy(np.float32)
    y = test_df["is_goal"].to_numpy(np.float32)
    ours = predictor.predict_matrix(X_test)
    test_df = test_df.assign(xg_model=ours)

    result: dict[str, Any] = {
        "model_version": artifact.version,
        "test": metrics(y, ours),
        "train_goal_rate": float(train_df["is_goal"].mean()),
    }

    sb_mask = test_df["statsbomb_xg"].notna().to_numpy()
    sb = test_df.loc[sb_mask, "statsbomb_xg"].to_numpy(np.float64)
    if sb_mask.sum() > 0:
        result["statsbomb_benchmark"] = {
            "statsbomb": metrics(y[sb_mask], sb),
            "ours_same_shots": metrics(y[sb_mask], ours[sb_mask]),
            "mae_vs_statsbomb": float(np.abs(sb - ours[sb_mask]).mean()),
            "corr_vs_statsbomb": float(np.corrcoef(sb, ours[sb_mask])[0, 1]),
        }

    base_cols = ["distance_to_goal", "angle_to_goal"]
    lr = LogisticRegression(max_iter=1000)
    lr.fit(train_df[base_cols].to_numpy(np.float32), train_df["is_goal"].to_numpy(np.float32))
    result["baseline_distance_angle"] = metrics(
        y, lr.predict_proba(test_df[base_cols].to_numpy(np.float32))[:, 1]
    )

    segments: dict[str, dict[str, Any]] = {}
    seg_frames = {
        "body_part": _body_part(test_df),
        "shot_type": test_df["shot_type_raw"],
        "distance_bucket": pd.cut(
            test_df["distance_to_goal"], DISTANCE_BINS, labels=DISTANCE_LABELS, right=False
        ).astype(str),
        "gender": test_df["competition_gender"].fillna("unknown"),
        "gk_present": test_df["gk_present"].map({1.0: "present", 0.0: "missing"}),
        "weak_foot": test_df["weak_foot"].map({1.0: "weak", 0.0: "strong_or_na"}),
    }
    for seg_name, series in seg_frames.items():
        segments[seg_name] = {}
        for value, idx in test_df.groupby(series).groups.items():
            rows = test_df.loc[idx]
            m = metrics(rows["is_goal"].to_numpy(np.float32), rows["xg_model"].to_numpy())
            if "statsbomb_xg" in rows and rows["statsbomb_xg"].notna().all() and "brier" in m:
                m["statsbomb_brier"] = float(
                    brier_score_loss(rows["is_goal"], rows["statsbomb_xg"].clip(1e-6, 1 - 1e-6))
                )
            segments[seg_name][str(value)] = m
    result["segments"] = segments

    sample = test_df.sample(min(len(test_df), 5000), random_state=0)
    contribs = artifact.booster.predict(
        xgb.DMatrix(
            sample[list(FEATURE_NAMES)].to_numpy(np.float32), feature_names=list(FEATURE_NAMES)
        ),
        pred_contribs=True,
    )
    result["mean_abs_contribution"] = dict(
        sorted(
            zip(FEATURE_NAMES, np.abs(contribs[:, :-1]).mean(axis=0).tolist(), strict=True),
            key=lambda kv: -kv[1],
        )
    )
    _plots(
        artifact.path / "plots",
        y,
        ours,
        sb if sb_mask.all() else None,
        artifact.booster,
        contribs,
    )

    (artifact.path / METRICS_FILE).write_text(json.dumps(result, indent=1))
    t = result["test"]
    log.info(
        "test: logloss %.4f brier %.4f auroc %.4f ece %.4f (n=%d)",
        t["logloss"],
        t["brier"],
        t["auroc"],
        t["ece"],
        t["n"],
    )
    if "statsbomb_benchmark" in result:
        s = result["statsbomb_benchmark"]["statsbomb"]
        log.info(
            "statsbomb: logloss %.4f brier %.4f auroc %.4f", s["logloss"], s["brier"], s["auroc"]
        )
    return result
