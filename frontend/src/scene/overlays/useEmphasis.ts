import { featureGroup, type OverlayGroup } from '../../domain/features';
import { useStore } from '../../store';

/** Opacity multiplier: hovering a feature brightens its overlay and dims the rest. */
export function useEmphasis(group: OverlayGroup): number {
  const hovered = useStore((s) => featureGroup(s.ui.hoveredFeature));
  return hovered === null ? 1 : hovered === group ? 1.5 : 0.25;
}

export const alpha = (base: number, emphasis: number) => Math.min(1, base * emphasis);
