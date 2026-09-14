import type { StateCreator } from 'zustand';
import type { EntityRef } from '../domain/scenario';
import type { AppState, Middleware } from './types';

export type CameraPreset = 'behindShooter' | 'broadcast' | 'topDown';
export const CAMERA_PRESETS: CameraPreset[] = ['behindShooter', 'broadcast', 'topDown'];
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
  };
  setSelected: (ref: EntityRef | null) => void;
  setDragging: (dragging: boolean) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  toggleOverlay: (key: OverlayKey) => void;
  setHoveredFeature: (feature: string | null) => void;
  setMinimapZoom: (zoom: MinimapZoom) => void;
  setAssetsMode: (mode: AssetsMode) => void;
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
  };
};
