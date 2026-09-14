"""The single canonical description of a shot situation.

A ``Scenario`` is what the API receives from the UI and what the pipeline builds from a
StatsBomb shot event. Both paths go through :func:`xg.features.compute_features`, so a
real shot loaded in the app is scored by exactly the same code as a dragged one.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from xg.constants import (
    ALL_SHOT_TYPES,
    BODY_PARTS,
    PITCH_LENGTH,
    PITCH_WIDTH,
    PLAY_PATTERN_MAP,
    PLAY_PATTERNS,
    PREFERRED_FEET,
    SHOT_TYPE_MAP,
    TECHNIQUES,
)


@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float

    def as_tuple(self) -> tuple[float, float]:
        return (self.x, self.y)


@dataclass(frozen=True, slots=True)
class Scenario:
    shooter: Point
    goalkeeper: Point | None = None
    defenders: tuple[Point, ...] = ()
    teammates: tuple[Point, ...] = ()
    body_part: str = "Right Foot"
    technique: str = "Normal"
    shot_type: str = "Open Play"
    play_pattern: str = "Regular Play"
    first_time: bool = False
    under_pressure: bool = False
    one_on_one: bool = False
    open_goal: bool = False
    preferred_foot: str = "Unknown"

    def __post_init__(self) -> None:
        if self.body_part not in BODY_PARTS:
            raise ValueError(f"unknown body_part {self.body_part!r}")
        if self.technique not in TECHNIQUES:
            raise ValueError(f"unknown technique {self.technique!r}")
        if self.shot_type not in ALL_SHOT_TYPES:
            raise ValueError(f"unknown shot_type {self.shot_type!r}")
        if self.play_pattern not in PLAY_PATTERNS:
            raise ValueError(f"unknown play_pattern {self.play_pattern!r}")
        if self.preferred_foot not in PREFERRED_FEET:
            raise ValueError(f"unknown preferred_foot {self.preferred_foot!r}")


@dataclass(frozen=True, slots=True)
class FramePlayer:
    """One entry of a StatsBomb freeze frame, normalised."""

    x: float
    y: float
    teammate: bool
    is_gk: bool
    player_id: int | None = None
    position_id: int | None = None
    player_name: str | None = None
    position_name: str | None = None


@dataclass(frozen=True, slots=True)
class ParsedShot:
    """Everything the pipeline needs from a shot event, before feature engineering."""

    scenario: Scenario
    frame: tuple[FramePlayer, ...] = field(default_factory=tuple)
    gk_present: bool = False
    has_freeze_frame: bool = False


def clamp_point(x: float, y: float) -> Point:
    return Point(min(max(x, 0.0), PITCH_LENGTH), min(max(y, 0.0), PITCH_WIDTH))


def normalise_shot_type(name: str | None) -> str:
    name = name or "Open Play"
    return SHOT_TYPE_MAP.get(name, name)


def normalise_play_pattern(name: str | None) -> str:
    name = name or "Regular Play"
    name = PLAY_PATTERN_MAP.get(name, name)
    return name if name in PLAY_PATTERNS else "Other"


def normalise_body_part(name: str | None) -> str:
    return name if name in BODY_PARTS else "Other"


def normalise_technique(name: str | None) -> str:
    return name if name in TECHNIQUES else "Normal"


def parse_freeze_frame(raw: list[Mapping[str, Any]] | None) -> tuple[FramePlayer, ...]:
    players: list[FramePlayer] = []
    for entry in raw or ():
        loc = entry.get("location")
        if not loc or len(loc) < 2:
            continue
        position = entry.get("position") or {}
        player = entry.get("player") or {}
        pt = clamp_point(float(loc[0]), float(loc[1]))
        players.append(
            FramePlayer(
                x=pt.x,
                y=pt.y,
                teammate=bool(entry.get("teammate", False)),
                is_gk=position.get("name") == "Goalkeeper",
                player_id=player.get("id"),
                position_id=position.get("id"),
                player_name=player.get("name"),
                position_name=position.get("name"),
            )
        )
    return tuple(players)


def scenario_from_frame(
    shooter: Point,
    frame: tuple[FramePlayer, ...],
    *,
    body_part: str,
    technique: str,
    shot_type: str,
    play_pattern: str,
    first_time: bool,
    under_pressure: bool,
    one_on_one: bool,
    open_goal: bool,
    preferred_foot: str,
) -> Scenario:
    opponents = [p for p in frame if not p.teammate]
    keepers = [p for p in opponents if p.is_gk]
    # If two "goalkeepers" are tagged, the one nearest the goal line is the real one.
    gk = max(keepers, key=lambda p: p.x) if keepers else None
    defenders = tuple(Point(p.x, p.y) for p in opponents if p is not gk)
    teammates = tuple(Point(p.x, p.y) for p in frame if p.teammate)
    return Scenario(
        shooter=shooter,
        goalkeeper=Point(gk.x, gk.y) if gk else None,
        defenders=defenders,
        teammates=teammates,
        body_part=body_part,
        technique=technique,
        shot_type=shot_type,
        play_pattern=play_pattern,
        first_time=first_time,
        under_pressure=under_pressure,
        one_on_one=one_on_one,
        open_goal=open_goal,
        preferred_foot=preferred_foot,
    )


def frame_from_records(records: list[Mapping[str, Any]] | None) -> tuple[FramePlayer, ...]:
    """Rebuild a frame from the flat records stored in ``shots.parquet``."""
    return tuple(
        FramePlayer(
            x=float(r["x"]),
            y=float(r["y"]),
            teammate=bool(r["teammate"]),
            is_gk=bool(r["is_gk"]),
            player_id=r.get("player_id"),
            position_id=r.get("position_id"),
        )
        for r in records or ()
    )


def from_shot_row(row: Mapping[str, Any], preferred_foot: str = "Unknown") -> Scenario:
    """Build a :class:`Scenario` from one ``shots.parquet`` row (as a dict)."""
    return scenario_from_frame(
        Point(float(row["x"]), float(row["y"])),
        frame_from_records(row.get("freeze_frame")),
        body_part=normalise_body_part(row.get("body_part")),
        technique=normalise_technique(row.get("technique")),
        shot_type=normalise_shot_type(row.get("shot_type")),
        play_pattern=normalise_play_pattern(row.get("play_pattern")),
        first_time=bool(row.get("first_time")),
        under_pressure=bool(row.get("under_pressure")),
        one_on_one=bool(row.get("one_on_one")),
        open_goal=bool(row.get("open_goal")),
        preferred_foot=preferred_foot if preferred_foot in PREFERRED_FEET else "Unknown",
    )


def from_statsbomb_shot(
    event: Mapping[str, Any], dominant_foot: Mapping[int, str] | None = None
) -> ParsedShot:
    """Build a :class:`ParsedShot` from a raw StatsBomb ``Shot`` event dict."""
    shot = event.get("shot") or {}
    loc = event.get("location") or [0.0, 0.0]
    shooter = clamp_point(float(loc[0]), float(loc[1]))
    raw_frame = shot.get("freeze_frame")
    frame = parse_freeze_frame(raw_frame)
    player_id = (event.get("player") or {}).get("id")
    foot = (dominant_foot or {}).get(player_id, "Unknown") if player_id is not None else "Unknown"
    scenario = scenario_from_frame(
        shooter,
        frame,
        body_part=normalise_body_part((shot.get("body_part") or {}).get("name")),
        technique=normalise_technique((shot.get("technique") or {}).get("name")),
        shot_type=normalise_shot_type((shot.get("type") or {}).get("name")),
        play_pattern=normalise_play_pattern((event.get("play_pattern") or {}).get("name")),
        first_time=bool(shot.get("first_time", False)),
        under_pressure=bool(event.get("under_pressure", False)),
        one_on_one=bool(shot.get("one_on_one", False)),
        open_goal=bool(shot.get("open_goal", False)),
        preferred_foot=foot if foot in PREFERRED_FEET else "Unknown",
    )
    return ParsedShot(
        scenario=scenario,
        frame=frame,
        gk_present=scenario.goalkeeper is not None,
        has_freeze_frame=raw_frame is not None and len(frame) > 0,
    )
