import { useBackendHealth } from '../hooks/useBackendHealth';
import { useStore } from '../store';

export function BackendBanner() {
  useBackendHealth();
  const backend = useStore((s) => s.prediction.backend);
  if (backend !== 'down') return null;
  return (
    <div className="banner" role="status">
      Backend unreachable — run <code>cd backend &amp;&amp; make serve</code>. Retrying every 5 s.
    </div>
  );
}
