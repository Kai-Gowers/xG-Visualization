import { useMemo, useRef, type MouseEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MINIMAP_FINAL_THIRD, MINIMAP_FULL, PITCH } from '../domain/pitch';
import { allEntities } from '../domain/scenario';
import { useStore } from '../store';
import { selectInConeIds } from '../store/selectors';
import './minimap.css';
import { MinimapLines } from './MinimapLines';
import { MinimapToken } from './MinimapToken';
import { MinimapToolbar } from './MinimapToolbar';
import { clientToSb, useMinimapDrag } from './useMinimapDrag';

export function Minimap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const scenario = useStore((s) => s.scenario);
  const selectedId = useStore((s) => s.ui.selected?.id ?? null);
  const zoom = useStore((s) => s.ui.minimapZoom);
  const inCone = useStore(useShallow(selectInConeIds));
  const bind = useMinimapDrag(svgRef);

  const entities = useMemo(() => allEntities(scenario), [scenario]);
  const vb = zoom === 'full' ? MINIMAP_FULL : MINIMAP_FINAL_THIRD;
  const { shooter } = scenario;
  const cone = `${shooter.x},${shooter.y} ${PITCH.goalX},${PITCH.posts[0]} ${PITCH.goalX},${PITCH.posts[1]}`;

  const onBackgroundDoubleClick = (e: MouseEvent<SVGRectElement>) => {
    if (!svgRef.current) return;
    const p = clientToSb(svgRef.current, e.clientX, e.clientY);
    if (!p) return;
    const { addDefender, addTeammate } = useStore.getState();
    (e.shiftKey ? addTeammate : addDefender)(p);
  };

  return (
    <div className={`minimap minimap-${zoom}`} data-testid="minimap">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ aspectRatio: `${vb.w} / ${vb.h}` }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Pitch minimap"
      >
        <rect
          className="minimap-bg"
          x={vb.x}
          y={vb.y}
          width={vb.w}
          height={vb.h}
          onClick={() => useStore.getState().setSelected(null)}
          onDoubleClick={onBackgroundDoubleClick}
        />
        <MinimapLines />
        <polygon className="minimap-cone" points={cone} pointerEvents="none" />
        {entities.map((e) => (
          <MinimapToken
            key={e.id}
            entity={e}
            selected={e.id === selectedId}
            inCone={inCone.includes(e.id)}
            handlers={bind(e, e)}
            onRemove={() => useStore.getState().removeEntity(e)}
          />
        ))}
      </svg>
      <MinimapToolbar />
    </div>
  );
}
