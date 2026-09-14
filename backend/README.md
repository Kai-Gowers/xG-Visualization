# xG backend

Expected Goals model, data pipeline and FastAPI service for the xG Visualization app.
Everything speaks StatsBomb pitch units (120 × 80, attacking toward x = 120, goal centre at
(120, 40), posts at y = 36 and 44).

## Setup

```bash
brew install libomp          # xgboost needs OpenMP on macOS
make install                 # uv sync --all-groups (Python 3.13)
make test
```

## Data and model

```bash
make data-small              # Euro 2024 + World Cup 2022 + Euro 2020 (~170 matches, 1 min)
make data                    # all StatsBomb open data (~4,000 matches, ~1.1 GB gzipped, 3-5 min)
make features                # shots + players -> features.parquet, match-level split
make train TRIALS=40         # Optuna-tuned XGBoost, Platt check, versioned artifact in artifacts/models/
make evaluate                # metrics.json + plots (ours vs StatsBomb xG vs distance/angle baseline)
make library                 # data/library/full (gitignored)
make library-starter         # artifacts/library/starter (committed, small)
```

Each step is `uv run xg-pipeline <step>`; `--help` lists the flags. Raw and processed data live
under `data/` (gitignored). Model artifacts (`model.ubj`, `feature_spec.json`, `calibrator.json`,
`metrics.json`) are committed under `artifacts/models/` and `artifacts/models/current` points at
the one the API serves.

## Serve

```bash
make serve                   # uvicorn xg.api.app:app --reload --port 8000
curl -s localhost:8000/health
curl -s -X POST localhost:8000/predict -H 'content-type: application/json' \
     -d @tests/fixtures/scenario_penalty_spot.json | jq '.xg, .explanation[:4]'
```

Environment: `XG_MODEL_DIR` (default `artifacts/models/current`), `XG_LIBRARY_DIR` (default:
`data/library/full` if present, else `artifacts/library/starter`), `XG_CORS_ORIGINS`
(default `["http://localhost:5173","http://localhost:3000"]`).

Endpoints: `POST /predict?explain=true`, `POST /predict/batch`, `GET /model/info`, `GET /health`,
`GET /library/competitions`, `GET /library/matches?competition_id&season_id`,
`GET /library/matches/{id}/shots`, `GET /library/shots/{shot_id}`,
`GET /library/shots/search?preset=…&player=…`. OpenAPI at `/openapi.json`.

## How the model works

- One row per shot from every StatsBomb open-data match, using the `shot.freeze_frame` that
  every shot carries (opponents, teammates and the goalkeeper at the moment of the shot).
- 43 features computed by `xg/features.py`, the same code the API runs: distance and visible
  angle to goal, defenders inside the shooter–posts triangle, closest defender, how much of the
  goal mouth is shadowed by defenders and keeper (80 cm / 160 cm arm spans projected onto the
  goal line), keeper depth and lateral offset, body part, technique, shot type, phase of play,
  first-time / under-pressure / one-on-one / open-goal flags, and whether the shot was taken
  with the player's weak foot (dominant foot inferred from their passes and shots).
- XGBoost `binary:logistic` with monotone constraints (closer, wider angle and more open goal
  can only raise xG), tuned with Optuna under match-grouped 5-fold CV, evaluated on 15 % of
  matches held out within every competition-season. Penalties are a fixed rule (in-game
  conversion rate in the training matches) and shoot-outs are excluded.
- Explanations are exact TreeSHAP contributions (`pred_contribs`) in log-odds; one-hot groups
  are collapsed so the UI shows one row for body part, technique, shot type and phase of play.

## Attribution

Data: [StatsBomb open data](https://github.com/statsbomb/open-data), used under its
non-commercial licence. If you publish anything derived from this project, credit StatsBomb and
use their logo as their licence requires.
