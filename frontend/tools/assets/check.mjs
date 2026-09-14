/* global process, console, URL */
// Verify public/models/player.glb exists, is within budget, and carries the bones the pose
// system needs. Run via `npm run assets:check`.
import { statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const file = new URL('../../public/models/player.glb', import.meta.url).pathname;
const BUDGET_BYTES = 1.5 * 1024 * 1024;
const REQUIRED = [
  'Hips', 'Spine', 'Spine1', 'Neck', 'Head',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
];

let size;
try {
  size = statSync(file).size;
} catch {
  console.error(`missing ${file}; run \`npm run assets:build\``);
  process.exit(1);
}
if (size > BUDGET_BYTES) {
  console.error(`player.glb is ${(size / 1024).toFixed(0)} KB, over the ${BUDGET_BYTES / 1024} KB budget`);
  process.exit(1);
}

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(file);
const joints = new Set(doc.getRoot().listSkins().flatMap((s) => s.listJoints().map((j) => j.getName().replace(/^mixamorig:?/, ''))));
const missing = REQUIRED.filter((b) => !joints.has(b));
if (missing.length) {
  console.error(`player.glb is missing bones: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`player.glb ok: ${(size / 1024).toFixed(0)} KB, ${joints.size} joints, ${doc.getRoot().listAnimations().length} animations`);
