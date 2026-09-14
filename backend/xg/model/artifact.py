"""A model artifact is a directory: model.ubj + feature_spec.json + calibrator.json (+ metrics)."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import xgboost as xgb

from xg.features import FEATURE_NAMES
from xg.model.calibration import PlattCalibrator

log = logging.getLogger(__name__)

MODEL_FILE = "model.ubj"
SPEC_FILE = "feature_spec.json"
CALIBRATOR_FILE = "calibrator.json"
METRICS_FILE = "metrics.json"
CONFIG_FILE = "training_config.json"


@dataclass(slots=True)
class Artifact:
    path: Path
    booster: xgb.Booster
    spec: dict[str, Any]
    calibrator: PlattCalibrator
    metrics: dict[str, Any]

    @property
    def version(self) -> str:
        return str(self.spec["model_version"])


def save_artifact(
    path: Path,
    booster: xgb.Booster,
    spec: dict[str, Any],
    calibrator: PlattCalibrator,
    config: dict[str, Any],
) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    booster.save_model(path / MODEL_FILE)
    (path / SPEC_FILE).write_text(json.dumps(spec, indent=1))
    calibrator.save(path / CALIBRATOR_FILE)
    (path / CONFIG_FILE).write_text(json.dumps(config, indent=1, default=str))
    log.info("saved artifact to %s", path)
    return path


def load_artifact(path: Path | str) -> Artifact:
    path = Path(path).resolve()
    booster = xgb.Booster()
    booster.load_model(path / MODEL_FILE)
    spec = json.loads((path / SPEC_FILE).read_text())
    if list(spec["features"]) != list(FEATURE_NAMES):
        raise RuntimeError(
            f"artifact {path} was trained on a different feature list than this code; retrain"
        )
    names = booster.feature_names
    if names is not None and list(names) != list(FEATURE_NAMES):
        raise RuntimeError(f"booster feature names in {path} do not match the feature spec")
    metrics_path = path / METRICS_FILE
    metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}
    return Artifact(
        path=path,
        booster=booster,
        spec=spec,
        calibrator=PlattCalibrator.load(path / CALIBRATOR_FILE),
        metrics=metrics,
    )


def set_current(models_dir: Path, version: str) -> None:
    """Point ``models_dir/current`` at ``models_dir/xg-v{version}``."""
    link = models_dir / "current"
    if link.is_symlink() or link.exists():
        link.unlink()
    link.symlink_to(f"xg-v{version}")
