"""``xg-pipeline <step>``: download | extract | players | features | train | evaluate | library."""

from __future__ import annotations

import argparse
import logging
import sys


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="xg-pipeline")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="step", required=True)

    p = sub.add_parser("download", help="fetch StatsBomb open data into data/raw")
    p.add_argument("--competitions", help="subset as cid:sid,cid:sid (default: all)")
    p.add_argument("--workers", type=int, default=10)
    p.add_argument("--refresh", action="store_true", help="re-fetch even if cached")

    p = sub.add_parser("extract", help="events -> shots.parquet + foot counts")
    p.add_argument("--workers", type=int, default=None)

    sub.add_parser("players", help="foot counts -> players.parquet")

    sub.add_parser("features", help="shots + players -> features.parquet and splits")

    p = sub.add_parser("train", help="tune, fit, calibrate and write a model artifact")
    p.add_argument("--version", default="3.0.0")
    p.add_argument("--trials", type=int, default=60)
    p.add_argument("--seed", type=int, default=42)

    p = sub.add_parser("evaluate", help="test-set metrics, benchmark and plots")
    p.add_argument("--model", default="artifacts/models/current")

    p = sub.add_parser("library", help="build the shot library parquet files")
    p.add_argument("--model", default="artifacts/models/current")
    p.add_argument("--out", default="data/library/full")
    p.add_argument("--competitions", help="subset as cid:sid,... (default: all)")

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,
    )

    if args.step == "download":
        from xg.pipeline.download import download, parse_competitions_arg

        download(parse_competitions_arg(args.competitions), args.workers, args.refresh)
    elif args.step == "extract":
        from xg.pipeline.extract import extract

        extract(args.workers)
    elif args.step == "players":
        from xg.pipeline.players import build_players

        build_players()
    elif args.step == "features":
        from xg.pipeline.build_features import build_features

        build_features()
    elif args.step == "train":
        from xg.pipeline.train import train

        train(version=args.version, trials=args.trials, seed=args.seed)
    elif args.step == "evaluate":
        from xg.pipeline.evaluate import evaluate

        evaluate(args.model)
    elif args.step == "library":
        from xg.pipeline.download import parse_competitions_arg
        from xg.pipeline.library import build_library

        build_library(args.model, args.out, parse_competitions_arg(args.competitions))


if __name__ == "__main__":
    main()
