import type { StateCreator } from 'zustand';
import type { EntityRef } from '../domain/scenario';
import type { AppState, Middleware } from './types';

export type CameraPreset = 'behindShooter' | 'gk' | 'broadcast' | 'topDown';
/** Order = keyboard shortcuts 1–4. */
export const CAMERA_PRESETS: CameraPreset[] = ['behindShooter', 'gk', 'broadcast', 'topDown'];
export type SideTab = 'shot' | 'why' | 'library';
export type MinimapZoom = 'full' | 'finalThird';
export type AssetsMode = 'rigged' | 'capsule';
export type OverlayKey =
  'cone' | 'coverage' | 'closestDefender' | 'gkOffset' | 'trajectory' | 'labels';

export type UiSlice = {
  ui: {
    selected: EntityRef | null;
    dragging: boolean;
    cameraPreset: CameraPreset;
    overlays: Record<OverlayKey, boolean>;
    hoveredFeature: string | null;
    minimapZoom: MinimapZoom;
    assetsMode: AssetsMode;
    sideTab: SideTab;
  };
  setSelected: (ref: EntityRef | null) => void;
  setDragging: (dragging: boolean) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  toggleOverlay: (key: OverlayKey) => void;
  setHoveredFeature: (feature: string | null) => void;
  setMinimapZoom: (zoom: MinimapZoom) => void;
  setAssetsMode: (mode: AssetsMode) => void;
  setSideTab: (tab: SideTab) => void;
};

export const createUiSlice: StateCreator<AppState, Middleware, [], UiSlice> = (set) => {
  const patch = (p: Partial<UiSlice['ui']>) => set((state) => ({ ui: { ...state.ui, ...p } }));
  return {
    ui: {
      selected: null,
      dragging: false,
      cameraPreset: 'behindShooter',
      overlays: {
        cone: true,
        coverage: true,
        closestDefender: false,
        gkOffset: false,
        trajectory: true,
        labels: true,
      },
      hoveredFeature: null,
      minimapZoom: 'finalThird',
      assetsMode: 'capsule',
      sideTab: 'shot',
    },
    setSelected: (selected) => patch({ selected }),
    setDragging: (dragging) => patch({ dragging }),
    setCameraPreset: (cameraPreset) => patch({ cameraPreset }),
    toggleOverlay: (key) =>
      set((state) => ({
        ui: { ...state.ui, overlays: { ...state.ui.overlays, [key]: !state.ui.overlays[key] } },
      })),
    setHoveredFeature: (hoveredFeature) => patch({ hoveredFeature }),
    setMinimapZoom: (minimapZoom) => patch({ minimapZoom }),
    setAssetsMode: (assetsMode) => patch({ assetsMode }),
    setSideTab: (sideTab) => patch({ sideTab }),
  };
};
