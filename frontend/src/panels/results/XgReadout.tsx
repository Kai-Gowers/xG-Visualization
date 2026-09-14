import { useStore } from '../../store';
import { selectIsStale } from '../../store/selectors';

export function XgReadout() {
  const result = useStore((s) => s.prediction.result);
  const isStale = useStore(selectIsStale);
  const error = useStore((s) => s.prediction.error);
  return (
    <div
      className={`readout${isStale ? ' is-stale' : ''}`}
      aria-live="polite"
      data-testid="xg-readout"
    >
      <div className="readout-value" data-testid="xg-value">
        {result ? `${(result.xg * 100).toFixed(1)}%` : '—'}
      </div>
      <div className="readout-sub">
        {result
          ? `p = ${result.xg.toFixed(3)} · model ${result.model_version}`
          : 'waiting for prediction'}
      </div>
      {result?.rule === 'penalty' && (
        <div className="readout-note">Penalty: fixed conversion rule</div>
      )}
      {error && <div className="readout-note readout-error">{error}</div>}
    </div>
  );
}
