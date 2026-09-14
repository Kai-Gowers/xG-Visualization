import { ROLE_COLORS, ROLE_LABELS } from '../domain/roles';
import type { EntityRef, SB } from '../domain/scenario';
import type { TokenPointerHandlers } from './useMinimapDrag';

export const TOKEN_RADIUS = 1.3;

type Props = {
  entity: EntityRef & SB;
  selected: boolean;
  inCone: boolean;
  handlers: TokenPointerHandlers;
  onRemove: () => void;
};

export function MinimapToken({ entity, selected, inCone, handlers, onRemove }: Props) {
  const { kind, id, x, y } = entity;
  return (
    <g
      className={`token token-${kind}${selected ? ' is-selected' : ''}${inCone ? ' in-cone' : ''}`}
      data-testid={`token-${id}`}
      transform={`translate(${x} ${y})`}
      {...handlers}
    >
      {selected && <circle className="token-ring" r={TOKEN_RADIUS + 0.8} />}
      <circle className="token-body" r={TOKEN_RADIUS} fill={ROLE_COLORS[kind]} />
      <text className="token-label" y={0.55}>
        {ROLE_LABELS[kind]}
      </text>
      {selected && kind !== 'shooter' && (
        <g
          className="token-remove"
          transform={`translate(${TOKEN_RADIUS + 0.9} ${-TOKEN_RADIUS - 0.9})`}
          role="button"
          aria-label={`Remove ${kind}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <circle r={1} />
          <text y={0.5}>×</text>
        </g>
      )}
    </g>
  );
}
