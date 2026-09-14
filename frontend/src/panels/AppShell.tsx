import { Minimap } from '../minimap/Minimap';
import { Scene } from '../scene/Scene';
import { BackendBanner } from './BackendBanner';
import { CameraPresets } from './CameraPresets';
import { ControlPanel } from './ControlPanel';
import './panels.css';
import { FeatureChips } from './results/FeatureChips';
import { XgReadout } from './results/XgReadout';

export function AppShell() {
  return (
    <div className="app">
      <main className="stage">
        <Scene />
        <Minimap />
        <BackendBanner />
      </main>
      <aside className="side">
        <section className="section" aria-label="Result">
          <h2>Expected goals</h2>
          <XgReadout />
          <FeatureChips />
        </section>
        <CameraPresets />
        <ControlPanel />
      </aside>
    </div>
  );
}
