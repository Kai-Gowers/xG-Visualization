import { useShallow } from 'zustand/react/shallow';
import { allEntities, refFromId } from '../domain/scenario';
import { useStore } from '../store';
import { CapsuleCharacter } from './CapsuleCharacter';

/** One character per entity. Rigged characters (M2) switch on `ui.assetsMode` here. */
export function Characters() {
  const ids = useStore(useShallow((s) => allEntities(s.scenario).map((e) => e.id)));
  return ids.map((id) => <CapsuleCharacter key={id} entity={refFromId(id)} />);
}
