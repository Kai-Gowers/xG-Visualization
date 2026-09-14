import { allEntities, entityPosition, scenarioEquals, type EntityRef } from '../domain/scenario';
import type { AppState } from './types';

export const selectEntities = (s: AppState) => allEntities(s.scenario);

export const selectEntityPosition = (ref: EntityRef) => (s: AppState) =>
  entityPosition(s.scenario, ref);

/** Ids of entities the backend flagged as inside the shot cone (maps geometry indices → ids). */
export const selectInConeIds = (s: AppState): string[] => {
  const players = s.prediction.result?.geometry.players ?? [];
  const { defenders, teammates } = s.scenario;
  const ids: string[] = [];
  for (const p of players) {
    if (!p.in_cone) continue;
    if (p.kind === 'goalkeeper') ids.push('gk');
    else {
      const id = (p.kind === 'defender' ? defenders : teammates)[p.index]?.id;
      if (id) ids.push(id);
    }
  }
  return ids;
};

/** True while the shown result was computed for an older scenario (or none yet). */
export const selectIsStale = (s: AppState) => s.prediction.forRevision !== s.revision;

export const selectIsWeakFoot = (s: AppState) => s.prediction.result?.features.weak_foot === 1;

/** A library shot is loaded and the scenario no longer matches its real positions/attributes. */
export const selectIsModified = (s: AppState) => {
  const loaded = s.library.loadedShot;
  return loaded !== null && !scenarioEquals(s.scenario, loaded.realScenario);
};
