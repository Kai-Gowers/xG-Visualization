"""Filesystem layout of the (gitignored) data directory."""

from __future__ import annotations

import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("XG_DATA_DIR", "data"))
RAW_DIR = DATA_DIR / "raw" / "statsbomb"
INTERIM_DIR = DATA_DIR / "interim"
PROCESSED_DIR = DATA_DIR / "processed"
LIBRARY_DIR = DATA_DIR / "library"

COMPETITIONS_JSON = RAW_DIR / "competitions.json"
MATCHES_DIR = RAW_DIR / "matches"
EVENTS_DIR = RAW_DIR / "events"
MANIFEST_JSON = RAW_DIR / "manifest.json"

SHOT_SHARDS_DIR = INTERIM_DIR / "shots"
FOOT_COUNTS_PARQUET = INTERIM_DIR / "foot_counts.parquet"
SHOTS_PARQUET = PROCESSED_DIR / "shots.parquet"
PLAYERS_PARQUET = PROCESSED_DIR / "players.parquet"
FEATURES_PARQUET = PROCESSED_DIR / "features.parquet"
SPLITS_PARQUET = PROCESSED_DIR / "splits.parquet"

ARTIFACTS_DIR = Path("artifacts")
MODELS_DIR = ARTIFACTS_DIR / "models"


def event_path(match_id: int) -> Path:
    return EVENTS_DIR / f"{match_id}.json.gz"


def matches_path(competition_id: int, season_id: int) -> Path:
    return MATCHES_DIR / str(competition_id) / f"{season_id}.json"
