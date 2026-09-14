import { useQuery } from '@tanstack/react-query';
import { competitionsQuery } from '../../api/library';
import type { Competition } from '../../api/types';
import { useStore } from '../../store';

/** Competitions grouped by name, seasons newest first. */
export function groupCompetitions(list: Competition[]): [string, Competition[]][] {
  const groups = new Map<string, Competition[]>();
  for (const c of list) {
    const seasons = groups.get(c.competition_name) ?? [];
    seasons.push(c);
    groups.set(c.competition_name, seasons);
  }
  for (const seasons of groups.values()) {
    seasons.sort((a, b) => b.season_name.localeCompare(a.season_name));
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function CompetitionSelect() {
  const { data, isPending, error } = useQuery(competitionsQuery());
  const competitionId = useStore((s) => s.library.competitionId);
  const seasonId = useStore((s) => s.library.seasonId);
  const setLibraryFilter = useStore((s) => s.setLibraryFilter);
  const value = competitionId != null && seasonId != null ? `${competitionId}:${seasonId}` : '';
  return (
    <label className="field">
      <span>Competition</span>
      <select
        value={value}
        disabled={!data}
        data-testid="competition-select"
        onChange={(e) => {
          const [c, s] = e.target.value.split(':').map(Number);
          setLibraryFilter({
            competitionId: Number.isFinite(c) ? c : null,
            seasonId: Number.isFinite(s) ? s : null,
            matchId: null,
          });
        }}
      >
        <option value="">
          {isPending ? 'Loading…' : error ? 'Library unavailable' : 'Choose a competition'}
        </option>
        {data &&
          groupCompetitions(data).map(([name, seasons]) => (
            <optgroup key={name} label={name}>
              {seasons.map((c) => (
                <option key={c.season_id} value={`${c.competition_id}:${c.season_id}`}>
                  {c.season_name} · {c.n_shots.toLocaleString()} shots
                </option>
              ))}
            </optgroup>
          ))}
      </select>
    </label>
  );
}
