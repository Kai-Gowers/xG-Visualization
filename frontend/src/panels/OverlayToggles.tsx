import { useStore } from '../store';
import type { OverlayKey } from '../store/uiSlice';

const OVERLAYS: [OverlayKey, string][] = [
  ['cone', 'Cone'],
  ['coverage', 'Coverage'],
  ['closestDefender', 'Closest defender'],
  ['gkOffset', 'GK'],
  ['trajectory', 'Trajectory'],
  ['labels', 'Labels'],
];

export function OverlayToggles() {
  const overlays = useStore((s) => s.ui.overlays);
  const toggleOverlay = useStore((s) => s.toggleOverlay);
  return (
    <section className="section" aria-label="Overlays">
      <h2>Overlays</h2>
      <div className="checks">
        {OVERLAYS.map(([key, label]) => (
          <label key={key} className="check">
            <input type="checkbox" checked={overlays[key]} onChange={() => toggleOverlay(key)} />
            {label}
          </label>
        ))}
      </div>
    </section>
  );
}
