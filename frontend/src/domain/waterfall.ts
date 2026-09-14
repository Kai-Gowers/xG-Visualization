import type { ExplanationItem, PredictResponse } from '../api/types';
import { featureLabel, formatFeatureValue } from './features';

export type WaterfallRow = {
  key: string;
  label: string;
  /** Formatted feature value; null for the base / total / "Other" rows. */
  value: string | null;
  /** Running log-odds before and after this row. Point rows have from === to. */
  from: number;
  to: number;
  kind: 'base' | 'feature' | 'other' | 'total';
  /** Number of small contributions folded into an "other" row. */
  count?: number;
};

export type Waterfall = {
  rows: WaterfallRow[];
  /** True when base + Σ contributions does not reproduce the reported logit. */
  approx: boolean;
  /** Log-odds range spanned by the rows (unpadded). */
  domain: [number, number];
};

/** Contributions smaller than this (in log-odds) fold into "Other (n)". */
export const MIN_CONTRIBUTION = 0.02;
/** Probability gridlines shown on the top axis. */
export const PROB_TICKS = [0.02, 0.05, 0.1, 0.2, 0.4, 0.7];

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const logit = (p: number) => Math.log(p / (1 - p));

type Input = Pick<PredictResponse, 'explanation' | 'base_value_logit' | 'logit'>;

export function buildWaterfall(
  { explanation, base_value_logit: base, logit: total }: Input,
  threshold = MIN_CONTRIBUTION,
): Waterfall {
  const rows: WaterfallRow[] = [
    { key: 'base', label: 'Base rate', value: null, from: base, to: base, kind: 'base' },
  ];
  let cursor = base;
  const small: ExplanationItem[] = [];
  for (const item of explanation) {
    if (Math.abs(item.contribution) < threshold) {
      small.push(item);
      continue;
    }
    const to = cursor + item.contribution;
    rows.push({
      key: item.feature,
      label: featureLabel(item.feature),
      value: formatFeatureValue(item.feature, item.value),
      from: cursor,
      to,
      kind: 'feature',
    });
    cursor = to;
  }
  if (small.length) {
    const to = cursor + small.reduce((sum, i) => sum + i.contribution, 0);
    rows.push({
      key: 'other',
      label: `Other (${small.length})`,
      value: null,
      from: cursor,
      to,
      kind: 'other',
      count: small.length,
    });
    cursor = to;
  }
  rows.push({ key: 'total', label: 'xG', value: null, from: total, to: total, kind: 'total' });
  const all = rows.flatMap((r) => [r.from, r.to]);
  return {
    rows,
    approx: Math.abs(cursor - total) > 1e-3,
    domain: [Math.min(...all), Math.max(...all)],
  };
}

/** Change in probability a row causes, in percentage points: "+3.4 pp" / "−0.8 pp". */
export function formatPp(from: number, to: number): string {
  const pp = (sigmoid(to) - sigmoid(from)) * 100;
  const sign = pp >= 0 ? '+' : '−';
  return `${sign}${Math.abs(pp).toFixed(1)} pp`;
}

export const formatPercent = (x: number, digits = 1) => `${(sigmoid(x) * 100).toFixed(digits)}%`;
