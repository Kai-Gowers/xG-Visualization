import type { StateCreator } from 'zustand';
import type { LibraryShotDetail, PredictResponse } from '../api/types';
import { fromShotDetail, type Scenario } from '../domain/scenario';
import type { AppState, Middleware } from './types';

export type LibraryFilter = {
  competitionId: number | null;
  seasonId: number | null;
  matchId: number | null;
  search: string;
};

export type LoadedShot = {
  detail: LibraryShotDetail;
  realScenario: Scenario;
  realPrediction: PredictResponse;
  revisionAtLoad: number;
};

export type LibrarySlice = {
  library: LibraryFilter & { loadedShot: LoadedShot | null };
  setLibraryFilter: (filter: Partial<LibraryFilter>) => void;
  loadShot: (detail: LibraryShotDetail) => void;
  resetToReal: () => void;
  clearLoadedShot: () => void;
};

export const createLibrarySlice: StateCreator<AppState, Middleware, [], LibrarySlice> = (
  set,
  get,
) => ({
  library: { competitionId: null, seasonId: null, matchId: null, search: '', loadedShot: null },
  setLibraryFilter: (filter) => set((state) => ({ library: { ...state.library, ...filter } })),
  loadShot: (detail) => {
    const realScenario = fromShotDetail(detail);
    get().replaceScenario(realScenario);
    set((state) => ({
      library: {
        ...state.library,
        loadedShot: {
          detail,
          realScenario,
          realPrediction: detail.prediction,
          revisionAtLoad: get().revision,
        },
      },
    }));
  },
  resetToReal: () => {
    const loaded = get().library.loadedShot;
    if (loaded) get().replaceScenario(loaded.realScenario);
  },
  clearLoadedShot: () => set((state) => ({ library: { ...state.library, loadedShot: null } })),
});
