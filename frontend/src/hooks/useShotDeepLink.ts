import { useEffect } from 'react';
import { useLoadShot } from '../panels/library/useLoadShot';
import { useStore } from '../store';

const PARAM = 'shot';

/** `?shot=<id>` loads that library shot on start; the URL follows whatever is loaded afterwards. */
export function useShotDeepLink() {
  const { load } = useLoadShot();
  useEffect(() => {
    const id = new URLSearchParams(location.search).get(PARAM);
    if (id) void load(id);
  }, [load]);
  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.library.loadedShot?.detail.meta.shot_id ?? null,
        (id) => {
          const url = new URL(location.href);
          if (id) url.searchParams.set(PARAM, id);
          else url.searchParams.delete(PARAM);
          history.replaceState(null, '', url);
        },
      ),
    [],
  );
}
