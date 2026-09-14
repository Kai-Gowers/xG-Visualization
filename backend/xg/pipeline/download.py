"""Download StatsBomb open data (competitions, matches, events) into the raw cache.

Events are stored gzipped (~1.2 GB for everything instead of ~10 GB). The manifest
records each match's ``last_updated`` stamp so re-runs only fetch changed matches.
"""

from __future__ import annotations

import asyncio
import gzip
import json
import logging
from pathlib import Path
from typing import Any

import httpx
from tqdm import tqdm

from xg.pipeline import paths

log = logging.getLogger(__name__)

BASE_URL = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
COMMIT_URL = "https://api.github.com/repos/statsbomb/open-data/commits/master"
RETRIES = 4


def parse_competitions_arg(arg: str | None) -> list[tuple[int, int]] | None:
    """``"55:282,43:106"`` -> ``[(55, 282), (43, 106)]``; ``None`` means everything."""
    if not arg:
        return None
    pairs = []
    for token in arg.split(","):
        cid, sid = token.strip().split(":")
        pairs.append((int(cid), int(sid)))
    return pairs


async def _get(client: httpx.AsyncClient, url: str) -> bytes | None:
    delay = 1.0
    for attempt in range(RETRIES):
        try:
            resp = await client.get(url)
        except (httpx.TransportError, httpx.TimeoutException) as exc:
            log.warning("network error on %s (%s), retrying", url, exc)
        else:
            if resp.status_code == 200:
                return resp.content
            if resp.status_code == 404:
                return None
            log.warning("HTTP %s on %s, retrying", resp.status_code, url)
        await asyncio.sleep(delay * (2**attempt))
    log.error("giving up on %s", url)
    return None


def _write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def _write_gz(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wb", compresslevel=6) as fh:
        fh.write(content)


def load_manifest() -> dict[str, Any]:
    if paths.MANIFEST_JSON.exists():
        return json.loads(paths.MANIFEST_JSON.read_text())
    return {"open_data_commit": None, "matches": {}}


def save_manifest(manifest: dict[str, Any]) -> None:
    paths.MANIFEST_JSON.parent.mkdir(parents=True, exist_ok=True)
    paths.MANIFEST_JSON.write_text(json.dumps(manifest, indent=1, sort_keys=True))


async def _fetch_commit(client: httpx.AsyncClient) -> str | None:
    try:
        resp = await client.get(COMMIT_URL, headers={"Accept": "application/vnd.github+json"})
        if resp.status_code == 200:
            return resp.json()["sha"]
    except (httpx.HTTPError, KeyError, ValueError):
        pass
    return None


async def download_async(
    competitions: list[tuple[int, int]] | None,
    workers: int = 10,
    refresh: bool = False,
) -> dict[str, Any]:
    timeout = httpx.Timeout(60.0, connect=20.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        comps_raw = await _get(client, f"{BASE_URL}/competitions.json")
        if comps_raw is None:
            raise RuntimeError("could not download competitions.json")
        _write(paths.COMPETITIONS_JSON, comps_raw)
        comps = json.loads(comps_raw)
        selected = [
            (c["competition_id"], c["season_id"])
            for c in comps
            if competitions is None or (c["competition_id"], c["season_id"]) in competitions
        ]
        log.info("%d competition-seasons selected", len(selected))

        manifest = load_manifest()
        manifest["open_data_commit"] = await _fetch_commit(client) or manifest.get(
            "open_data_commit"
        )

        # Match lists are small: fetch them sequentially-ish with the same pool.
        sem = asyncio.Semaphore(workers)

        async def fetch_matches(cid: int, sid: int) -> list[dict[str, Any]]:
            async with sem:
                raw = await _get(client, f"{BASE_URL}/matches/{cid}/{sid}.json")
            if raw is None:
                log.warning("no matches file for %s/%s", cid, sid)
                return []
            _write(paths.matches_path(cid, sid), raw)
            return json.loads(raw)

        match_lists = await asyncio.gather(*(fetch_matches(c, s) for c, s in selected))
        todo: list[tuple[int, str]] = []
        for (cid, sid), matches in zip(selected, match_lists, strict=True):
            for m in matches:
                mid = m["match_id"]
                stamp = m.get("last_updated") or ""
                entry = manifest["matches"].get(str(mid))
                cached = paths.event_path(mid).exists()
                manifest["matches"][str(mid)] = {
                    "competition_id": cid,
                    "season_id": sid,
                    "last_updated": stamp,
                }
                if refresh or not cached or entry is None or entry.get("last_updated") != stamp:
                    todo.append((mid, stamp))
        log.info(
            "%d event files to fetch (%d cached)", len(todo), len(manifest["matches"]) - len(todo)
        )

        progress = tqdm(total=len(todo), unit="match", desc="events")

        async def fetch_events(mid: int) -> None:
            async with sem:
                raw = await _get(client, f"{BASE_URL}/events/{mid}.json")
            if raw is not None:
                _write_gz(paths.event_path(mid), raw)
            else:
                manifest["matches"].pop(str(mid), None)
            progress.update(1)

        await asyncio.gather(*(fetch_events(mid) for mid, _ in todo))
        progress.close()
        save_manifest(manifest)
        return manifest


def download(
    competitions: list[tuple[int, int]] | None, workers: int = 10, refresh: bool = False
) -> dict[str, Any]:
    return asyncio.run(download_async(competitions, workers=workers, refresh=refresh))
