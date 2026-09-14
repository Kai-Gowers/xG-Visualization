import { Html } from '@react-three/drei';
import type { ReactNode } from 'react';
import type { Vec3 } from '../../domain/pitch';
import { useStore } from '../../store';

type Props = { position: Vec3; emphasis?: number; color?: string; children: ReactNode };

/** Small pill label in world space at constant screen size; hidden by the "Labels" overlay toggle. */
export function OverlayLabel({ position, emphasis = 1, color, children }: Props) {
  const show = useStore((s) => s.ui.overlays.labels);
  if (!show) return null;
  return (
    <Html position={position} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <span
        className="overlay-label"
        style={{ opacity: Math.min(1, emphasis), borderColor: color }}
      >
        {children}
      </span>
    </Html>
  );
}
