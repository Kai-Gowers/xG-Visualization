"""Pydantic request/response models. ``PredictRequest`` mirrors :class:`xg.scenario.Scenario`."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from xg.constants import (
    ALL_SHOT_TYPES,
    BODY_PARTS,
    MAX_PLAYERS_PER_SIDE,
    PITCH_LENGTH,
    PITCH_WIDTH,
    PLAY_PATTERNS,
    PREFERRED_FEET,
    TECHNIQUES,
)
from xg.model.predictor import Prediction
from xg.scenario import Point, Scenario


def _enum(name: str, values: tuple[str, ...]) -> type[StrEnum]:
    return StrEnum(name, {v.upper().replace(" ", "_"): v for v in values})


BodyPart = _enum("BodyPart", BODY_PARTS)
Technique = _enum("Technique", TECHNIQUES)
ShotType = _enum("ShotType", ALL_SHOT_TYPES)
PlayPattern = _enum("PlayPattern", PLAY_PATTERNS)
PreferredFoot = _enum("PreferredFoot", PREFERRED_FEET)


class PointIn(BaseModel):
    x: float = Field(ge=0, le=PITCH_LENGTH)
    y: float = Field(ge=0, le=PITCH_WIDTH)


class PredictRequest(BaseModel):
    shooter: PointIn
    goalkeeper: PointIn | None = None
    defenders: list[PointIn] = Field(default_factory=list, max_length=MAX_PLAYERS_PER_SIDE)
    teammates: list[PointIn] = Field(default_factory=list, max_length=MAX_PLAYERS_PER_SIDE)
    body_part: BodyPart = BodyPart("Right Foot")
    technique: Technique = Technique("Normal")
    shot_type: ShotType = ShotType("Open Play")
    play_pattern: PlayPattern = PlayPattern("Regular Play")
    first_time: bool = False
    under_pressure: bool = False
    one_on_one: bool = False
    open_goal: bool = False
    preferred_foot: PreferredFoot = PreferredFoot("Unknown")

    def to_scenario(self) -> Scenario:
        return Scenario(
            shooter=Point(self.shooter.x, self.shooter.y),
            goalkeeper=Point(self.goalkeeper.x, self.goalkeeper.y) if self.goalkeeper else None,
            defenders=tuple(Point(p.x, p.y) for p in self.defenders),
            teammates=tuple(Point(p.x, p.y) for p in self.teammates),
            body_part=str(self.body_part),
            technique=str(self.technique),
            shot_type=str(self.shot_type),
            play_pattern=str(self.play_pattern),
            first_time=self.first_time,
            under_pressure=self.under_pressure,
            one_on_one=self.one_on_one,
            open_goal=self.open_goal,
            preferred_foot=str(self.preferred_foot),
        )

    @classmethod
    def from_scenario(cls, sc: Scenario) -> PredictRequest:
        return cls(
            shooter=PointIn(x=sc.shooter.x, y=sc.shooter.y),
            goalkeeper=PointIn(x=sc.goalkeeper.x, y=sc.goalkeeper.y) if sc.goalkeeper else None,
            defenders=[PointIn(x=p.x, y=p.y) for p in sc.defenders],
            teammates=[PointIn(x=p.x, y=p.y) for p in sc.teammates],
            body_part=BodyPart(sc.body_part),
            technique=Technique(sc.technique),
            shot_type=ShotType(sc.shot_type),
            play_pattern=PlayPattern(sc.play_pattern),
            first_time=sc.first_time,
            under_pressure=sc.under_pressure,
            one_on_one=sc.one_on_one,
            open_goal=sc.open_goal,
            preferred_foot=PreferredFoot(sc.preferred_foot),
        )


class ExplanationItem(BaseModel):
    feature: str
    value: float | str
    contribution: float


class ShooterUsed(BaseModel):
    x: float
    y: float
    clamped: bool


class GoalkeeperUsed(BaseModel):
    x: float
    y: float
    imputed: bool


class PlayerGeometry(BaseModel):
    kind: str
    index: int
    in_cone: bool
    distance: float
    goal_interval: list[float] | None


class Geometry(BaseModel):
    cone: list[list[float]]
    shooter_used: ShooterUsed
    goalkeeper_used: GoalkeeperUsed
    players: list[PlayerGeometry]
    goal_covered_intervals: list[list[float]]
    goal_free_intervals: list[list[float]]


class PredictResponse(BaseModel):
    xg: float
    xg_raw: float
    logit: float
    base_value_logit: float
    model_version: str
    rule: str | None
    features: dict[str, float]
    explanation: list[ExplanationItem]
    geometry: Geometry

    @classmethod
    def from_prediction(cls, p: Prediction) -> PredictResponse:
        return cls(
            xg=p.xg,
            xg_raw=p.xg_raw,
            logit=p.logit,
            base_value_logit=p.base_value_logit,
            model_version=p.model_version,
            rule=p.rule,
            features=p.features,
            explanation=[ExplanationItem(**e) for e in p.explanation],
            geometry=Geometry(**p.geometry),
        )


class BatchPredictRequest(BaseModel):
    scenarios: list[PredictRequest] = Field(max_length=512)


class BatchPrediction(BaseModel):
    xg: float
    rule: str | None


class BatchPredictResponse(BaseModel):
    model_version: str
    predictions: list[BatchPrediction]


class CompetitionOut(BaseModel):
    competition_id: int
    season_id: int
    competition_name: str
    season_name: str
    competition_gender: str | None
    n_matches: int
    n_shots: int
    has_360: bool


class MatchOut(BaseModel):
    match_id: int
    competition_id: int
    season_id: int
    competition_name: str
    season_name: str
    match_date: str | None
    home_team: str
    away_team: str
    home_score: int | None
    away_score: int | None
    stage: str | None
    n_shots: int
    n_goals: int


class ShotSummary(BaseModel):
    shot_id: str
    match_id: int
    competition_id: int
    season_id: int
    competition_name: str
    season_name: str
    match_date: str | None
    home_team: str
    away_team: str
    period: int | None
    minute: int | None
    second: int | None
    team_name: str | None
    player_id: int | None
    player_name: str | None
    x: float
    y: float
    body_part: str | None
    technique: str | None
    shot_type: str | None
    outcome: str | None
    is_goal: bool
    statsbomb_xg: float | None
    xg_model: float | None
    xg_diff: float | None
    weak_foot: bool


class FramePlayerOut(BaseModel):
    x: float
    y: float
    teammate: bool
    is_gk: bool
    player_id: int | None
    player_name: str | None
    position_id: int | None


class ShotMeta(ShotSummary):
    play_pattern: str | None
    end_x: float | None
    end_y: float | None
    end_z: float | None
    first_time: bool
    one_on_one: bool
    open_goal: bool
    under_pressure: bool
    aerial_won: bool
    deflected: bool
    follows_dribble: bool
    redirect: bool
    dominant_foot: str
    gk_present: bool
    has_freeze_frame: bool
    model_version: str | None
    freeze_frame: list[FramePlayerOut]


class ShotDetail(BaseModel):
    meta: ShotMeta
    scenario: PredictRequest
    prediction: PredictResponse


class SearchResponse(BaseModel):
    total: int
    items: list[ShotSummary]


class LibraryInfo(BaseModel):
    loaded: bool
    path: str | None
    n_shots: int
    n_matches: int
    n_competition_seasons: int


class ModelInfo(BaseModel):
    model_version: str
    library: str
    library_version: str | None
    features: list[str]
    groups: dict[str, list[str]]
    vocab: dict[str, list[str]]
    constants: dict[str, Any]
    penalty_xg: float
    monotone_constraints: dict[str, int]
    training_data: dict[str, Any]
    metrics: dict[str, Any]
    shot_library: LibraryInfo


class Health(BaseModel):
    status: str
    model_version: str
    library_loaded: bool
