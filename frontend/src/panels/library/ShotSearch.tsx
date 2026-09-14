import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { shotSearchInfiniteQuery } from '../../api/library';
import { useStore } from '../../store';
import { SEARCH_PRESETS } from '../../store/librarySlice';
import { ShotList } from './ShotList';

export const PLAYER_DEBOUNCE_MS = 300;

/** Preset chips and a debounced player-name box; both write to `library` in the store. */
export function ShotSearch() {
  const preset = useStore((s) => s.library.preset);
  const player = useStore((s) => s.library.player);
  const setLibraryFilter = useStore((s) => s.setLibraryFilter);
  const [text, setText] = useState(player);

  useEffect(() => {
    if (text.trim() === player) return;
    const id = setTimeout(() => setLibraryFilter({ player: text.trim() }), PLAYER_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text, player, setLibraryFilter]);

  return (
    <div className="section" aria-label="Search shots">
      <input
        type="search"
        placeholder="Player name"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Player name"
        data-testid="player-search"
      />
      <div className="segmented">
        {SEARCH_PRESETS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={preset === key}
            onClick={() => setLibraryFilter({ preset: preset === key ? null : key })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

type Props = {
  onLoad: (shotId: string) => void;
  pendingId: string | null;
  loadedId: string | null;
};

export function SearchResults({ onLoad, pendingId, loadedId }: Props) {
  const { preset, player, competitionId, seasonId } = useStore((s) => s.library);
  const query = useInfiniteQuery(
    shotSearchInfiniteQuery({
      preset: preset ?? undefined,
      player: player || undefined,
      competition_id: competitionId ?? undefined,
      season_id: seasonId ?? undefined,
      sort: preset === 'largest_disagreement' ? 'xg_diff_abs' : 'match_date',
      order: 'desc',
    }),
  );
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  return (
    <>
      <p className="hint" data-testid="search-summary">
        {query.isPending
          ? 'Searching…'
          : query.error
            ? 'Search failed.'
            : `${items.length} of ${total.toLocaleString()} shots`}
      </p>
      <ShotList shots={items} onLoad={onLoad} pendingId={pendingId} loadedId={loadedId} />
      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  );
}
