import { useEffect } from 'react';
import { ApiError } from '../api/client';
import { predict } from '../api/predict';
import { toPredictBody } from '../domain/scenario';
import { useStore, type AppStore } from '../store';

export const DRAG_DEBOUNCE_MS = 80;

/**
 * Keeps `prediction` in sync with `scenario.revision`: trailing debounce while dragging,
 * immediate otherwise, flush on drag end, abort in-flight, never apply a response older than
 * the one already applied. Returns an unsubscribe.
 */
export function startLivePrediction(store: AppStore): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let lastApplied = store.getState().prediction.forRevision;

  const run = () => {
    timer = null;
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    const { scenario, revision } = store.getState();
    store.getState().predictionStarted();
    predict(toPredictBody(scenario), signal).then(
      (result) => {
        if (signal.aborted || revision < lastApplied) return;
        lastApplied = revision;
        store.getState().predictionSucceeded(revision, result);
      },
      (err: unknown) => {
        if (signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        store.getState().predictionFailed(message, !(err instanceof ApiError));
      },
    );
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, store.getState().ui.dragging ? DRAG_DEBOUNCE_MS : 0);
  };

  const unsubs = [
    store.subscribe((s) => s.revision, schedule),
    store.subscribe(
      (s) => s.ui.dragging,
      (dragging) => {
        if (!dragging && timer) run();
      },
    ),
    // Backend came back: catch up if the last result is behind the scenario.
    store.subscribe(
      (s) => s.prediction.backend,
      (backend) => {
        const { revision, prediction } = store.getState();
        if (backend === 'up' && prediction.forRevision !== revision && !timer) schedule();
      },
    ),
  ];
  schedule();

  return () => {
    unsubs.forEach((u) => u());
    if (timer) clearTimeout(timer);
    controller?.abort();
  };
}

export function useLivePrediction() {
  useEffect(() => startLivePrediction(useStore), []);
}
