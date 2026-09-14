from __future__ import annotations

from fastapi import APIRouter, Request

from xg.api.schemas import Health, LibraryInfo, ModelInfo

router = APIRouter(tags=["model"])


def _library_info(request: Request) -> LibraryInfo:
    store = request.app.state.library
    if store is None:
        return LibraryInfo(loaded=False, path=None, n_shots=0, n_matches=0, n_competition_seasons=0)
    return LibraryInfo(
        loaded=True,
        path=str(store.path),
        n_shots=store.n_shots,
        n_matches=store.n_matches,
        n_competition_seasons=store.n_competitions,
    )


@router.get("/health", response_model=Health)
def health(request: Request) -> Health:
    return Health(
        status="ok",
        model_version=request.app.state.predictor.version,
        library_loaded=request.app.state.library is not None,
    )


@router.get("/model/info", response_model=ModelInfo)
def model_info(request: Request) -> ModelInfo:
    artifact = request.app.state.predictor.artifact
    spec = artifact.spec
    return ModelInfo(
        model_version=spec["model_version"],
        library=spec.get("library", "xgboost"),
        library_version=spec.get("library_version"),
        features=spec["features"],
        groups=spec["groups"],
        vocab=spec["vocab"],
        constants=spec["constants"],
        penalty_xg=spec.get("penalty_xg", 0.76),
        monotone_constraints=spec.get("monotone_constraints", {}),
        training_data=spec.get("training_data", {}),
        metrics=artifact.metrics,
        shot_library=_library_info(request),
    )
