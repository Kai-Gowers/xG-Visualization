import type { StateCreator } from 'zustand';
import type { PredictResponse } from '../api/types';
import type { AppState, Middleware } from './types';

export type BackendStatus = 'unknown' | 'up' | 'down';

export type PredictionSlice = {
  prediction: {
    status: 'idle' | 'loading' | 'success' | 'error';
    result: PredictResponse | null;
    /** Scenario revision the current `result` was computed for; see `selectIsStale`. */
    forRevision: number;
    error: string | null;
    backend: BackendStatus;
  };
  predictionStarted: () => void;
  predictionSucceeded: (revision: number, result: PredictResponse) => void;
  predictionFailed: (error: string, backendDown: boolean) => void;
  setBackendStatus: (backend: BackendStatus) => void;
};

export const createPredictionSlice: StateCreator<AppState, Middleware, [], PredictionSlice> = (
  set,
) => {
  const patch = (p: Partial<PredictionSlice['prediction']>) =>
    set((state) => ({ prediction: { ...state.prediction, ...p } }));
  return {
    prediction: {
      status: 'idle',
      result: null,
      forRevision: -1,
      error: null,
      backend: 'unknown',
    },
    predictionStarted: () => patch({ status: 'loading' }),
    predictionSucceeded: (revision, result) =>
      patch({ status: 'success', result, forRevision: revision, error: null, backend: 'up' }),
    predictionFailed: (error, backendDown) =>
      set((state) => ({
        prediction: {
          ...state.prediction,
          status: 'error',
          error,
          backend: backendDown ? 'down' : state.prediction.backend,
        },
      })),
    setBackendStatus: (backend) => patch({ backend }),
  };
};
