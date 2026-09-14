import type { StateCreator } from 'zustand';
import {
  addDefender,
  addTeammate,
  defaultScenario,
  movePlayer,
  removeEntity,
  setAttr,
  setGoalkeeper,
  type EntityRef,
  type SB,
  type Scenario,
  type ShotAttrs,
} from '../domain/scenario';
import type { AppState, Middleware } from './types';

export type ScenarioSlice = {
  scenario: Scenario;
  /** Incremented on every scenario mutation; drives live prediction and staleness. */
  revision: number;
  movePlayer: (ref: EntityRef, pos: SB) => void;
  addDefender: (pos?: SB) => void;
  addTeammate: (pos?: SB) => void;
  removeEntity: (ref: EntityRef) => void;
  setGoalkeeper: (pos: SB | null) => void;
  setAttr: <K extends keyof ShotAttrs>(key: K, value: ShotAttrs[K]) => void;
  replaceScenario: (scenario: Scenario) => void;
  resetToDefault: () => void;
};

export const createScenarioSlice: StateCreator<AppState, Middleware, [], ScenarioSlice> = (set) => {
  const mutate = (fn: (s: Scenario) => Scenario) =>
    set((state) => {
      const scenario = fn(state.scenario);
      return scenario === state.scenario ? {} : { scenario, revision: state.revision + 1 };
    });
  return {
    scenario: defaultScenario(),
    revision: 0,
    movePlayer: (ref, pos) => mutate((s) => movePlayer(s, ref, pos)),
    addDefender: (pos) => mutate((s) => addDefender(s, pos)),
    addTeammate: (pos) => mutate((s) => addTeammate(s, pos)),
    removeEntity: (ref) => {
      mutate((s) => removeEntity(s, ref));
      set((state) =>
        state.ui.selected?.id === ref.id ? { ui: { ...state.ui, selected: null } } : {},
      );
    },
    setGoalkeeper: (pos) => mutate((s) => setGoalkeeper(s, pos)),
    setAttr: (key, value) => mutate((s) => setAttr(s, key, value)),
    replaceScenario: (scenario) => mutate(() => scenario),
    resetToDefault: () => mutate(defaultScenario),
  };
};
