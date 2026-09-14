import { DEFAULT_GK } from '../domain/scenario';
import { useStore } from '../store';

export function MinimapToolbar() {
  const hasGk = useStore((s) => s.scenario.goalkeeper !== null);
  const zoom = useStore((s) => s.ui.minimapZoom);
  const { addDefender, addTeammate, setGoalkeeper, setMinimapZoom, resetToDefault } =
    useStore.getState();
  return (
    <div className="minimap-toolbar" role="toolbar" aria-label="Minimap tools">
      <button type="button" onClick={() => addDefender()}>
        + Defender
      </button>
      <button type="button" onClick={() => addTeammate()}>
        + Teammate
      </button>
      <button type="button" onClick={() => setGoalkeeper(hasGk ? null : DEFAULT_GK)}>
        {hasGk ? '− GK' : '+ GK'}
      </button>
      <span className="spacer" />
      <button
        type="button"
        onClick={() => setMinimapZoom(zoom === 'full' ? 'finalThird' : 'full')}
        aria-label="Toggle minimap zoom"
      >
        {zoom === 'full' ? 'Final third' : 'Full pitch'}
      </button>
      <button type="button" onClick={resetToDefault}>
        Reset
      </button>
    </div>
  );
}
