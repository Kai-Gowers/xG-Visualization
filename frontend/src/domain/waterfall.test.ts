import { describe, expect, it } from 'vitest';
import { buildWaterfall, formatPp, logit, PROB_TICKS, sigmoid } from './waterfall';

const base = logit(0.1);

describe('buildWaterfall', () => {
  it('walks the cumulative log-odds from the base rate to the total', () => {
    const w = buildWaterfall({
      base_value_logit: base,
      logit: base + 0.5 - 0.3,
      explanation: [
        { feature: 'distance_to_goal', value: 12, contribution: 0.5 },
        { feature: 'n_defenders_in_cone', value: 2, contribution: -0.3 },
      ],
    });
    expect(w.rows.map((r) => r.kind)).toEqual(['base', 'feature', 'feature', 'total']);
    expect(w.rows[1]).toMatchObject({
      label: 'Distance to goal',
      value: '10.4 m',
      from: base,
      to: base + 0.5,
    });
    expect(w.rows[2]).toMatchObject({ from: base + 0.5, to: base + 0.2 });
    expect(w.rows[3].from).toBeCloseTo(base + 0.2);
    expect(w.approx).toBe(false);
    expect(w.domain[0]).toBeCloseTo(base);
    expect(w.domain[1]).toBeCloseTo(base + 0.5);
  });

  it('folds small contributions into one Other row, keeping their sum', () => {
    const w = buildWaterfall({
      base_value_logit: 0,
      logit: 0.4,
      explanation: [
        { feature: 'angle_to_goal', value: 0.5, contribution: 0.4 },
        { feature: 'first_time', value: 0, contribution: 0.01 },
        { feature: 'open_goal', value: 0, contribution: -0.015 },
        { feature: 'gk_present', value: 1, contribution: 0.005 },
      ],
    });
    expect(w.rows).toHaveLength(4);
    expect(w.rows[2]).toMatchObject({ kind: 'other', label: 'Other (3)', count: 3, from: 0.4 });
    expect(w.rows[2].to).toBeCloseTo(0.4);
  });

  it('flags a total that the contributions do not reproduce', () => {
    const w = buildWaterfall({
      base_value_logit: -2,
      logit: -1,
      explanation: [{ feature: 'distance_to_goal', value: 5, contribution: 0.5 }],
    });
    expect(w.approx).toBe(true);
    expect(w.rows.at(-1)).toMatchObject({ kind: 'total', from: -1, to: -1 });
  });

  it('shows category strings as values', () => {
    const w = buildWaterfall({
      base_value_logit: 0,
      logit: -0.6,
      explanation: [{ feature: 'body_part', value: 'Head', contribution: -0.6 }],
    });
    expect(w.rows[1]).toMatchObject({ label: 'Body part', value: 'Head' });
  });
});

describe('probability helpers', () => {
  it('formats signed percentage-point deltas', () => {
    expect(formatPp(logit(0.1), logit(0.15))).toBe('+5.0 pp');
    expect(formatPp(logit(0.15), logit(0.108))).toBe('−4.2 pp');
    expect(formatPp(0, 0)).toBe('+0.0 pp');
  });

  it('round-trips sigmoid and logit at the tick values', () => {
    for (const p of PROB_TICKS) expect(sigmoid(logit(p))).toBeCloseTo(p, 12);
  });
});
