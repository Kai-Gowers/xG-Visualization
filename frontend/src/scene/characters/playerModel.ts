import { useGLTF } from '@react-three/drei';

/** Built by `npm run assets:build`; gitignored. Missing file => capsule fallback. */
export const PLAYER_MODEL_URL = '/models/player.glb';

export function usePlayerModel() {
  return useGLTF(PLAYER_MODEL_URL, undefined, true);
}
