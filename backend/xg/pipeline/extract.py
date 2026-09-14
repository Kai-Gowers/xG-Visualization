"""Raw event files -> shots.parquet (one row per shot) + per-player foot counts.

Each match file is read exactly once. Shots keep their full freeze frame as a nested
list so the library can rebuild the exact scenario later; foot counts feed the
dominant-foot inference in :mod:`xg.pipeline.players`.
"""

from __future__ import annotations

import gzip
import json
import logging
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any

import orjson
import pyarrow as pa
import pyarrow.parquet as pq
from tqdm import tqdm

from xg.pipeline import paths
from xg.scenario import from_statsbomb_shot

log = logging.getLogger(__name__)

FRAME_STRUCT = pa.struct(
    [
        ("x", pa.float32()),
        ("y", pa.float32()),
        ("teammate", pa.bool_()),
        ("is_gk", pa.bool_()),
        ("player_id", pa.int32()),
        ("position_id", pa.int16()),
    ]
)

SHOT_SCHEMA = pa.schema(
    [
        ("shot_id", pa.string()),
        ("match_id", pa.int32()),
        ("competition_id", pa.int32()),
        ("season_id", pa.int32()),
        ("competition_name", pa.string()),
        ("season_name", pa.string()),
        ("competition_gender", pa.string()),
        ("match_date", pa.string()),
        ("home_team", pa.string()),
        ("away_team", pa.string()),
        ("home_score", pa.int16()),
        ("away_score", pa.int16()),
        ("stage", pa.string()),
        ("team_id", pa.int32()),
        ("team_name", pa.string()),
        ("player_id", pa.int32()),
        ("player_name", pa.string()),
        ("position_name", pa.string()),
        ("period", pa.int8()),
        ("minute", pa.int16()),
        ("second", pa.int8()),
        ("timestamp", pa.string()),
        ("possession", pa.int32()),
        ("play_pattern", pa.string()),
        ("shot_type", pa.string()),
        ("body_part", pa.string()),
        ("technique", pa.string()),
        ("x", pa.float32()),
        ("y", pa.float32()),
        ("end_x", pa.float32()),
        ("end_y", pa.float32()),
        ("end_z", pa.float32()),
        ("outcome", pa.string()),
        ("is_goal", pa.bool_()),
        ("statsbomb_xg", pa.float32()),
        ("first_time", pa.bool_()),
        ("one_on_one", pa.bool_()),
        ("open_goal", pa.bool_()),
        ("aerial_won", pa.bool_()),
        ("deflected", pa.bool_()),
        ("follows_dribble", pa.bool_()),
        ("redirect", pa.bool_()),
        ("under_pressure", pa.bool_()),
        ("key_pass_id", pa.string()),
        ("freeze_frame", pa.list_(FRAME_STRUCT)),
        ("n_ff_players", pa.int8()),
        ("gk_present", pa.bool_()),
        ("has_freeze_frame", pa.bool_()),
        ("shot_fidelity_version", pa.string()),
    ]
)

FOOT_SCHEMA = pa.schema(
    [
        ("player_id", pa.int32()),
        ("player_name", pa.string()),
        ("match_id", pa.int32()),
        ("n_pass_left", pa.int32()),
        ("n_pass_right", pa.int32()),
        ("n_shot_left", pa.int32()),
        ("n_shot_right", pa.int32()),
        ("n_shot_head", pa.int32()),
    ]
)

FOOT_KEYS = {
    ("Pass", "Left Foot"): "n_pass_left",
    ("Pass", "Right Foot"): "n_pass_right",
    ("Shot", "Left Foot"): "n_shot_left",
    ("Shot", "Right Foot"): "n_shot_right",
    ("Shot", "Head"): "n_shot_head",
}


def load_match_meta() -> dict[int, dict[str, Any]]:
    """match_id -> competition/season/teams metadata from the cached matches files."""
    comps = {
        (c["competition_id"], c["season_id"]): c
        for c in json.loads(paths.COMPETITIONS_JSON.read_text())
    }
    meta: dict[int, dict[str, Any]] = {}
    for file in paths.MATCHES_DIR.glob("*/*.json"):
        for m in json.loads(file.read_text()):
            cid = m["competition"]["competition_id"]
            sid = m["season"]["season_id"]
            comp = comps.get((cid, sid), {})
            meta[m["match_id"]] = {
                "competition_id": cid,
                "season_id": sid,
                "competition_name": m["competition"]["competition_name"],
                "season_name": m["season"]["season_name"],
                "competition_gender": comp.get("competition_gender", "unknown"),
                "match_date": m.get("match_date"),
                "home_team": m["home_team"]["home_team_name"],
                "away_team": m["away_team"]["away_team_name"],
                "home_score": m.get("home_score"),
                "away_score": m.get("away_score"),
                "stage": (m.get("competition_stage") or {}).get("name"),
                "shot_fidelity_version": (m.get("metadata") or {}).get("shot_fidelity_version"),
            }
    return meta


def _name(obj: dict[str, Any] | None) -> str | None:
    return (obj or {}).get("name")


