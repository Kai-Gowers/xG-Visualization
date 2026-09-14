/* global process, console */
// Remove every animation from a glTF so poses.glb / procedural poses are the only source of motion.
import { NodeIO } from '@gltf-transform/core';

const [, , input, output] = process.argv;
const io = new NodeIO();
const doc = await io.read(input);
for (const anim of doc.getRoot().listAnimations()) anim.dispose();
await io.write(output, doc);
console.log(`stripped animations -> ${output}`);
