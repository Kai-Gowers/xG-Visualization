# xG Visualization

An interactive tool for building intuition about Expected Goals (xG) in soccer.

- **Third-person 3D view** from behind a frozen, rigged shooter whose pose shows the body part
  and technique (strike, volley, half volley, lob, backheel, overhead kick, header, diving header,
  left or right foot).
- **Minimap editor**: add, remove and drag defenders, teammates, the keeper and the shooter. The
  xG updates live while you drag.
- **"Why this xG"**: every prediction comes with additive log-odds contributions (exact TreeSHAP)
  rendered as a waterfall, and matching overlays in the scene: the shot cone, which defenders are
  in it, how much of the goal mouth is shadowed, the closest defender, the keeper's position.
- **Real shots**: browse or search ~100,000 shots from StatsBomb's open data (World Cups, Euros,
  La Liga, WSL, and more), load one into the scene with the real freeze frame, compare our xG with
  StatsBomb's, then move defenders to see the counterfactual.
- **Model**: XGBoost on 84k shots with freeze-frame features. On 15k held-out shots it scores
  log loss 0.2635 / AUROC 0.809 against StatsBomb's own xG at 0.2658 / 0.804.

## Run it

```bash
# backend (Python 3.13, uv)
cd backend && brew install libomp && make install && make serve        # http://localhost:8000

# frontend (Node >= 22)
cd frontend && npm install && npm run assets:build && npm run dev      # http://localhost:5173
```

The committed starter library holds Euro 2024, World Cup 2022 and Euro 2020. For everything:

```bash
cd backend && make data && make features && make library
```

Retraining is `make train && make evaluate`; see `backend/README.md` for the pipeline and
`CLAUDE.md` for the architecture.

## Data

Shot events and freeze frames come from the
[StatsBomb open data](https://github.com/statsbomb/open-data) and are used under its
non-commercial licence. Anything published from this project must credit StatsBomb and carry
their logo.
