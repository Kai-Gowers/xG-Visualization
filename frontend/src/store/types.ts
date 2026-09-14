import type { LibrarySlice } from './librarySlice';
import type { PredictionSlice } from './predictionSlice';
import type { ScenarioSlice } from './scenarioSlice';
import type { UiSlice } from './uiSlice';

export type AppState = ScenarioSlice & UiSlice & PredictionSlice & LibrarySlice;
export type Middleware = [['zustand/subscribeWithSelector', never]];
