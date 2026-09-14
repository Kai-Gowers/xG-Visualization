# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An intuition-building tool for Expected Goals (xG) in soccer. The frontend shows a frozen 3D moment from behind the shooter (a rigged mannequin posed for the body part and technique), a minimap where defenders, teammates, the keeper and the shooter can be dragged, a live xG readout with a SHAP-style "why" waterfall, and a library of ~100k real StatsBomb shots that can be loaded and edited as counterfactuals. The backend owns the model (XGBoost trained on all StatsBomb open data) and the API contract.

Two processes, two terminals: `backend/` (FastAPI on :8000) and `frontend/` (Vite on :5173). `notebooks/legacy_xG_ModelV2.ipynb` is the original Colab notebook, kept for history only.

## Commands

### Backend (`cd backend`, Python 3.13, managed by `uv`)

```bash
brew install libomp && make install     # first time (xgboost needs OpenMP)
make test                               # pytest; fixtures build a synthetic model, no data needed
make lint                               # ruff check + format --check
make serve                              # uvicorn xg.api.app:app --reload --port 8000
uv run pytest tests/test_features.py -k mirror      # single test
```

Data and model (all gitignored under `data/`; artifacts committed under `artifacts/`):

```bash
make data-small        # Euro 2024 + WC 2022 + Euro 2020 (1 min) — or `make data` for everything (~1.1 GB gz, 3–5 min)
make features && make train TRIALS=40 && make evaluate     # retrain: writes artifacts/models/xg-v<VERSION>/ and repoints `current`
make library           # data/library/full (14 MB, gitignored); make library-starter refreshes the committed starter
```

`xg-pipeline <step>` (`uv run`) is the CLI behind the Makefile. Never run two `uv run` commands concurrently in the same venv: `uv` may re-sync and drop the editable install mid-run (symptom: `No module named 'xg'`; fix: `uv sync --all-groups --reinstall-package xg-backend`).

### Frontend (`cd frontend`, Node ≥ 22, npm)

```bash
npm install
npm run assets:build   # once: fetches the Mixamo-rigged Xbot from three.js, compresses to public/models/player.glb (gitignored)
npm run dev            # http://localhost:5173 (expects the backend on :8000; VITE_API_URL in .env.development)
npm run typecheck && npm run lint && npm test && npm run build
npx vitest run src/domain/poses        # single test file/dir
npm run test:e2e                       # Playwright, capsule mode, all backend routes mocked
npm run api:types                      # regenerate src/api/schema.d.ts from the running backend's /openapi.json
```

Regenerating `package-lock.json` needs npm ≥ 11 (`npx npm@11 install`); plain `npm install`/`npm ci` work with npm 10. Pins that matter: `react@19.2.x` (R3F 9.7 peer range is `<19.3`), `typescript@5.9` (typescript-eslint does not support TS 7), `vitest@4.1`.

## Architecture

### Coordinates: StatsBomb units everywhere

All app state, API payloads, parquet files and features use StatsBomb pitch units: 120 long × 80 wide, attacking toward x = 120, goal centre (120, 40), posts at y = 36 and 44. The frontend converts to metres only for rendering, in one place: `frontend/src/domain/pitch.ts` (`sbToWorld`: world origin at the goal centre on the goal line, y up, shooter side negative x, SB y → world z). The minimap is an SVG whose viewBox is in SB units, and `pitchLinePaths()` feeds both the minimap and the 3D pitch texture so the two views cannot disagree. Pixels never reach the backend.

### The backend owns the contract

`backend/xg/scenario.py` `Scenario` is the canonical shot description (shooter, keeper|None, defenders, teammates, body part, technique, shot type, phase of play, flags, preferred foot). `PredictRequest` in `xg/api/schemas.py` mirrors it 1:1, and the frontend's types are generated from `/openapi.json` (`src/api/schema.d.ts`; `src/api/types.ts` narrows them with `satisfies`), so a contract change fails `npm run typecheck`.

Real shots and dragged scenarios go through the same code: `from_statsbomb_shot` (pipeline) and `from_shot_row` (library endpoint) both build a `Scenario`, and `xg/features.py` `compute_features` is the only feature implementation, used by training and serving. Do not re-implement any geometry client-side: `/predict` returns a `geometry` block (cone, per-player in-cone flags and goal-line shadow intervals, covered/free goal intervals, imputed keeper) that the 3D overlays draw directly.

