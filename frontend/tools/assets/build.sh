#!/usr/bin/env bash
# Build public/models/player.glb: a Mixamo-rigged low-poly character, meshopt-compressed.
#
# Source: three.js's Xbot.glb (Mixamo's default "X Bot" character, mixamorig skeleton, no
# textures). It is fetched at build time and NOT committed (see README.md for licensing).
set -euo pipefail
cd "$(dirname "$0")"

THREE_TAG="${THREE_TAG:-r186}"
SRC_URL="https://raw.githubusercontent.com/mrdoob/three.js/${THREE_TAG}/examples/models/gltf/Xbot.glb"
RAW_DIR="raw"
OUT_DIR="../../public/models"
GLTF_TRANSFORM="npx --yes @gltf-transform/cli@4.5.0"

mkdir -p "$RAW_DIR" "$OUT_DIR"
if [ ! -f "$RAW_DIR/Xbot.glb" ]; then
  echo "fetching Xbot.glb from three.js ${THREE_TAG}"
  curl -sSL -o "$RAW_DIR/Xbot.glb" "$SRC_URL"
fi

# Drop the bundled demo animations (poses are authored in src/domain/poses), then compress.
$GLTF_TRANSFORM prune "$RAW_DIR/Xbot.glb" "$RAW_DIR/Xbot.pruned.glb" --keep-attributes --keep-leaves 2>/dev/null || cp "$RAW_DIR/Xbot.glb" "$RAW_DIR/Xbot.pruned.glb"
node strip-animations.mjs "$RAW_DIR/Xbot.pruned.glb" "$RAW_DIR/Xbot.noanim.glb"
$GLTF_TRANSFORM optimize "$RAW_DIR/Xbot.noanim.glb" "$OUT_DIR/player.glb" --compress meshopt --simplify false

node check.mjs
