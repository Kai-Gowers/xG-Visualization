import { Minimap } from '../minimap/Minimap';
import { Scene } from '../scene/Scene';
import { useStore } from '../store';
import type { SideTab } from '../store/uiSlice';
import { BackendBanner } from './BackendBanner';
import { CameraPresets } from './CameraPresets';
import { ControlPanel } from './ControlPanel';
import { LibraryBrowser } from './library/LibraryBrowser';
import { LoadedShotBanner } from './library/LoadedShotBanner';
import { OverlayToggles } from './OverlayToggles';
import './panels.css';
import { ResultsPanel } from './results/ResultsPanel';
import { XgReadout } from './results/XgReadout';

const TABS: [SideTab, string][] = [
  ['shot', 'Shot'],
  ['why', 'Why'],
  ['library', 'Library'],
];

export function AppShell() {
  const tab = useStore((s) => s.ui.sideTab);
  const setSideTab = useStore((s) => s.setSideTab);
  return (
    <div className="app">
      <main className="stage">
        <Scene />
        <LoadedShotBanner />
        <Minimap />
        <BackendBanner />
      </main>
      <aside className="side">
        <XgReadout />
        <div className="tabs" role="tablist" aria-label="Side panel">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              aria-pressed={tab === key}
              onClick={() => setSideTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'shot' && (
          <>
            <OverlayToggles />
            <CameraPresets />
            <ControlPanel />
          </>
        )}
        {tab === 'why' && <ResultsPanel />}
        {tab === 'library' && <LibraryBrowser />}
      </aside>
    </div>
  );
}
