import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { shotDetailQuery } from '../../api/library';
import { useStore } from '../../store';

/** Fetches a library shot and loads it into the scene; exposes which id is in flight. */
export function useLoadShot() {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    async (shotId: string) => {
      setPendingId(shotId);
      setError(null);
      try {
        const detail = await queryClient.fetchQuery(shotDetailQuery(shotId));
        useStore.getState().loadShot(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPendingId((id) => (id === shotId ? null : id));
      }
    },
    [queryClient],
  );
  return { load, pendingId, error };
}
