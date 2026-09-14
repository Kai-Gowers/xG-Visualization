import { useEffect } from 'react';
import { health } from '../api/health';
import { useStore } from '../store';

export const HEALTH_POLL_MS = 5000;

/** Polls /health every 5 s while the backend is not known to be up. */
export function useBackendHealth() {
  const backend = useStore((s) => s.prediction.backend);
  const setBackendStatus = useStore((s) => s.setBackendStatus);
  useEffect(() => {
    if (backend === 'up') return;
    const controller = new AbortController();
    const check = () =>
      health(controller.signal).then(
        () => setBackendStatus('up'),
        () => {
          if (!controller.signal.aborted) setBackendStatus('down');
        },
      );
    void check();
    const id = setInterval(check, HEALTH_POLL_MS);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [backend, setBackendStatus]);
}
