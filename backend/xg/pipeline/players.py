"""Infer each player's dominant foot from how they pass and shoot."""

from __future__ import annotations

import logging
from pathlib import Path

import duckdb

from xg.pipeline import paths

log = logging.getLogger(__name__)

MIN_FOOT_EVENTS = 20
MIN_SHARE = 0.60


def build_players(min_events: int = MIN_FOOT_EVENTS, min_share: float = MIN_SHARE) -> Path:
    paths.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute(
        f"""
        COPY (
          WITH agg AS (
            SELECT
              player_id,
              arg_max(player_name, cnt) AS player_name,
              SUM(n_pass_left)::INTEGER AS n_pass_left,
              SUM(n_pass_right)::INTEGER AS n_pass_right,
              SUM(n_shot_left)::INTEGER AS n_shot_left,
              SUM(n_shot_right)::INTEGER AS n_shot_right,
              SUM(n_shot_head)::INTEGER AS n_shot_head,
              COUNT(DISTINCT match_id)::INTEGER AS n_matches
            FROM (
              SELECT *, COUNT(*) OVER (PARTITION BY player_id, player_name) AS cnt
              FROM read_parquet('{paths.FOOT_COUNTS_PARQUET.as_posix()}')
            )
            GROUP BY player_id
          ),
          scored AS (
            SELECT *,
              n_pass_left + n_shot_left AS n_left,
              n_pass_right + n_shot_right AS n_right,
              n_pass_left + n_shot_left + n_pass_right + n_shot_right AS n_foot_events
            FROM agg
          )
          SELECT
            player_id, player_name,
            n_pass_left, n_pass_right, n_shot_left, n_shot_right, n_shot_head,
            n_foot_events, n_matches,
            CASE WHEN n_foot_events = 0 THEN 0.0
                 ELSE GREATEST(n_left, n_right)::DOUBLE / n_foot_events END AS dominant_share,
            CASE
              WHEN n_foot_events >= {min_events}
                   AND GREATEST(n_left, n_right)::DOUBLE / n_foot_events >= {min_share}
              THEN CASE WHEN n_right >= n_left THEN 'Right' ELSE 'Left' END
              ELSE 'Unknown'
            END AS dominant_foot
          FROM scored
          ORDER BY player_id
        ) TO '{paths.PLAYERS_PARQUET.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)
        """
    )
    n, known = con.execute(
        f"SELECT COUNT(*), SUM(dominant_foot <> 'Unknown') FROM "
        f"read_parquet('{paths.PLAYERS_PARQUET.as_posix()}')"
    ).fetchone()
    log.info("players: %d total, %d with a known dominant foot", n, known)
    return paths.PLAYERS_PARQUET


def load_dominant_foot() -> dict[int, str]:
    con = duckdb.connect()
    rows = con.execute(
        f"SELECT player_id, dominant_foot FROM read_parquet('{paths.PLAYERS_PARQUET.as_posix()}')"
    ).fetchall()
    return {int(pid): foot for pid, foot in rows}
