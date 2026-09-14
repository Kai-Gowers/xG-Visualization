"""Platt scaling on the booster's margin: logit' = a * logit + b.

A linear map on the log-odds keeps additive SHAP contributions additive (each is
scaled by ``a``, the bias shifts by ``b``) and is smooth, so dragging a defender never
produces a step in the xG readout.
"""

from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np


@dataclass(frozen=True, slots=True)
class PlattCalibrator:
    a: float = 1.0
    b: float = 0.0
    applied: bool = False

    def apply_logit(self, margin: np.ndarray | float) -> np.ndarray | float:
        return self.a * margin + self.b

    def apply_prob(self, margin: np.ndarray | float) -> np.ndarray | float:
        z = self.apply_logit(margin)
        return 1.0 / (1.0 + np.exp(-np.asarray(z, dtype=np.float64)))

    @classmethod
    def fit(cls, margins: np.ndarray, y: np.ndarray) -> PlattCalibrator:
        from sklearn.linear_model import LogisticRegression

        lr = LogisticRegression(C=1e6, max_iter=1000)
        lr.fit(margins.reshape(-1, 1), y)
        return cls(a=float(lr.coef_[0][0]), b=float(lr.intercept_[0]), applied=True)

    @classmethod
    def identity(cls) -> PlattCalibrator:
        return cls()

    def save(self, path: Path) -> None:
        path.write_text(json.dumps(asdict(self), indent=1))

    @classmethod
    def load(cls, path: Path) -> PlattCalibrator:
        if not path.exists():
            return cls.identity()
        data = json.loads(path.read_text())
        return cls(a=float(data["a"]), b=float(data["b"]), applied=bool(data.get("applied")))


def sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


def logit(p: float) -> float:
    p = min(max(p, 1e-6), 1 - 1e-6)
    return math.log(p / (1 - p))
