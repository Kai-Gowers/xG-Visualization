import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { matchShotsQuery } from '../../api/library';
import { useStore } from '../../store';
import { CompetitionSelect } from './CompetitionSelect';
import { MatchSelect } from './MatchSelect';
import { ShotList } from './ShotList';
import { SearchResults, ShotSearch } from './ShotSearch';
import { useLoadShot } from './useLoadShot';

type MatchShotsProps = Omit<ComponentProps<typeof ShotList>, 'shots'> & { matchId: number };

function MatchShots({ matchId, ...rest }: MatchShotsProps) {
  const { data, isPending } = useQuery(matchShotsQuery(matchId));
  if (isPending) return <p className="hint">Loading shots…</p>;
  return <ShotList shots={data ?? []} {...rest} />;
}

export function LibraryBrowser() {
  const { competitionId, seasonId, matchId, preset, player } = useStore((s) => s.library);
  const loadedId = useStore((s) => s.library.loadedShot?.detail.meta.shot_id ?? null);
  const { load, pendingId, error } = useLoadShot();
  const searching = preset !== null || player !== '';
  return (
    <section className="section library" aria-label="Shot library">
      <h2>Real shots</h2>
      <ShotSearch />
      <CompetitionSelect />
      {error && <p className="hint readout-error">{error}</p>}
      {searching ? (
        <SearchResults onLoad={load} pendingId={pendingId} loadedId={loadedId} />
      ) : (
        competitionId != null &&
        seasonId != null && (
          <>
            <MatchSelect competitionId={competitionId} seasonId={seasonId} />
            {matchId != null && (
              <MatchShots
                matchId={matchId}
                onLoad={load}
                pendingId={pendingId}
                loadedId={loadedId}
              />
            )}
          </>
        )
      )}
    </section>
  );
}
