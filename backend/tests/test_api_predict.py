import pytest

BODY = {
    "shooter": {"x": 108, "y": 40},
    "goalkeeper": {"x": 118, "y": 40},
    "defenders": [{"x": 114, "y": 39}],
    "teammates": [{"x": 110, "y": 46}],
    "body_part": "Left Foot",
    "technique": "Normal",
    "shot_type": "Open Play",
    "play_pattern": "Regular Play",
    "first_time": True,
    "under_pressure": False,
    "one_on_one": False,
    "open_goal": False,
    "preferred_foot": "Right",
}


def test_health_and_info(client):
    h = client.get("/health").json()
    assert h == {"status": "ok", "model_version": "test", "library_loaded": True}
    info = client.get("/model/info").json()
    assert len(info["features"]) == 43
    assert info["vocab"]["body_part"] == ["Right Foot", "Left Foot", "Head", "Other"]
    assert info["penalty_xg"] == pytest.approx(0.78)
    assert info["shot_library"]["n_shots"] == 24


def test_predict_contract(client):
    r = client.post("/predict", json=BODY)
    assert r.status_code == 200
    d = r.json()
    assert 0 < d["xg"] < 1
    assert d["rule"] is None
    assert d["features"]["weak_foot"] == 1.0
    assert d["features"]["n_defenders_in_cone"] == 1.0
    kinds = [(p["kind"], p["index"], p["in_cone"]) for p in d["geometry"]["players"]]
    assert kinds == [("defender", 0, True), ("goalkeeper", 0, True), ("teammate", 0, False)]
    assert d["geometry"]["goalkeeper_used"]["imputed"] is False
    covered = sum(hi - lo for lo, hi in d["geometry"]["goal_covered_intervals"])
    free = sum(hi - lo for lo, hi in d["geometry"]["goal_free_intervals"])
    assert covered + free == pytest.approx(8.0)
    assert d["explanation"][0]["feature"]
    assert (
        abs(sum(e["contribution"] for e in d["explanation"]) + d["base_value_logit"] - d["logit"])
        < 1e-3
    )


def test_predict_without_explanation_and_penalty(client):
    d = client.post("/predict", params={"explain": "false"}, json=BODY).json()
    assert d["explanation"] == []
    pen = client.post("/predict", json=BODY | {"shot_type": "Penalty"}).json()
    assert pen["rule"] == "penalty" and pen["xg"] == pytest.approx(0.78)


def test_missing_goalkeeper_is_imputed(client):
    d = client.post("/predict", json=BODY | {"goalkeeper": None}).json()
    assert d["geometry"]["goalkeeper_used"] == {"x": 118.0, "y": 40.0, "imputed": True}
    assert d["features"]["gk_present"] == 0.0


@pytest.mark.parametrize(
    "patch",
    [
        {"shooter": {"x": 130, "y": 40}},
        {"shooter": {"x": 100, "y": -1}},
        {"body_part": "Knee"},
        {"technique": "Bicycle"},
        {"shot_type": "Throw In"},
        {"preferred_foot": "Both"},
        {"defenders": [{"x": 100, "y": 40}] * 23},
    ],
)
def test_validation_errors(client, patch):
    assert client.post("/predict", json=BODY | patch).status_code == 422


def test_batch(client):
    scenarios = [BODY, BODY | {"shot_type": "Penalty"}, BODY | {"shooter": {"x": 95, "y": 40}}]
    d = client.post("/predict/batch", json={"scenarios": scenarios}).json()
    assert d["model_version"] == "test"
    assert len(d["predictions"]) == 3
    assert d["predictions"][1] == {"xg": pytest.approx(0.78), "rule": "penalty"}
    assert d["predictions"][2]["xg"] < d["predictions"][0]["xg"]
    too_many = client.post("/predict/batch", json={"scenarios": [BODY] * 513})
    assert too_many.status_code == 422
