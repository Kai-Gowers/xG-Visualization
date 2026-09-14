import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useStore } from '../store';

/** With `frameloop="demand"`, request a render whenever the store changes. */
export function useInvalidateOnStore() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => useStore.subscribe(() => invalidate()), [invalidate]);
}