### Model

41 features (`FEATURE_NAMES` in `features.py`; order is the booster's column order and is asserted on load): distance and visible angle, defenders in the shooter–posts triangle, closest defender, goal-mouth shadow from defenders (80 cm span) and keeper (160 cm) projected onto the goal line, keeper depth and lateral offset (sign made mirror-invariant), one-hots for body part / technique / shot type / phase of play, flags, and `weak_foot` (body part ≠ the player's dominant foot, inferred in `pipeline/players.py` from their passes and shots). Everything is NaN-free: a missing keeper is imputed at (118, 40) and flagged.

XGBoost `binary:logistic` with monotone constraints, tuned by Optuna under match-grouped CV, 15 % of matches held out within each competition-season. Penalties are a fixed rule (`penalty_xg` in `feature_spec.json`); shoot-outs (period 5) are dropped at extraction. Explanations are native `pred_contribs` in log-odds; one-hot groups are summed into one row (`groups` in the spec). Platt calibration is fitted but only kept if it improves test Brier (it did not for v3.0.0). Held-out v3.0.0: log loss 0.2635 / Brier 0.0755 / AUROC 0.809 vs StatsBomb's own xG on the same shots 0.2658 / 0.0753 / 0.804.

Artifacts are directories (`model.ubj`, `feature_spec.json`, `calibrator.json`, `metrics.json`, `training_config.json`, `plots/`) — no pickles. `artifacts/models/current` is a symlink the API serves. Adding or reordering a feature means retraining; `load_artifact` refuses a mismatched spec.

### Serving

`xg/api/app.py` loads the predictor and a `LibraryStore` (DuckDB views over the library parquet files: full library if `data/library/full` exists, else the committed `artifacts/library/starter`). Endpoints: `POST /predict?explain=`, `POST /predict/batch`, `GET /model/info`, `GET /health`, `GET /library/competitions|matches|matches/{id}/shots|shots/{id}|shots/search`. Predictions with explanations take ~1 ms. Config via `XG_MODEL_DIR`, `XG_LIBRARY_DIR`, `XG_CORS_ORIGINS`.

### Frontend structure

- `store/` zustand slices: `scenario` (with a `revision` counter bumped on every edit), `ui` (camera preset, overlays, hovered feature, `assetsMode`), `prediction` (last result + the revision it belongs to; staleness is derived), `library` (loaded shot, real scenario/prediction for reset).
- `hooks/useLivePrediction.ts` subscribes to `revision`: 80 ms trailing debounce while dragging, immediate otherwise, aborts in-flight requests, ignores stale responses. Always requests `explain=true`.
- `minimap/` is the primary editor (pointer capture, rAF-gated moves, Delete/arrow keys). `scene/` is a demand-rendered R3F canvas; the dragged entity, ball and camera are updated imperatively via `useStore.subscribe`, not React re-renders.
- `scene/characters/`: `PosedCharacter` clones the skinned mannequin with `SkeletonUtils.clone`, resets bones to rest and applies the pose from `domain/poses/manifest.ts` (bone rotations per body part × technique, mirrored for left foot; `rootTilt`/`root` for airborne poses; `ball` offset drives `scene/placement.ts`). Missing `player.glb` or a load error drops to `CapsuleCharacter` via `RiggedBoundary`; `?capsules=1` forces it (Playwright uses this).
- `scene/overlays/` read only `prediction.result.geometry/features`. `domain/waterfall.ts` is the pure math for the explanation chart; `domain/features.ts` maps backend feature keys to labels/units.
- `panels/library/` uses TanStack Query over the `/library/*` endpoints; `?shot=<id>` deep-links a shot.

### Assets and licensing

`frontend/public/models/player.glb` is built from three.js's Xbot (Adobe Mixamo's default character): royalty-free to embed, not to redistribute standalone, hence gitignored. See `frontend/tools/assets/README.md` for the bone-axis conventions used when authoring poses. StatsBomb open data requires attribution with their logo when publishing anything derived from it (`backend/README.md`).
