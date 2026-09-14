import { describe, expect, it } from 'vitest';
import { predictResponse } from '../test/fixtures';
import { createAppStore } from './index';
import { selectInConeIds } from './selectors';

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
});
