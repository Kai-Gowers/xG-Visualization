"""shots.parquet + players.parquet -> features.parquet and a match-level train/test split."""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
from tqdm import tqdm

from xg.features import FEATURE_NAMES, compute_features
from xg.pipeline import paths
from xg.pipeline.players import load_dominant_foot
from xg.scenario import from_shot_row

log = logging.getLogger(__name__)

META_COLUMNS = (
    "shot_id",
    "match_id",
    "competition_id",
    "season_id",
    "player_id",
    "is_goal",
    "statsbomb_xg",
    "has_freeze_frame",
)
TEST_FRACTION = 0.15
SPLIT_SEED = 42

_FOOT: dict[int, str] = {}


def _init_worker(foot: dict[int, str]) -> None:
    global _FOOT
    _FOOT = foot


def _featurise_batch(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for row in rows:
        pid = row.get("player_id")
        foot = _FOOT.get(pid, "Unknown") if pid is not None else "Unknown"
        res = compute_features(from_shot_row(row, foot))
        rec = {k: row.get(k) for k in META_COLUMNS}
        rec["shot_type_raw"] = row.get("shot_type") or "Open Play"
        rec["preferred_foot"] = foot
        rec.update(res.values)
        out.append(rec)
    return out


def _features_schema() -> pa.Schema:
    fields = [
        ("shot_id", pa.string()),
        ("match_id", pa.int32()),
        ("competition_id", pa.int32()),
        ("season_id", pa.int32()),
        ("player_id", pa.int32()),
        ("is_goal", pa.bool_()),
        ("statsbomb_xg", pa.float32()),
        ("has_freeze_frame", pa.bool_()),
        ("shot_type_raw", pa.string()),
        ("preferred_foot", pa.string()),
    ]
    fields += [(name, pa.float32()) for name in FEATURE_NAMES]
    return pa.schema(fields)


def make_splits(
    shots: pa.Table, test_fraction: float = TEST_FRACTION, seed: int = SPLIT_SEED
) -> pa.Table:
    """Hold out ~15% of matches within every competition-season."""
    rng = np.random.default_rng(seed)
    groups: dict[tuple[int, int], set[int]] = defaultdict(set)
    for cid, sid, mid in zip(
        shots["competition_id"].to_pylist(),
        shots["season_id"].to_pylist(),
        shots["match_id"].to_pylist(),
        strict=True,
    ):
        groups[(cid, sid)].add(mid)
    match_ids: list[int] = []
    split: list[str] = []
    for key in sorted(groups):
        mids = sorted(groups[key])
        rng.shuffle(mids)
        n_test = math.ceil(len(mids) * test_fraction) if len(mids) > 1 else 0
        for i, mid in enumerate(mids):
            match_ids.append(mid)
            split.append("test" if i < n_test else "train")
    return pa.table({"match_id": pa.array(match_ids, pa.int32()), "split": split})


def build_features(batch_size: int = 2000, workers: int | None = None) -> Path:
    shots = pq.read_table(paths.SHOTS_PARQUET)
    foot = load_dominant_foot()
    log.info("featurising %d shots", shots.num_rows)

    batches = [shots.slice(i, batch_size).to_pylist() for i in range(0, shots.num_rows, batch_size)]
    records: list[dict[str, Any]] = []
    with ProcessPoolExecutor(
        max_workers=workers, initializer=_init_worker, initargs=(foot,)
    ) as pool:
        for out in tqdm(pool.map(_featurise_batch, batches), total=len(batches), desc="features"):
            records.extend(out)

    table = pa.Table.from_pylist(records, schema=_features_schema())
    paths.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, paths.FEATURES_PARQUET, compression="zstd")
    splits = make_splits(shots)
    pq.write_table(splits, paths.SPLITS_PARQUET)
    n_test = sum(1 for s in splits["split"].to_pylist() if s == "test")
    log.info(
        "wrote %s (%d rows) and %s (%d matches, %d test)",
        paths.FEATURES_PARQUET,
        table.num_rows,
        paths.SPLITS_PARQUET,
        splits.num_rows,
        n_test,
    )
    return paths.FEATURES_PARQUET
