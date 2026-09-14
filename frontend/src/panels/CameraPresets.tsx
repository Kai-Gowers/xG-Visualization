import { useStore } from '../store';
import type { CameraPreset } from '../store/uiSlice';

const PRESETS: [CameraPreset, string][] = [
  ['behindShooter', '1 Behind shooter'],
  ['broadcast', '2 Broadcast'],
  ['topDown', '3 Top down'],
];

export function CameraPresets() {
  const preset = useStore((s) => s.ui.cameraPreset);
  const setCameraPreset = useStore((s) => s.setCameraPreset);
  return (
    <section className="section" aria-label="Camera">
      <h2>Camera</h2>
      <div className="segmented">
        {PRESETS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={preset === key}
            onClick={() => setCameraPreset(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
