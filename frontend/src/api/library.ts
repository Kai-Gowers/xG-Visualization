import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { ApiError, client } from './client';
import type { SearchParams } from './types';

type Result<T> = { data?: T; error?: unknown; response: Response };

async function unwrap<T>(call: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (data === undefined) throw new ApiError(response.status, error);
  return data;
}

export const competitionsQuery = () =>
  queryOptions({
    queryKey: ['library', 'competitions'],
    queryFn: ({ signal }) => unwrap(client.GET('/library/competitions', { signal })),
    staleTime: Infinity,
  });

export const matchesQuery = (competition_id: number, season_id: number) =>
  queryOptions({
    queryKey: ['library', 'matches', competition_id, season_id],
    queryFn: ({ signal }) =>
      unwrap(
        client.GET('/library/matches', {
          params: { query: { competition_id, season_id } },
          signal,
        }),
      ),
    staleTime: Infinity,
  });

export const matchShotsQuery = (match_id: number) =>
  queryOptions({
    queryKey: ['library', 'match-shots', match_id],
    queryFn: ({ signal }) =>
      unwrap(
        client.GET('/library/matches/{match_id}/shots', { params: { path: { match_id } }, signal }),
      ),
    staleTime: Infinity,
  });

export const shotDetailQuery = (shot_id: string) =>
  queryOptions({
    queryKey: ['library', 'shot', shot_id],
    queryFn: ({ signal }) =>
      unwrap(client.GET('/library/shots/{shot_id}', { params: { path: { shot_id } }, signal })),
    staleTime: Infinity,
  });

export const SEARCH_PAGE = 50;

/** Offset-paged search for "Load more". `query.offset` is supplied per page. */
export const shotSearchInfiniteQuery = (query: Omit<SearchParams, 'offset' | 'limit'>) =>
  infiniteQueryOptions({
    queryKey: ['library', 'search', query],
    queryFn: ({ signal, pageParam }) =>
      unwrap(
        client.GET('/library/shots/search', {
          params: { query: { ...query, limit: SEARCH_PAGE, offset: pageParam } },
          signal,
        }),
      ),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total && last.items.length > 0 ? loaded : undefined;
    },
    staleTime: 5 * 60_000,
  });
