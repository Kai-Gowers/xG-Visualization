import { pitchLinePaths, type LinePrimitive } from '../domain/pitch';

const LINES = pitchLinePaths();

function arcPath(a: Extract<LinePrimitive, { kind: 'arc' }>) {
  const x1 = a.cx + a.r * Math.cos(a.start);
  const y1 = a.cy + a.r * Math.sin(a.start);
  const x2 = a.cx + a.r * Math.cos(a.end);
  const y2 = a.cy + a.r * Math.sin(a.end);
  const large = a.end - a.start > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${a.r} ${a.r} 0 ${large} 1 ${x2} ${y2}`;
}

export function MinimapLines() {
  return (
    <g className="minimap-lines" pointerEvents="none">
      {LINES.map((p, i) => {
        switch (p.kind) {
          case 'rect':
          case 'goal':
            return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} />;
          case 'line':
            return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />;
          case 'circle':
            return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} />;
          case 'spot':
            return <circle key={i} className="spot" cx={p.cx} cy={p.cy} r={0.4} />;
          case 'arc':
            return <path key={i} d={arcPath(p)} />;
        }
      })}
    </g>
  );
}
