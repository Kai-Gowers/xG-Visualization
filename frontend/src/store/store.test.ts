import { describe, expect, it } from 'vitest';
import { predictResponse, shotDetail } from '../test/fixtures';
import { defaultScenario, toPredictBody } from '../domain/scenario';
import { createAppStore } from './index';
import { selectInConeIds, selectIsModified, selectIsStale } from './selectors';

describe('store', () => {
  it('bumps revision on every mutation, but not on no-ops', () => {
    const store = createAppStore();
    const s = store.getState();
    s.movePlayer({ kind: 'shooter', id: 'shooter' }, { x: 100, y: 40 });
    s.setAttr('first_time', true);
    s.addDefender();
    expect(store.getState().revision).toBe(3);
    s.movePlayer({ kind: 'goalkeeper', id: 'gk' }, { x: 118, y: 40 });
    expect(store.getState().revision).toBe(4);
    s.setGoalkeeper(null);
    s.movePlayer({ kind: 'goalkeeper', id: 'gk' }, { x: 118, y: 40 });
    expect(store.getState().revision).toBe(5);
  });

  it('clears the selection when the selected entity is removed', () => {
    const store = createAppStore();
    store.getState().setSelected({ kind: 'defender', id: 'd0' });
    store.getState().removeEntity({ kind: 'defender', id: 'd0' });
    expect(store.getState().ui.selected).toBeNull();
    expect(store.getState().scenario.defenders.map((d) => d.id)).toEqual(['d1']);
  });

  it('maps in-cone geometry indices to entity ids', () => {
    const store = createAppStore();
    store.getState().predictionSucceeded(0, predictResponse(0.2));
    expect(selectInConeIds(store.getState())).toEqual(['d0', 'gk']);
    store.getState().removeEntity({ kind: 'defender', id: 'd0' });
    // Stale geometry now points at d1 via index 0; out-of-range indices are dropped.
    expect(selectInConeIds(store.getState())).toEqual(['d1', 'gk']);
  });

  describe('library', () => {
    const detail = shotDetail(toPredictBody({ ...defaultScenario(), shooter: { x: 110, y: 42 } }));

    it('loads a shot: scenario, seeded prediction, trajectory overlay, camera', () => {
      const store = createAppStore();
      store.getState().setCameraPreset('topDown');
      store.getState().loadShot(detail);
      const s = store.getState();
      expect(s.scenario.shooter).toEqual({ x: 110, y: 42 });
      expect(s.scenario.defenders.map((d) => d.id)).toEqual(['d0', 'd1']);
      expect(s.library.loadedShot?.detail).toBe(detail);
      expect(s.library.loadedShot?.revisionAtLoad).toBe(s.revision);
      expect(s.prediction.result).toBe(detail.prediction);
      expect(selectIsStale(s)).toBe(false);
      expect(s.ui.overlays.trajectory).toBe(true);
      expect(s.ui.cameraPreset).toBe('behindShooter');
      expect(selectIsModified(s)).toBe(false);
    });

    it('detects modifications and resets to the real positions', () => {
      const store = createAppStore();
      store.getState().loadShot(detail);
      store.getState().movePlayer({ kind: 'defender', id: 'd0' }, { x: 100, y: 40 });
      expect(selectIsModified(store.getState())).toBe(true);
      store.getState().predictionSucceeded(store.getState().revision, predictResponse(0.5));
      store.getState().resetToReal();
      const s = store.getState();
      expect(selectIsModified(s)).toBe(false);
      expect(s.scenario.defenders[0]).toEqual({ id: 'd0', x: 114, y: 37 });
      expect(s.prediction.result).toBe(detail.prediction);
      expect(selectIsStale(s)).toBe(false);
    });

    it('clears back to the default scenario', () => {
      const store = createAppStore();
      store.getState().loadShot(detail);
      store.getState().clearLoadedShot();
      const s = store.getState();
      expect(s.library.loadedShot).toBeNull();
      expect(s.scenario).toEqual(defaultScenario());
      expect(selectIsModified(s)).toBe(false);
    });
  });
});
