import { useEffect } from 'react';
import { entityPosition } from '../domain/scenario';
import { useStore } from '../store';
import { CAMERA_PRESETS } from '../store/uiSlice';

const NUDGE = 0.5;
const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [0, -NUDGE],
  ArrowDown: [0, NUDGE],
  ArrowLeft: [-NUDGE, 0],
  ArrowRight: [NUDGE, 0],
};

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Delete/Backspace removes the selection, arrows nudge it 0.5 units, 1–4 pick camera presets. */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const state = useStore.getState();
      const { selected } = state.ui;
      const preset = CAMERA_PRESETS[Number(e.key) - 1];
      if (preset) {
        state.setCameraPreset(preset);
      } else if (e.key === 'Escape') {
        state.setSelected(null);
      } else if (selected && (e.key === 'Delete' || e.key === 'Backspace')) {
        state.removeEntity(selected);
      } else if (selected && ARROWS[e.key]) {
        const [dx, dy] = ARROWS[e.key];
        const p = entityPosition(state.scenario, selected);
        if (p) state.movePlayer(selected, { x: p.x + dx, y: p.y + dy });
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
