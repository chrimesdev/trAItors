/** Renders shape lists (see looks.ts) to a 2D canvas or to an SVG string. */
import type { Shape } from './looks';

export function drawShapes(ctx: CanvasRenderingContext2D, shapes: Shape[], ox = 0, oy = 0): void {
  for (const s of shapes) {
    ctx.fillStyle = s.fill;
    ctx.beginPath();
    switch (s.kind) {
      case 'rect':
        ctx.roundRect(ox + s.x, oy + s.y, s.w, s.h, s.r ?? 0);
        break;
      case 'circle':
        ctx.arc(ox + s.x, oy + s.y, s.r, 0, Math.PI * 2);
        break;
      case 'ellipse':
        ctx.ellipse(ox + s.x, oy + s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
        break;
    }
    ctx.fill();
    if (s.kind === 'circle' && s.stroke) {
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function shapesToSvg(shapes: Shape[], w: number, h: number, cls = ''): string {
  const parts = shapes.map((s) => {
    switch (s.kind) {
      case 'rect':
        return `<rect x="${num(s.x)}" y="${num(s.y)}" width="${num(s.w)}" height="${num(s.h)}" rx="${num(s.r ?? 0)}" fill="${s.fill}"/>`;
      case 'circle':
        return `<circle cx="${num(s.x)}" cy="${num(s.y)}" r="${num(s.r)}" fill="${s.fill}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="0.8"` : ''}/>`;
      case 'ellipse':
        return `<ellipse cx="${num(s.x)}" cy="${num(s.y)}" rx="${num(s.rx)}" ry="${num(s.ry)}" fill="${s.fill}"/>`;
    }
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" class="${cls}" aria-hidden="true">${parts.join('')}</svg>`;
}
