"""Build the real-shot library: shots annotated with our xG, plus match/competition indexes."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import duckdb
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from xg.features import FEATURE_NAMES
from xg.model.predictor import XGPredictor
from xg.pipeline import paths

log = logging.getLogger(__name__)

SHOT_LIBRARY_FILE = "shot_library.parquet"
MATCHES_FILE = "matches.parquet"
COMPETITIONS_FILE = "competitions.parquet"
PLAYERS_FILE = "players.parquet"


def annotate_shots(
    shots: pa.Table, features: pa.Table, players: pa.Table, predictor: XGPredictor
) -> pa.Table:
    """Join shots with dominant foot and add xg_model / xg_diff / weak_foot / model_version."""
    con = duckdb.connect()
    con.register("shots", shots)
    con.register("features", features)
    con.register("players", players)
    joined = con.execute(
        f"""
        SELECT s.*, COALESCE(p.dominant_foot, 'Unknown') AS dominant_foot,
               f.weak_foot AS weak_foot_f,
               {", ".join(f'f."{n}" AS "feat__{n}"' for n in FEATURE_NAMES)}
        FROM shots s
        LEFT JOIN features f USING (shot_id)
        LEFT JOIN players p USING (player_id)
        ORDER BY s.match_id, s.period, s.minute, s.second
        """
    ).fetch_arrow_table()
    n = joined.num_rows
    matrix = np.column_stack(
        [
            np.nan_to_num(joined[f"feat__{name}"].to_numpy(zero_copy_only=False), nan=0.0)
            for name in FEATURE_NAMES
        ]
    ).astype(np.float32)
    xg_model = np.full(n, np.nan)
    shot_type = np.asarray(joined["shot_type"].to_pylist(), dtype=object)
    has_ff = np.asarray(joined["has_freeze_frame"].to_pylist(), dtype=bool)
    is_pen = shot_type == "Penalty"
    scorable = has_ff & ~is_pen
    if scorable.any():
        xg_model[scorable] = predictor.predict_matrix(matrix[scorable])
    xg_model[is_pen] = predictor.penalty_xg

    sb = np.asarray(
        [v if v is not None else np.nan for v in joined["statsbomb_xg"].to_pylist()], dtype=float
    )
    weak = np.nan_to_num(joined["weak_foot_f"].to_numpy(zero_copy_only=False), nan=0.0)
    keep = [c for c in joined.column_names if c != "weak_foot_f" and not c.startswith("feat__")]
    out = joined.select(keep)
    out = out.append_column("xg_model", pa.array(xg_model, pa.float32()))
    out = out.append_column("xg_diff", pa.array(xg_model - sb, pa.float32()))
    out = out.append_column("weak_foot", pa.array(weak.astype(bool)))
    out = out.append_column("model_version", pa.array([predictor.version] * n, pa.string()))
    return out


def write_library(
    shots: pa.Table, players: pa.Table, out_dir: Path, has_360: dict[tuple[int, int], bool]
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    pq.write_table(shots, out_dir / SHOT_LIBRARY_FILE, compression="zstd")
    con = duckdb.connect()
    con.register("shots", shots)
    con.register("players", players)
    matches = con.execute(
        """
        SELECT match_id, competition_id, season_id, competition_name, season_name,
               competition_gender, match_date, home_team, away_team, home_score, away_score, stage,
               COUNT(*)::INTEGER AS n_shots, SUM(is_goal::INTEGER)::INTEGER AS n_goals
        FROM shots
        GROUP BY ALL ORDER BY match_date, match_id
        """
    ).fetch_arrow_table()
    pq.write_table(matches, out_dir / MATCHES_FILE)
    comps = con.execute(
        """
        SELECT competition_id, season_id, competition_name, season_name, competition_gender,
               COUNT(DISTINCT match_id)::INTEGER AS n_matches, COUNT(*)::INTEGER AS n_shots,
               MIN(match_date) AS first_match, MAX(match_date) AS last_match
        FROM shots GROUP BY ALL ORDER BY competition_name, season_name DESC
        """
    ).fetch_arrow_table()
    flags = [
        has_360.get((c, s), False)
        for c, s in zip(
            comps["competition_id"].to_pylist(), comps["season_id"].to_pylist(), strict=True
        )
    ]
    comps = comps.append_column("has_360", pa.array(flags))
    pq.write_table(comps, out_dir / COMPETITIONS_FILE)
    used = con.execute(
        """
        SELECT DISTINCT player_id FROM (
          SELECT player_id FROM shots
          UNION ALL SELECT unnest(freeze_frame).player_id FROM shots
        ) WHERE player_id IS NOT NULL
        """
    ).fetch_arrow_table()
    con.register("used", used)
    players_out = con.execute(
        "SELECT p.* FROM players p JOIN used USING (player_id) ORDER BY player_id"
    ).fetch_arrow_table()
    pq.write_table(players_out, out_dir / PLAYERS_FILE)
    log.info(
        "library at %s: %d shots, %d matches, %d competition-seasons, %d players",
        out_dir,
        shots.num_rows,
        matches.num_rows,
        comps.num_rows,
        players_out.num_rows,
    )


def load_has_360() -> dict[tuple[int, int], bool]:
    if not paths.COMPETITIONS_JSON.exists():
        return {}
    return {
        (c["competition_id"], c["season_id"]): c.get("match_available_360") is not None
        for c in json.loads(paths.COMPETITIONS_JSON.read_text())
    }


def build_library(
    model_dir: Path | str, out_dir: Path | str, competitions: list[tuple[int, int]] | None = None
) -> Path:
    predictor = XGPredictor.load(model_dir)
    shots = pq.read_table(paths.SHOTS_PARQUET)
    if competitions:
        con = duckdb.connect()
        con.register("shots", shots)
        pairs = ", ".join(f"({c}, {s})" for c, s in competitions)
        shots = con.execute(
            f"SELECT * FROM shots WHERE (competition_id, season_id) IN ({pairs})"
        ).fetch_arrow_table()
    features = pq.read_table(paths.FEATURES_PARQUET, columns=["shot_id", *FEATURE_NAMES])
    players = pq.read_table(paths.PLAYERS_PARQUET)
    annotated = annotate_shots(shots, features, players, predictor)
    out = Path(out_dir)
    write_library(annotated, players, out, load_has_360())
    return out
