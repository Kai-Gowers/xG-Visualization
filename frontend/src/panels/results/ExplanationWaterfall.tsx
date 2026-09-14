import { useStore } from '../../store';
import {
  buildWaterfall,
  formatPercent,
  formatPp,
  logit,
  PROB_TICKS,
  type WaterfallRow,
} from '../../domain/waterfall';

const W = 360;
const COL = { label: 140, delta: 58 };
const AXIS_H = 22;
const ROW_H = 30;
const BAR_H = 10;
const RADIUS = 3;
const PAD = 0.08;

/** Bar from `x0` (baseline side, square) to `x1` (data end, rounded). */
function barPath(x0: number, x1: number, y: number, h: number): string {
  const r = Math.min(RADIUS, Math.abs(x1 - x0));
  if (x1 >= x0) {
    return `M${x0},${y} H${x1 - r} a${r},${r} 0 0 1 ${r},${r} V${y + h - r} a${r},${r} 0 0 1 ${-r},${r} H${x0} Z`;
  }
  return `M${x0},${y} H${x1 + r} a${r},${r} 0 0 0 ${-r},${r} V${y + h - r} a${r},${r} 0 0 0 ${r},${r} H${x0} Z`;
}

function rowSummary(row: WaterfallRow): string {
  if (row.kind === 'feature' || row.kind === 'other') return formatPp(row.from, row.to);
  return formatPercent(row.to);
}

export function ExplanationWaterfall() {
  const result = useStore((s) => s.prediction.result);
  const hovered = useStore((s) => s.ui.hoveredFeature);
  const setHoveredFeature = useStore((s) => s.setHoveredFeature);
  if (!result) return null;
  if (result.rule || result.explanation.length === 0) {
    return (
      <p className="waterfall-note">
        {result.rule === 'penalty'
          ? 'Penalties use a fixed conversion rate, so there is no feature breakdown.'
          : 'No explanation available for this prediction.'}
      </p>
    );
  }

  const { rows, approx, domain } = buildWaterfall(result);
  const span = Math.max(domain[1] - domain[0], 0.5);
  const lo = domain[0] - span * PAD;
  const hi = domain[1] + span * PAD;
  const x0 = COL.label;
  const barW = W - COL.label - COL.delta;
  const x = (l: number) => x0 + ((l - lo) / (hi - lo)) * barW;
  const height = AXIS_H + rows.length * ROW_H;
  const ticks = PROB_TICKS.map((p) => ({ p, l: logit(p) })).filter((t) => t.l > lo && t.l < hi);

  return (
    <svg
      className="waterfall"
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      role="img"
      aria-label="How each feature moves the xG from the base rate"
      data-testid="waterfall"
    >
      {ticks.map(({ p, l }) => (
        <g key={p} className="waterfall-tick">
          <line x1={x(l)} x2={x(l)} y1={AXIS_H - 4} y2={height} />
          <text x={x(l)} y={AXIS_H - 8} textAnchor="middle">
            {Math.round(p * 100)}%
          </text>
        </g>
      ))}
      {rows.map((row, i) => {
        const y = AXIS_H + i * ROW_H;
        const barY = y + (ROW_H - BAR_H) / 2;
        const isPoint = row.kind === 'base' || row.kind === 'total';
        const interactive = row.kind === 'feature';
        const active = interactive && hovered === row.key;
        const next = rows[i + 1];
        return (
          <g
            key={row.key}
            className={`waterfall-row waterfall-${row.kind}${active ? ' is-active' : ''}`}
            data-testid={`waterfall-row-${row.key}`}
            onMouseEnter={interactive ? () => setHoveredFeature(row.key) : undefined}
            onMouseLeave={interactive ? () => setHoveredFeature(null) : undefined}
          >
            <title>
              {row.label}
              {row.value ? ` ${row.value}` : ''} — {rowSummary(row)}
              {isPoint
                ? ''
                : ` (log-odds ${row.to - row.from >= 0 ? '+' : ''}${(row.to - row.from).toFixed(3)})`}
            </title>
            <rect className="waterfall-hit" x={0} y={y} width={W} height={ROW_H} />
            <text className="waterfall-label" x={0} y={y + (row.value ? 12 : 19)}>
              {row.label}
              {row.kind === 'total' && approx && <tspan className="waterfall-approx"> ≈</tspan>}
            </text>
            {row.value && (
              <text className="waterfall-value" x={0} y={y + 24}>
                {row.value}
              </text>
            )}
            {isPoint ? (
              <rect
                className="waterfall-point"
                x={x(row.to) - 1}
                y={barY - 3}
                width={2}
                height={BAR_H + 6}
              />
            ) : (
              <path
                className={row.to >= row.from ? 'waterfall-pos' : 'waterfall-neg'}
                d={barPath(x(row.from), x(row.to), barY, BAR_H)}
              />
            )}
            {next && !isPoint && (
              <line
                className="waterfall-connector"
                x1={x(row.to)}
                x2={x(row.to)}
                y1={barY + BAR_H}
                y2={y + ROW_H + (ROW_H - BAR_H) / 2}
              />
            )}
            <text className="waterfall-delta" x={W} y={y + 19} textAnchor="end">
              {rowSummary(row)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
