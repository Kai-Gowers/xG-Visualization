import { Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { allEntities, refFromId } from '../domain/scenario';
import { useStore } from '../store';
import { CapsuleCharacter } from './CapsuleCharacter';
import { PosedCharacter } from './characters/PosedCharacter';
import { RiggedBoundary } from './characters/RiggedBoundary';

/** One character per entity: rigged mannequins by default, capsules as fallback / `?capsules=1`. */
export function Characters() {
  const ids = useStore(useShallow((s) => allEntities(s.scenario).map((e) => e.id)));
  const mode = useStore((s) => s.ui.assetsMode);
  const capsules = ids.map((id) => <CapsuleCharacter key={id} entity={refFromId(id)} />);
  if (mode === 'capsule') return capsules;
  return (
    <RiggedBoundary fallback={capsules}>
      <Suspense fallback={capsules}>
        {ids.map((id) => (
          <PosedCharacter key={id} entity={refFromId(id)} />
        ))}
      </Suspense>
    </RiggedBoundary>
  );
}
