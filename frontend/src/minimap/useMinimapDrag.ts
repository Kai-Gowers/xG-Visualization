import { useCallback, useEffect, useRef, type PointerEvent, type RefObject } from 'react';
import type { EntityRef, SB } from '../domain/scenario';
import { useStore } from '../store';

/** Client pixel → SB units through the SVG's current screen transform. */
export function clientToSb(svg: SVGSVGElement, clientX: number, clientY: number): SB | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const m = ctm.inverse();
  return { x: m.a * clientX + m.c * clientY + m.e, y: m.b * clientX + m.d * clientY + m.f };
}

const snap = (v: number) => Math.round(v * 10) / 10;

type Drag = { ref: EntityRef; offset: SB; pending: SB | null; raf: number };

export type TokenPointerHandlers = {
  onPointerDown: (e: PointerEvent<SVGGElement>) => void;
  onPointerMove: (e: PointerEvent<SVGGElement>) => void;
  onPointerUp: (e: PointerEvent<SVGGElement>) => void;
  onPointerCancel: (e: PointerEvent<SVGGElement>) => void;
};

/** Pointer-capture drag of minimap tokens; store writes are rAF-gated and snapped to 0.1. */
export function useMinimapDrag(svgRef: RefObject<SVGSVGElement | null>) {
  const drag = useRef<Drag | null>(null);

  const flush = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    d.raf = 0;
    if (d.pending) {
      useStore.getState().movePlayer(d.ref, d.pending);
      d.pending = null;
    }
  }, []);

  useEffect(
    () => () => {
      if (drag.current?.raf) cancelAnimationFrame(drag.current.raf);
    },
    [],
  );

  const bind = useCallback(
    (ref: EntityRef, pos: SB): TokenPointerHandlers => ({
      onPointerDown: (e) => {
        if (e.button !== 0 || !svgRef.current) return;
        e.stopPropagation();
        const p = clientToSb(svgRef.current, e.clientX, e.clientY);
        if (!p) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const selection: EntityRef = { kind: ref.kind, id: ref.id };
        drag.current = {
          ref: selection,
          offset: { x: pos.x - p.x, y: pos.y - p.y },
          pending: null,
          raf: 0,
        };
        const { setSelected, setDragging } = useStore.getState();
        setSelected(selection);
        setDragging(true);
      },
      onPointerMove: (e) => {
        const d = drag.current;
        if (!d || !svgRef.current) return;
        const p = clientToSb(svgRef.current, e.clientX, e.clientY);
        if (!p) return;
        d.pending = { x: snap(p.x + d.offset.x), y: snap(p.y + d.offset.y) };
        if (!d.raf) d.raf = requestAnimationFrame(flush);
      },
      onPointerUp: (e) => {
        const d = drag.current;
        if (!d) return;
        if (d.raf) cancelAnimationFrame(d.raf);
        flush();
        e.currentTarget.releasePointerCapture(e.pointerId);
        drag.current = null;
        useStore.getState().setDragging(false);
      },
      onPointerCancel: (e) => {
        if (drag.current?.raf) cancelAnimationFrame(drag.current.raf);
        drag.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        useStore.getState().setDragging(false);
      },
    }),
    [svgRef, flush],
  );

  return bind;
}
