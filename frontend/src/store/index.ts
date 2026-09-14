import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createLibrarySlice } from './librarySlice';
import { createPredictionSlice } from './predictionSlice';
import { createScenarioSlice } from './scenarioSlice';
import type { AppState } from './types';
import { createUiSlice } from './uiSlice';

export type { AppState } from './types';

export const createAppStore = () =>
  create<AppState>()(
    subscribeWithSelector((...a) => ({
      ...createScenarioSlice(...a),
      ...createUiSlice(...a),
      ...createPredictionSlice(...a),
      ...createLibrarySlice(...a),
    })),
  );

export type AppStore = ReturnType<typeof createAppStore>;

export const useStore = createAppStore();
