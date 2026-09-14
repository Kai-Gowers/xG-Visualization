from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request

from xg.api.library_store import PRESETS, SORTS, LibraryStore
from xg.api.schemas import (
    CompetitionOut,
    MatchOut,
    PredictRequest,
    PredictResponse,
    SearchResponse,
    ShotDetail,
    ShotMeta,
    ShotSummary,
)
from xg.scenario import from_shot_row

router = APIRouter(prefix="/library", tags=["library"])


def _store(request: Request) -> LibraryStore:
    store = request.app.state.library
    if store is None:
        raise HTTPException(503, "shot library not loaded; run `make library` first")
    return store


@router.get("/competitions", response_model=list[CompetitionOut])
def competitions(request: Request) -> list[dict]:
    return _store(request).competitions()


@router.get("/matches", response_model=list[MatchOut])
def matches(request: Request, competition_id: int, season_id: int) -> list[dict]:
    return _store(request).matches(competition_id, season_id)


@router.get("/matches/{match_id}/shots", response_model=list[ShotSummary])
def shots_for_match(request: Request, match_id: int) -> list[dict]:
    return _store(request).shots_for_match(match_id)


@router.get("/shots/search", response_model=SearchResponse)
def search(
    request: Request,
    preset: Annotated[str | None, Query(pattern="^(" + "|".join(PRESETS) + ")$")] = None,
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
    sort: Annotated[str | None, Query(pattern="^(" + "|".join(SORTS) + ")$")] = None,
    order: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SearchResponse:
    total, items = _store(request).search(
        preset=preset,
        player=player,
        competition_id=competition_id,
        season_id=season_id,
        match_id=match_id,
        outcome=outcome,
        body_part=body_part,
        technique=technique,
        min_xg=min_xg,
        max_xg=max_xg,
        min_sb_xg=min_sb_xg,
        max_sb_xg=max_sb_xg,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )
    return SearchResponse(total=total, items=[ShotSummary(**i) for i in items])


@router.get("/shots/{shot_id}", response_model=ShotDetail)
def shot_detail(request: Request, shot_id: str) -> ShotDetail:
    row = _store(request).shot(shot_id)
    if row is None:
        raise HTTPException(404, f"shot {shot_id} not found")
    scenario = from_shot_row(row, row.get("dominant_foot", "Unknown"))
    prediction = request.app.state.predictor.predict(scenario, explain=True)
    return ShotDetail(
        meta=ShotMeta(**row),
        scenario=PredictRequest.from_scenario(scenario),
        prediction=PredictResponse.from_prediction(prediction),
    )
