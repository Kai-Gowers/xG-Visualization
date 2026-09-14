"""FastAPI application: ``uvicorn xg.api.app:app --reload --port 8000``."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from xg.api import routes_library, routes_model, routes_predict
from xg.api.config import Settings
from xg.api.library_store import LibraryStore
from xg.model.predictor import XGPredictor

log = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.predictor = XGPredictor.load(settings.model_dir)
        log.info("loaded model %s from %s", app.state.predictor.version, settings.model_dir)
        lib_dir = settings.resolved_library_dir()
        app.state.library = LibraryStore(lib_dir) if lib_dir else None
        if app.state.library:
            log.info("loaded shot library from %s (%d shots)", lib_dir, app.state.library.n_shots)
        else:
            log.warning("no shot library found; /library endpoints will return 503")
        yield

    app = FastAPI(
        title="xG API",
        version="3.0.0",
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(routes_model.router)
    app.include_router(routes_predict.router)
    app.include_router(routes_library.router)
    return app


app = create_app()
