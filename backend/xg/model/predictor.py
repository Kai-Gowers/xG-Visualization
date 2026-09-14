"""Scenario -> xG (+ additive explanation) using a loaded artifact. No ``shap`` import."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import xgboost as xgb

from xg.constants import PENALTY
from xg.features import FEATURE_GROUPS, FEATURE_NAMES, compute_features
from xg.model.artifact import Artifact, load_artifact
from xg.model.calibration import logit, sigmoid
from xg.scenario import Scenario

_GROUP_OF: dict[str, str] = {
    name: group for group, names in FEATURE_GROUPS.items() for name in names
}
_MIN_CONTRIB = 1e-6


@dataclass(slots=True)
class Prediction:
    xg: float
    xg_raw: float
    logit: float
    base_value_logit: float
    model_version: str
    rule: str | None
    features: dict[str, float]
    explanation: list[dict[str, Any]] = field(default_factory=list)
    geometry: dict[str, Any] = field(default_factory=dict)


class XGPredictor:
    def __init__(self, artifact: Artifact) -> None:
        self.artifact = artifact
        self.booster = artifact.booster
        self.cal = artifact.calibrator
        self.penalty_xg = float(artifact.spec.get("penalty_xg", 0.76))
        self.base_margin = self._compute_base_margin()

    @classmethod
    def load(cls, path: Path | str) -> XGPredictor:
        return cls(load_artifact(path))

    @property
    def version(self) -> str:
        return self.artifact.version

    def _compute_base_margin(self) -> float:
        zeros = np.zeros((1, len(FEATURE_NAMES)), dtype=np.float32)
        contribs = self.booster.predict(
            xgb.DMatrix(zeros, feature_names=list(FEATURE_NAMES)), pred_contribs=True
        )
        return float(contribs[0, -1])

    def margins(self, matrix: np.ndarray) -> np.ndarray:
        """Raw (uncalibrated) log-odds for an (n, 43) float32 matrix."""
        return np.asarray(self.booster.inplace_predict(matrix, predict_type="margin"))

    def predict_matrix(self, matrix: np.ndarray) -> np.ndarray:
        """Calibrated probabilities for an (n, 43) matrix (no penalty rule)."""
        return np.asarray(self.cal.apply_prob(self.margins(matrix)), dtype=np.float64)

    def predict(self, sc: Scenario, explain: bool = True) -> Prediction:
        res = compute_features(sc)
        if sc.shot_type == PENALTY:
            return Prediction(
                xg=self.penalty_xg,
                xg_raw=self.penalty_xg,
                logit=logit(self.penalty_xg),
                base_value_logit=logit(self.penalty_xg),
                model_version=self.version,
                rule="penalty",
                features=res.values,
                explanation=[],
                geometry=res.geometry,
            )

        row = np.asarray([res.vector], dtype=np.float32)
        if explain:
            contribs = self.booster.predict(
                xgb.DMatrix(row, feature_names=list(FEATURE_NAMES)), pred_contribs=True
            )[0]
            raw_margin = float(contribs.sum())
            explanation = self._group_contributions(contribs[:-1], res.values, sc)
            base = float(contribs[-1])
        else:
            raw_margin = float(self.margins(row)[0])
            explanation = []
            base = self.base_margin

        cal_margin = float(self.cal.apply_logit(raw_margin))
        return Prediction(
            xg=sigmoid(cal_margin),
            xg_raw=sigmoid(raw_margin),
            logit=cal_margin,
            base_value_logit=float(self.cal.apply_logit(base)),
            model_version=self.version,
            rule=None,
            features=res.values,
            explanation=explanation,
            geometry=res.geometry,
        )

    def _group_contributions(
        self, contribs: np.ndarray, values: dict[str, float], sc: Scenario
    ) -> list[dict[str, Any]]:
        grouped: dict[str, float] = {}
        shown: dict[str, Any] = {}
        current = {
            "body_part": sc.body_part,
            "technique": sc.technique,
            "shot_type": sc.shot_type,
            "play_pattern": sc.play_pattern,
        }
        for name, c in zip(FEATURE_NAMES, contribs, strict=True):
            group = _GROUP_OF.get(name)
            key = group or name
            grouped[key] = grouped.get(key, 0.0) + float(c)
            shown[key] = current[group] if group else values[name]
        out = [
            {
                "feature": k,
                "value": shown[k],
                "contribution": float(self.cal.a * v),
            }
            for k, v in grouped.items()
            if abs(v) > _MIN_CONTRIB
        ]
        out.sort(key=lambda d: -abs(d["contribution"]))
        return out
