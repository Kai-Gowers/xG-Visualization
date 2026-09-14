# 3D character assets

The app renders every player with one rigged low-poly humanoid, `public/models/player.glb`,
posed at runtime from the bone-rotation manifest in `src/domain/poses/manifest.ts`. The file
is **not committed**; build it once:

```bash
npm run assets:build     # fetch + strip animations + meshopt compress -> public/models/player.glb
npm run assets:check     # size budget + required mixamorig bones
```

Without the file the app falls back to capsule mannequins (`?capsules=1` forces that mode).

## Source and licence

`player.glb` is built from three.js's `examples/models/gltf/Xbot.glb`, which is Adobe Mixamo's
default "X Bot" character (standard `mixamorig` skeleton, ~48k triangles, no textures), pinned to
the three.js tag in `build.sh`. Mixamo assets are royalty-free to use inside a project but may
not be redistributed on their own, which is why the built file and `tools/assets/raw/` are
gitignored. Do not upload the GLB anywhere as a standalone download.

## Poses

Poses are authored as local bone rotations (degrees, XYZ Euler) applied on top of the rest
pose, one entry per shot body part × technique plus defender / goalkeeper / teammate stances.
Left-footed variants are produced by mirroring: swap `Left`/`Right` bone names and negate the
Y and Z rotation components. Useful axis facts for the `mixamorig` rest pose (T-pose, facing +z
before the app turns it to face the goal):

| Bone | +X | +Z |
|---|---|---|
| `*UpLeg` | leg swings **back** (hip extension) | right leg swings **across** the body (left leg: outward) |
| `*Leg` | knee **bends** (foot goes back) | – |
| `Spine` | lean **forward** | – |
| `RightArm` | arm swings **forward** | arm **lowers** from the T-pose (left arm: −Z lowers) |

Root-level helpers per pose: `rootRotate` (yaw, e.g. 180° for a backheel), `rootTilt` (pitch
about the left–right axis for overhead kicks and diving headers), `root` (world offset so an
airborne body is at the right height), and `ball` (`[forward, up, right]` metres from the
shooter's feet).

## Upgrading to motion-capture poses

The pose system applies bone rotations to the standard `mixamorig` skeleton, so soccer clips
from mixamo.com (FBX, "Without Skin") can later be converted with Blender's glTF exporter and
frozen at a chosen frame instead of hand-authored rotations. Mixamo has no download API, so
that step is manual; the built model is already Mixamo-rigged for it.
