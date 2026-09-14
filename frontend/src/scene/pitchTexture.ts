import { CanvasTexture, SRGBColorSpace } from 'three';
import {
  PITCH,
  pitchLinePaths,
  sbToWorld,
  X_SCALE,
  Z_SCALE,
  type SB,
  type Vec3,
} from '../domain/pitch';

/** Grass drawn beyond the touchlines so the goal and camera never see the plane's edge. */
export const PITCH_MARGIN_M = 8;
export const PLANE_W = PITCH.lengthM + 2 * PITCH_MARGIN_M;
export const PLANE_H = PITCH.widthM + 2 * PITCH_MARGIN_M;
export const PLANE_CENTRE: Vec3 = [-PITCH.lengthM / 2, 0, 0];

const TEX_W = 4096;
const TEX_H = Math.round((TEX_W * PLANE_H) / PLANE_W);
const LINE_WIDTH_M = 0.12;
const STRIPES = 20;

export function createPitchTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;
  const pxPerM = TEX_W / PLANE_W;
  const toPx = (p: SB): [number, number] => {
    const [wx, , wz] = sbToWorld(p);
    return [(wx + PITCH.lengthM + PITCH_MARGIN_M) * pxPerM, (wz + PLANE_H / 2) * pxPerM];
  };
  const sx = X_SCALE * pxPerM;
  const sz = Z_SCALE * pxPerM;

  ctx.fillStyle = '#245a30';
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  const [x0, y0] = toPx({ x: 0, y: 0 });
  const stripeW = (PITCH.length / STRIPES) * sx;
  for (let i = 0; i < STRIPES; i++) {
    ctx.fillStyle = i % 2 ? '#2f7a3e' : '#358a46';
    ctx.fillRect(x0 + i * stripeW, y0, stripeW + 1, PITCH.width * sz);
  }

  ctx.strokeStyle = '#f4f7f4';
  ctx.fillStyle = '#f4f7f4';
  ctx.lineWidth = LINE_WIDTH_M * pxPerM;
  ctx.lineCap = 'round';
  for (const p of pitchLinePaths()) {
    switch (p.kind) {
      case 'rect': {
        const [x, y] = toPx(p);
        ctx.strokeRect(x, y, p.w * sx, p.h * sz);
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(...toPx({ x: p.x1, y: p.y1 }));
        ctx.lineTo(...toPx({ x: p.x2, y: p.y2 }));
        ctx.stroke();
        break;
      }
      case 'circle':
      case 'arc': {
        const [cx, cy] = toPx({ x: p.cx, y: p.cy });
        const [start, end] = p.kind === 'arc' ? [p.start, p.end] : [0, 2 * Math.PI];
        ctx.beginPath();
        ctx.ellipse(cx, cy, p.r * sx, p.r * sz, 0, start, end);
        ctx.stroke();
        break;
      }
      case 'spot': {
        const [cx, cy] = toPx({ x: p.cx, y: p.cy });
        ctx.beginPath();
        ctx.ellipse(cx, cy, 0.25 * sx, 0.25 * sz, 0, 0, 2 * Math.PI);
        ctx.fill();
        break;
      }
      case 'goal':
        break; // the 3D goal frame stands here
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
