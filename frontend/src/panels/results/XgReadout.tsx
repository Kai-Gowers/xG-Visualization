import { useStore } from '../../store';
import { selectIsModified, selectIsStale } from '../../store/selectors';

const pct = (p: number | null | undefined, digits = 1) =>
  p == null ? '—' : `${(p * 100).toFixed(digits)}%`;

function Comparison() {
  const result = useStore((s) => s.prediction.result);
  const loaded = useStore((s) => s.library.loadedShot);
  const modified = useStore(selectIsModified);
  if (!loaded || !result) return null;
  const { realPrediction, detail } = loaded;
  if (!modified) {
    return (
      <div className="readout-compare" data-testid="xg-compare">
        Ours <b>{pct(realPrediction.xg)}</b> · StatsBomb <b>{pct(detail.meta.statsbomb_xg)}</b>
      </div>
    );
  }
  const delta = (result.xg - realPrediction.xg) * 100;
  return (
    <div className="readout-compare" data-testid="xg-compare">
      Real <b>{pct(realPrediction.xg)}</b> → Now <b>{pct(result.xg)}</b>{' '}
      <span className={delta >= 0 ? 'delta-pos' : 'delta-neg'}>
        ({delta >= 0 ? '+' : '−'}
        {Math.abs(delta).toFixed(1)} pp)
      </span>
    </div>
  );
}

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
        {result ? pct(result.xg) : '—'}
      </div>
      <Comparison />
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
