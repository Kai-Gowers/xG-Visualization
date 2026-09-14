"""DuckDB queries over the shot-library parquet files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb

from xg.pipeline.library import (
    COMPETITIONS_FILE,
    MATCHES_FILE,
    PLAYERS_FILE,
    SHOT_LIBRARY_FILE,
)

SUMMARY_COLUMNS = (
    "shot_id, match_id, competition_id, season_id, competition_name, season_name, match_date, "
    "home_team, away_team, period, minute, second, team_name, player_id, player_name, x, y, "
    "body_part, technique, shot_type, outcome, is_goal, statsbomb_xg, xg_model, xg_diff, weak_foot"
)

PRESETS: dict[str, str] = {
    "goals": "is_goal",
    "big_chance_miss": "statsbomb_xg >= 0.35 AND NOT is_goal",
    "low_xg_goal": "is_goal AND xg_model <= 0.05",
    "largest_disagreement": "xg_model IS NOT NULL AND statsbomb_xg IS NOT NULL",
    "weak_foot_goals": "is_goal AND weak_foot",
    "headers": "body_part = 'Head'",
}
SORTS: dict[str, str] = {
    "xg_diff_abs": "abs(xg_diff)",
    "statsbomb_xg": "statsbomb_xg",
    "xg_model": "xg_model",
    "minute": "minute",
    "match_date": "match_date",
}
MAX_LIMIT = 200


class LibraryStore:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.con = duckdb.connect()
        for view, file in (
            ("shots", SHOT_LIBRARY_FILE),
            ("matches", MATCHES_FILE),
            ("competitions", COMPETITIONS_FILE),
            ("players", PLAYERS_FILE),
        ):
            self.con.execute(
                f"CREATE VIEW {view} AS SELECT * FROM read_parquet('{(self.path / file).as_posix()}')"
            )
        self.n_shots, self.n_matches, self.n_competitions = self.con.execute(
            "SELECT (SELECT COUNT(*) FROM shots), (SELECT COUNT(*) FROM matches), "
            "(SELECT COUNT(*) FROM competitions)"
        ).fetchone()

    def _rows(self, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
        cur = self.con.execute(sql, params or [])
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row, strict=True)) for row in cur.fetchall()]

    def competitions(self) -> list[dict[str, Any]]:
        return self._rows("SELECT * FROM competitions ORDER BY competition_name, season_name DESC")

    def matches(self, competition_id: int, season_id: int) -> list[dict[str, Any]]:
        return self._rows(
            "SELECT * FROM matches WHERE competition_id = ? AND season_id = ? "
            "ORDER BY match_date, match_id",
            [competition_id, season_id],
        )

    def shots_for_match(self, match_id: int) -> list[dict[str, Any]]:
        return self._rows(
            f"SELECT {SUMMARY_COLUMNS} FROM shots WHERE match_id = ? "
            "ORDER BY period, minute, second",
            [match_id],
        )

    def shot(self, shot_id: str) -> dict[str, Any] | None:
        rows = self._rows("SELECT * FROM shots WHERE shot_id = ?", [shot_id])
        if not rows:
            return None
        row = rows[0]
        ids = sorted({p["player_id"] for p in row["freeze_frame"] or [] if p.get("player_id")})
        names: dict[int, str] = {}
        if ids:
            placeholders = ", ".join("?" for _ in ids)
            names = {
                pid: name
                for pid, name in self.con.execute(
                    f"SELECT player_id, player_name FROM players WHERE player_id IN ({placeholders})",
                    ids,
                ).fetchall()
            }
        row["freeze_frame"] = [
            {**p, "player_name": names.get(p.get("player_id"))} for p in row["freeze_frame"] or []
        ]
        return row

    def search(
        self,
        *,
        preset: str | None = None,
        player: str | None = None,
        competition_id: int | None = None,
        season_id: int | None = None,
        match_id: int | None = None,
        outcome: str | None = None,
        body_part: str | None = None,
        technique: str | None = None,
        min_xg: float | None = None,
        max_xg: float | None = None,
        min_sb_xg: float | None = None,
        max_sb_xg: float | None = None,
        sort: str | None = None,
        order: str = "desc",
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[int, list[dict[str, Any]]]:
        where: list[str] = []
        params: list[Any] = []
        if preset:
            where.append(PRESETS[preset])
        for clause, value in (
            ("competition_id = ?", competition_id),
            ("season_id = ?", season_id),
            ("match_id = ?", match_id),
            ("outcome = ?", outcome),
            ("body_part = ?", body_part),
            ("technique = ?", technique),
            ("xg_model >= ?", min_xg),
            ("xg_model <= ?", max_xg),
            ("statsbomb_xg >= ?", min_sb_xg),
            ("statsbomb_xg <= ?", max_sb_xg),
        ):
            if value is not None:
                where.append(clause)
                params.append(value)
        if player:
            where.append("player_name ILIKE ?")
            params.append(f"%{player}%")
        where_sql = f"WHERE {' AND '.join(where)}" if where else ""
        if sort is None:
            sort = "xg_diff_abs" if preset == "largest_disagreement" else "match_date"
        direction = "ASC" if order.lower() == "asc" else "DESC"
        order_sql = (
            f"ORDER BY {SORTS[sort]} {direction} NULLS LAST, match_id, period, minute, second"
        )
        limit = max(1, min(limit, MAX_LIMIT))
        rows = self._rows(
            f"SELECT {SUMMARY_COLUMNS}, COUNT(*) OVER () AS _total FROM shots {where_sql} "
            f"{order_sql} LIMIT {limit} OFFSET {max(0, offset)}",
            params,
        )
        total = rows[0].pop("_total") if rows else 0
        for r in rows:
            r.pop("_total", None)
        if not rows:
            total = self.con.execute(f"SELECT COUNT(*) FROM shots {where_sql}", params).fetchone()[
                0
            ]
        return int(total), rows