def _shot_row(ev: dict[str, Any], match_id: int, meta: dict[str, Any]) -> dict[str, Any]:
    shot = ev.get("shot") or {}
    parsed = from_statsbomb_shot(ev)
    end = shot.get("end_location") or [None, None, None]
    end = list(end) + [None] * (3 - len(end))
    outcome = _name(shot.get("outcome"))
    return {
        "shot_id": ev["id"],
        "match_id": match_id,
        **{
            k: meta.get(k)
            for k in (
                "competition_id",
                "season_id",
                "competition_name",
                "season_name",
                "competition_gender",
                "match_date",
                "home_team",
                "away_team",
                "home_score",
                "away_score",
                "stage",
                "shot_fidelity_version",
            )
        },
        "team_id": (ev.get("team") or {}).get("id"),
        "team_name": _name(ev.get("team")),
        "player_id": (ev.get("player") or {}).get("id"),
        "player_name": _name(ev.get("player")),
        "position_name": _name(ev.get("position")),
        "period": ev.get("period"),
        "minute": ev.get("minute"),
        "second": ev.get("second"),
        "timestamp": ev.get("timestamp"),
        "possession": ev.get("possession"),
        "play_pattern": _name(ev.get("play_pattern")),
        "shot_type": _name(shot.get("type")),
        "body_part": _name(shot.get("body_part")),
        "technique": _name(shot.get("technique")),
        "x": parsed.scenario.shooter.x,
        "y": parsed.scenario.shooter.y,
        "end_x": end[0],
        "end_y": end[1],
        "end_z": end[2],
        "outcome": outcome,
        "is_goal": outcome == "Goal",
        "statsbomb_xg": shot.get("statsbomb_xg"),
        "first_time": bool(shot.get("first_time", False)),
        "one_on_one": bool(shot.get("one_on_one", False)),
        "open_goal": bool(shot.get("open_goal", False)),
        "aerial_won": bool(shot.get("aerial_won", False)),
        "deflected": bool(shot.get("deflected", False)),
        "follows_dribble": bool(shot.get("follows_dribble", False)),
        "redirect": bool(shot.get("redirect", False)),
        "under_pressure": bool(ev.get("under_pressure", False)),
        "key_pass_id": shot.get("key_pass_id"),
        "freeze_frame": [
            {
                "x": p.x,
                "y": p.y,
                "teammate": p.teammate,
                "is_gk": p.is_gk,
                "player_id": p.player_id,
                "position_id": p.position_id,
            }
            for p in parsed.frame
        ],
        "n_ff_players": len(parsed.frame),
        "gk_present": parsed.gk_present,
        "has_freeze_frame": parsed.has_freeze_frame,
    }


def extract_match(
    match_id: int, meta: dict[str, Any]
) -> tuple[list[dict[str, Any]], dict[int, dict[str, Any]]]:
    with gzip.open(paths.event_path(match_id), "rb") as fh:
        events = orjson.loads(fh.read())
    shots: list[dict[str, Any]] = []
    feet: dict[int, dict[str, Any]] = defaultdict(
        lambda: {"player_name": None, "counts": Counter()}
    )
    for ev in events:
        kind = _name(ev.get("type"))
        if kind not in ("Shot", "Pass"):
            continue
        player = ev.get("player") or {}
        pid = player.get("id")
        body = _name((ev.get(kind.lower()) or {}).get("body_part"))
        key = FOOT_KEYS.get((kind, body))
        if pid is not None and key:
            feet[pid]["player_name"] = player.get("name")
            feet[pid]["counts"][key] += 1
        if kind == "Shot" and ev.get("location") and (ev.get("shot") or {}).get("outcome"):
            shots.append(_shot_row(ev, match_id, meta))
    return shots, dict(feet)


def _extract_worker(args: tuple[int, dict[str, Any]]) -> tuple[list[dict[str, Any]], dict]:
    return extract_match(*args)


def _foot_rows(match_id: int, feet: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for pid, info in feet.items():
        row = {"player_id": pid, "player_name": info["player_name"], "match_id": match_id}
        row.update({k: 0 for k in FOOT_SCHEMA.names if k.startswith("n_")})
        row.update(info["counts"])
        rows.append(row)
    return rows


def extract(workers: int | None = None) -> Path:
    meta = load_match_meta()
    match_ids = sorted(int(p.name.split(".")[0]) for p in paths.EVENTS_DIR.glob("*.json.gz"))
    match_ids = [m for m in match_ids if m in meta]
    log.info("extracting %d matches", len(match_ids))
    paths.SHOT_SHARDS_DIR.mkdir(parents=True, exist_ok=True)
    for old in paths.SHOT_SHARDS_DIR.glob("*.parquet"):
        old.unlink()

    by_comp: dict[tuple[int, int], list[int]] = defaultdict(list)
    for mid in match_ids:
        by_comp[(meta[mid]["competition_id"], meta[mid]["season_id"])].append(mid)

    foot_rows: list[dict[str, Any]] = []
    n_shots = 0
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for (cid, sid), mids in tqdm(sorted(by_comp.items()), desc="competitions"):
            shard_rows: list[dict[str, Any]] = []
            jobs = [(mid, meta[mid]) for mid in mids]
            for mid, (shots, feet) in zip(mids, pool.map(_extract_worker, jobs), strict=True):
                shard_rows.extend(shots)
                foot_rows.extend(_foot_rows(mid, feet))
            table = pa.Table.from_pylist(shard_rows, schema=SHOT_SCHEMA)
            pq.write_table(
                table, paths.SHOT_SHARDS_DIR / f"{cid}_{sid}.parquet", compression="zstd"
            )
            n_shots += table.num_rows

    pq.write_table(
        pa.Table.from_pylist(foot_rows, schema=FOOT_SCHEMA),
        paths.FOOT_COUNTS_PARQUET,
        compression="zstd",
    )
    shards = [pq.read_table(p) for p in sorted(paths.SHOT_SHARDS_DIR.glob("*.parquet"))]
    paths.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.concat_tables(shards), paths.SHOTS_PARQUET, compression="zstd")
    log.info("wrote %d shots to %s", n_shots, paths.SHOTS_PARQUET)
    return paths.SHOTS_PARQUET
