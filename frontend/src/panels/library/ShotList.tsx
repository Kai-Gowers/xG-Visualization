import { useState } from 'react';
import type { ShotSummary } from '../../api/types';

type SortKey =
  'minute' | 'player_name' | 'team_name' | 'outcome' | 'statsbomb_xg' | 'xg_model' | 'xg_diff';
/** [key, header, width %] — fixed layout so the table always fits the side panel. */
const COLUMNS: [SortKey, string, number][] = [
  ['minute', 'Min', 10],
  ['player_name', 'Player', 25],
  ['team_name', 'Team', 20],
  ['outcome', 'Outcome', 15],
  ['statsbomb_xg', 'SB', 10],
  ['xg_model', 'Ours', 10],
  ['xg_diff', 'Δ', 10],
];

const pct = (p: number | null) => (p == null ? '—' : `${Math.round(p * 100)}%`);
const diff = (d: number | null) =>
  d == null ? '—' : `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d * 100))}`;

export function sortShots(shots: ShotSummary[], key: SortKey, dir: 1 | -1): ShotSummary[] {
  return [...shots].sort((a, b) => {
    const [x, y] = [a[key], b[key]];
    if (x == null) return 1;
    if (y == null) return -1;
    const cmp =
      typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return cmp * dir || (a.minute ?? 0) - (b.minute ?? 0);
  });
}

type Props = {
  shots: ShotSummary[];
  onLoad: (shotId: string) => void;
  pendingId: string | null;
  loadedId: string | null;
};

export function ShotList({ shots, onLoad, pendingId, loadedId }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'minute', dir: 1 });
  const toggle = (key: SortKey) =>
    setSort((s) => ({
      key,
      dir: s.key === key ? ((s.dir * -1) as 1 | -1) : key === 'minute' ? 1 : -1,
    }));
  const rows = sortShots(shots, sort.key, sort.dir);
  return (
    <div>
      <table className="shot-table" data-testid="shot-list">
        <colgroup>
          {COLUMNS.map(([key, , width]) => (
            <col key={key} style={{ width: `${width}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map(([key, label]) => (
              <th
                key={key}
                aria-sort={
                  sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'
                }
              >
                <button type="button" onClick={() => toggle(key)}>
                  {label}
                  {sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.shot_id}
              className={`${s.is_goal ? 'is-goal' : ''}${s.shot_id === loadedId ? ' is-loaded' : ''}${s.shot_id === pendingId ? ' is-pending' : ''}`}
              tabIndex={0}
              role="button"
              data-testid={`shot-row-${s.shot_id}`}
              onClick={() => onLoad(s.shot_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onLoad(s.shot_id);
                }
              }}
            >
              <td>{s.minute ?? '—'}'</td>
              <td title={s.player_name ?? ''}>{s.player_name ?? '—'}</td>
              <td title={s.team_name ?? ''}>{s.team_name ?? '—'}</td>
              <td title={s.outcome ?? ''}>{s.outcome ?? '—'}</td>
              <td className="num">{pct(s.statsbomb_xg)}</td>
              <td className="num">{pct(s.xg_model)}</td>
              <td
                className={`num ${s.xg_diff != null && s.xg_diff < 0 ? 'delta-neg' : 'delta-pos'}`}
              >
                {diff(s.xg_diff)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="hint">No shots.</p>}
    </div>
  );
}
