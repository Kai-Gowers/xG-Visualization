import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { matchesQuery } from '../../api/library';
import type { Match } from '../../api/types';
import { useStore } from '../../store';

export const matchLabel = (m: Match) =>
  [`${m.home_team} v ${m.away_team}`, m.match_date, m.stage].filter(Boolean).join(' · ');

export const matchScore = (m: Match) =>
  m.home_score == null || m.away_score == null
    ? `${m.home_team} v ${m.away_team}`
    : `${m.home_team} ${m.home_score}–${m.away_score} ${m.away_team}`;

export function MatchSelect({
  competitionId,
  seasonId,
}: {
  competitionId: number;
  seasonId: number;
}) {
  const { data, isPending } = useQuery(matchesQuery(competitionId, seasonId));
  const matchId = useStore((s) => s.library.matchId);
  const setLibraryFilter = useStore((s) => s.setLibraryFilter);
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const matches = (data ?? [])
    .filter((m) => !needle || matchLabel(m).toLowerCase().includes(needle))
    .sort((a, b) => (b.match_date ?? '').localeCompare(a.match_date ?? ''));
  return (
    <div className="field">
      <span>Match</span>
      <input
        type="search"
        placeholder={isPending ? 'Loading matches…' : `Filter ${data?.length ?? 0} matches`}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Filter matches"
      />
      <ul className="match-list" role="listbox" aria-label="Matches" data-testid="match-list">
        {matches.map((m) => (
          <li key={m.match_id}>
            <button
              type="button"
              role="option"
              aria-selected={m.match_id === matchId}
              aria-pressed={m.match_id === matchId}
              onClick={() => setLibraryFilter({ matchId: m.match_id })}
            >
              <span className="match-teams">{matchScore(m)}</span>
              <span className="match-meta">
                {[m.match_date, m.stage, `${m.n_shots} shots`].filter(Boolean).join(' · ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
