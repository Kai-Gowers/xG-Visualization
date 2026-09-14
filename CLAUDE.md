# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An interactive tool for building intuition about Expected Goals (xG) in soccer. A user drags a striker and defenders around a pitch in a React UI, and a FastAPI backend runs a pre-trained scikit-learn Random Forest (`backend/app/xg_modelv2.pkl`) to return the shot's xG. The model was trained in `xG_ModelV2.ipynb` on StatsBomb open data (Euro 2024 events + 360 freeze frames).

There is no root-level build tooling: `frontend/` and `backend/` are run independently in two terminals.

## Commands

### Backend (FastAPI, Python 3.13)

Run from `backend/` — the model path in `main.py` is relative (`app/xg_modelv2.pkl`), so the cwd matters.

```bash
cd backend
python3 -m venv venv && source venv/bin/activate   # first time; venv/ is gitignored
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

There are no backend tests or linters configured.

### Frontend (Create React App, React 19)

```bash
cd frontend
npm install
npm start          # dev server on http://localhost:3000
npm test           # Jest in watch mode via react-scripts
npm test -- --watchAll=false App.test.js   # single test file, one run
npm run build
```

Note: `src/App.test.js` is the untouched CRA boilerplate ("renders learn react link") and does not pass against the current `App.js`.

## Architecture

### Coordinate system (the key cross-cutting concern)

Everything hinges on one convention: **StatsBomb pitch coordinates (120 x 80, attacking left-to-right toward goal at x=120, goal mouth y=36..44) scaled 10x** to a 1200x800 pixel pitch.

- **Notebook** engineers features in raw StatsBomb units (goal at (120, 40), posts at y=36 and y=44).
- **Frontend** (`App.js` / `App.css`) renders a `.pitch` div of 1200x800px and stores player positions as raw pixel offsets. The goalkeeper is fixed at (1180, 400) and not sent to the backend.
- **Backend** (`main.py`) recomputes the same features in pixel space (goal at (1200, 400), posts at y=360/440), then **divides distances by 10** to get back to StatsBomb units before calling the model. Angles and counts are unit-free and are not scaled. The backend also hard-codes the goalkeeper at (1180, 400) and appends it to the defender list before computing features.

If you change the pitch size, goal position, or scale in any one of these three places, the other two must change to match or predictions silently degrade.

### Model feature contract

The pickled model expects a fixed 17-column feature vector, in this exact order:

1. `distance_to_goal`, `angle_to_goal`, `num_defenders_in_path`, `closest_defender_distance`
2. One-hot `shot_body_part_*` (Head, Left Foot, Other, Right Foot, nan) — from `pd.get_dummies(..., dummy_na=True)`
3. One-hot `shot_type_*` (Backheel, Diving Header, Half Volley, Lob, Normal, Overhead Kick, Volley, nan)

`main.py` builds this as a dict and relies on insertion order when calling `list(features.values())`. The API currently hard-codes body part = Right Foot and shot type = Normal; the frontend does not expose these. If the notebook is retrained with different categories, the dict in `main.py` must be updated to match the new column order.

### Request flow

`App.js` `handlePredict` → `POST http://localhost:8000/predict` with `{striker: {x, y}, defenders: [{x, y}, ...]}` → `main.py` `predict` → `{"xg": float}`. The frontend URL and the backend CORS origin (`http://localhost:3000`) are both hard-coded.

### Duplication to be aware of

`backend/app/utils.py` contains the same four feature functions that are also defined inline inside `predict()` in `main.py`. `main.py` does not import `utils.py`; the inline copies are what actually run.

### Notebook

`xG_ModelV2.ipynb` was authored in Google Colab (the last cell uses `google.colab.files`). It downloads StatsBomb data into `events/` and `three_sixty/`, writes `euro_2024_shots.csv`, trains a `RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)`, and dumps the pickle. None of those data artifacts are in the repo. The pickle was produced with scikit-learn 1.6.1 (pinned in `requirements.txt`); loading it under a different major version may warn or fail.
