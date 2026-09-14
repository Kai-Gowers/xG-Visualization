import pytest


def test_competitions_and_matches(client):
    comps = client.get("/library/competitions").json()
    assert [(c["competition_name"], c["season_name"]) for c in comps] == [
        ("FIFA World Cup", "2022"),
        ("UEFA Euro", "2024"),
    ]
    euro = next(c for c in comps if c["competition_id"] == 55)
    assert euro["has_360"] is True and euro["n_shots"] == 12 and euro["n_matches"] == 1
    matches = client.get("/library/matches", params={"competition_id": 55, "season_id": 282}).json()
    assert len(matches) == 1
    assert matches[0]["home_team"] == "Spain" and matches[0]["n_shots"] == 12


def test_shots_for_match_and_detail_roundtrip(client):
    match_id = client.get(
        "/library/matches", params={"competition_id": 55, "season_id": 282}
    ).json()[0]["match_id"]
    shots = client.get(f"/library/matches/{match_id}/shots").json()
    assert len(shots) == 12
    assert [s["minute"] for s in shots] == sorted(s["minute"] for s in shots)
    non_pen = next(s for s in shots if s["shot_type"] == "Open Play")
    assert non_pen["xg_model"] is not None
    pen = next(s for s in shots if s["shot_type"] == "Penalty")
    assert pen["xg_model"] == pytest.approx(0.78)

    detail = client.get(f"/library/shots/{non_pen['shot_id']}").json()
    meta, scenario, prediction = detail["meta"], detail["scenario"], detail["prediction"]
    assert meta["player_name"] == non_pen["player_name"]
    assert meta["dominant_foot"] in ("Right", "Left", "Unknown")
    assert scenario["preferred_foot"] == meta["dominant_foot"]
    assert prediction["xg"] == pytest.approx(meta["xg_model"], abs=1e-5)
    if meta["gk_present"]:
        assert scenario["goalkeeper"] is not None
        gk = next(p for p in meta["freeze_frame"] if p["is_gk"])
        assert gk["player_name"] == "Gigi Keeper"
    assert len(scenario["defenders"]) == sum(
        1 for p in meta["freeze_frame"] if not p["teammate"] and not p["is_gk"]
    )
    again = client.post("/predict", json=scenario).json()
    assert again["xg"] == pytest.approx(prediction["xg"], abs=1e-9)


def test_detail_404(client):
    assert client.get("/library/shots/does-not-exist").status_code == 404


def test_search_presets_filters_and_paging(client):
    all_goals = client.get("/library/shots/search", params={"preset": "goals", "limit": 5}).json()
    assert all_goals["total"] >= len(all_goals["items"]) and all(
        i["is_goal"] for i in all_goals["items"]
    )

    by_player = client.get("/library/shots/search", params={"player": "alice"}).json()
    assert by_player["total"] == 8 and all("Alice" in i["player_name"] for i in by_player["items"])

    dis = client.get(
        "/library/shots/search", params={"preset": "largest_disagreement", "limit": 3}
    ).json()
    diffs = [abs(i["xg_diff"]) for i in dis["items"]]
    assert diffs == sorted(diffs, reverse=True)

    page1 = client.get(
        "/library/shots/search", params={"sort": "minute", "order": "asc", "limit": 10}
    ).json()
    page2 = client.get(
        "/library/shots/search",
        params={"sort": "minute", "order": "asc", "limit": 10, "offset": 10},
    ).json()
    assert page1["total"] == 24 and len(page1["items"]) == 10 and len(page2["items"]) == 10
    assert {i["shot_id"] for i in page1["items"]}.isdisjoint({i["shot_id"] for i in page2["items"]})

    none = client.get("/library/shots/search", params={"player": "nobody"}).json()
    assert none == {"total": 0, "items": []}

    assert client.get("/library/shots/search", params={"preset": "bogus"}).status_code == 422
    assert client.get("/library/shots/search", params={"sort": "drop table"}).status_code == 422
