from __future__ import annotations

from fastapi import APIRouter, Query, Request

from xg.api.schemas import (
    BatchPrediction,
    BatchPredictRequest,
    BatchPredictResponse,
    PredictRequest,
    PredictResponse,
)

router = APIRouter(tags=["predict"])


@router.post("/predict", response_model=PredictResponse)
def predict(
    body: PredictRequest,
    request: Request,
    explain: bool = Query(True, description="include additive log-odds contributions"),
) -> PredictResponse:
    prediction = request.app.state.predictor.predict(body.to_scenario(), explain=explain)
    return PredictResponse.from_prediction(prediction)


@router.post("/predict/batch", response_model=BatchPredictResponse)
def predict_batch(body: BatchPredictRequest, request: Request) -> BatchPredictResponse:
    predictor = request.app.state.predictor
    preds = [predictor.predict(s.to_scenario(), explain=False) for s in body.scenarios]
    return BatchPredictResponse(
        model_version=predictor.version,
        predictions=[BatchPrediction(xg=p.xg, rule=p.rule) for p in preds],
    )
