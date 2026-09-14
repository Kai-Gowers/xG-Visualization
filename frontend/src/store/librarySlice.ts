import type { StateCreator } from 'zustand';
import type { PredictResponse, ShotDetail } from '../api/types';
import { fromShotDetail, type Scenario } from '../domain/scenario';
import type { AppState, Middleware } from './types';

export const SEARCH_PRESETS = [
  ['goals', 'Goals'],
  ['big_chance_miss', 'Big-chance misses'],
  ['largest_disagreement', 'Biggest disagreement'],
  ['low_xg_goal', 'Low-xG goals'],
  ['weak_foot_goals', 'Weak-foot goals'],
  ['headers', 'Headers'],
] as const;
export type SearchPreset = (typeof SEARCH_PRESETS)[number][0];

export type LibraryFilter = {
  competitionId: number | null;
  seasonId: number | null;
  matchId: number | null;
  preset: SearchPreset | null;
  /** Player-name search; empty means "browse by match". */
  player: string;
};

export type LoadedShot = {
  detail: ShotDetail;
  realScenario: Scenario;
  realPrediction: PredictResponse;
  revisionAtLoad: number;
};

export type LibrarySlice = {
  library: LibraryFilter & { loadedShot: LoadedShot | null };
  setLibraryFilter: (filter: Partial<LibraryFilter>) => void;
  loadShot: (detail: ShotDetail) => void;
  resetToReal: () => void;
  clearLoadedShot: () => void;
};

export const createLibrarySlice: StateCreator<AppState, Middleware, [], LibrarySlice> = (
  set,
  get,
) => {
  /** Swap the scenario and seed the prediction with a known answer so nothing flashes. */
  const show = (scenario: Scenario, prediction: PredictResponse) => {
    get().replaceScenario(scenario);
    get().predictionSucceeded(get().revision, prediction);
  };
  return {
    library: {
      competitionId: null,
      seasonId: null,
      matchId: null,
      preset: null,
      player: '',
      loadedShot: null,
    },
    setLibraryFilter: (filter) => set((state) => ({ library: { ...state.library, ...filter } })),
    loadShot: (detail) => {
      const realScenario = fromShotDetail(detail);
      show(realScenario, detail.prediction);
      set((state) => ({
        library: {
          ...state.library,
          loadedShot: {
            detail,
            realScenario,
            realPrediction: detail.prediction,
            revisionAtLoad: state.revision,
          },
        },
        ui: {
          ...state.ui,
          cameraPreset: 'behindShooter',
          overlays: { ...state.ui.overlays, trajectory: true },
        },
      }));
    },
    resetToReal: () => {
      const loaded = get().library.loadedShot;
      if (loaded) show(loaded.realScenario, loaded.realPrediction);
    },
    clearLoadedShot: () => {
      set((state) => ({ library: { ...state.library, loadedShot: null } }));
      get().resetToDefault();
    },
  };
};
