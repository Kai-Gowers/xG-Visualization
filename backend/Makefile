.PHONY: install data data-small features train evaluate library library-starter serve test lint all

SMALL ?= 55:282,43:106,55:43
MODEL ?= artifacts/models/current
VERSION ?= 3.0.0
TRIALS ?= 60

install:
	uv sync --all-groups

data:
	uv run xg-pipeline download
	uv run xg-pipeline extract
	uv run xg-pipeline players

data-small:
	uv run xg-pipeline download --competitions $(SMALL)
	uv run xg-pipeline extract
	uv run xg-pipeline players

features:
	uv run xg-pipeline features

train:
	uv run xg-pipeline train --version $(VERSION) --trials $(TRIALS)

evaluate:
	uv run xg-pipeline evaluate --model $(MODEL)

library:
	uv run xg-pipeline library --model $(MODEL) --out data/library/full

library-starter:
	uv run xg-pipeline library --model $(MODEL) --competitions $(SMALL) --out artifacts/library/starter

serve:
	uv run uvicorn xg.api.app:app --reload --port 8000

test:
	uv run pytest

lint:
	uv run ruff check . && uv run ruff format --check .

all: data features train evaluate library
