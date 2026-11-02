/**
 * Paints the mansion (floors, walls, doors, furniture) onto a 2D canvas once at
 * scene start. Everything is drawn in code so the build ships no image files.
 * Furniture keeps clear of the NPC spots and evidence corners in layout.ts.
 */
import type { Layout } from './layout';

type Floor = 'wood' | 'stone' | 'carpet' | 'tiles';

interface Theme {
  floor: Floor;
  base: string;
  accent: string;
}

const WALL = '#15152a';
const WALL_LINE = 'rgba(255,255,255,0.045)';
const DOOR = '#5a3f2a';
const DOOR_DARK = '#3a2819';
const WOOD = '#5a3f2a';
const WOOD_LIGHT = '#7a583a';
const GOLD = '#c9a24a';
const INK = '#141426';

export const ROOM_THEMES: Record<string, Theme> = {
  conservatory: { floor: 'tiles', base: '#2b4537', accent: '#355443' },
  lounge: { floor: 'carpet', base: '#3d2a42', accent: '#4f3757' },
  stairsLanding: { floor: 'wood', base: '#45362a', accent: '#54422f' },
  bedroomCorridor: { floor: 'carpet', base: '#373046', accent: '#463d5a' },
  library: { floor: 'wood', base: '#3a2c22', accent: '#47362a' },
  hall: { floor: 'stone', base: '#3b3b44', accent: '#45454f' },
  dining: { floor: 'wood', base: '#4a3527', accent: '#5a402f' },
  study: { floor: 'wood', base: '#3d2f25', accent: '#4a392d' },
  cellar: { floor: 'stone', base: '#25252d', accent: '#2d2d37' },
  kitchen: { floor: 'tiles', base: '#3a3a31', accent: '#46463c' },
};
const DEFAULT_THEME: Theme = { floor: 'stone', base: '#333', accent: '#3c3c3c' };

interface Px {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Deterministic 0..1 noise from a position, so the paint never changes between loads. */
function noise(x: number, y: number): number {
  let h = (x * 73856093) ^ (y * 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- floors

function floorWood(ctx: CanvasRenderingContext2D, r: Px, t: Theme): void {
  ctx.fillStyle = t.base;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const plank = 7;
  for (let y = r.y; y < r.y + r.h; y += plank) {
    const row = Math.floor((y - r.y) / plank);
    ctx.fillStyle = row % 2 ? t.accent : t.base;
    ctx.fillRect(r.x, y, r.w, plank);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(r.x, y, r.w, 1);
    // plank ends
    const offset = (row * 29) % 48;
    for (let x = r.x + offset; x < r.x + r.w; x += 48) ctx.fillRect(x, y, 1, plank);
  }
}

function floorStone(ctx: CanvasRenderingContext2D, r: Px, t: Theme, cell: number): void {
  ctx.fillStyle = t.base;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  for (let y = r.y; y < r.y + r.h; y += cell) {
    for (let x = r.x; x < r.x + r.w; x += cell) {
      const n = noise(x, y);
      ctx.fillStyle = n > 0.66 ? t.accent : n > 0.33 ? t.base : mix(t.base, '#000', 0.12);
      ctx.fillRect(x, y, Math.min(cell, r.x + r.w - x), Math.min(cell, r.y + r.h - y));
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = r.y; y < r.y + r.h; y += cell) ctx.fillRect(r.x, y, r.w, 1);
  for (let x = r.x; x < r.x + r.w; x += cell) ctx.fillRect(x, r.y, 1, r.h);
}

function floorTiles(ctx: CanvasRenderingContext2D, r: Px, t: Theme): void {
  const cell = 12;
  for (let y = r.y; y < r.y + r.h; y += cell) {
    for (let x = r.x; x < r.x + r.w; x += cell) {
      const even = (Math.floor((x - r.x) / cell) + Math.floor((y - r.y) / cell)) % 2 === 0;
      ctx.fillStyle = even ? t.base : t.accent;
      ctx.fillRect(x, y, Math.min(cell, r.x + r.w - x), Math.min(cell, r.y + r.h - y));
    }
  }
}

function floorCarpet(ctx: CanvasRenderingContext2D, r: Px, t: Theme): void {
  ctx.fillStyle = t.base;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const step = 16;
  for (let d = -r.h; d < r.w + r.h; d += step) {
    ctx.moveTo(r.x + d, r.y);
    ctx.lineTo(r.x + d + r.h, r.y + r.h);
    ctx.moveTo(r.x + d, r.y + r.h);
    ctx.lineTo(r.x + d + r.h, r.y);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.strokeRect(r.x + 5.5, r.y + 5.5, r.w - 11, r.h - 11);
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.length === 4 ? b[1]! + b[1] + b[2] + b[2] + b[3] + b[3] : b.slice(1), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 255;
    const vb = (pb >> shift) & 255;
    return Math.round(va + (vb - va) * t);
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// ---------------------------------------------------------------- props

function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  r = 2,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 3): void {
  rect(ctx, x + 2, y + 3, w, h, 'rgba(0,0,0,0.35)', r);
}

function rug(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  rect(ctx, x, y, w, h, fill, 3);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function table(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  round = false,
): void {
  shadow(ctx, x, y, w, h, round ? h / 2 : 3);
  if (round) {
    ctx.fillStyle = WOOD;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = WOOD_LIGHT;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2 - 1, w / 2 - 3, h / 2 - 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    rect(ctx, x, y, w, h, WOOD, 3);
    rect(ctx, x + 2, y + 2, w - 4, h - 5, WOOD_LIGHT, 2);
  }
}

function chair(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, x, y, 8, 8, DOOR_DARK, 2);
  rect(ctx, x + 1, y + 1, 6, 6, WOOD, 1);
}

function bookshelf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  shadow(ctx, x, y, w, h);
  rect(ctx, x, y, w, h, DOOR_DARK, 1);
  const books = ['#8f2d3a', '#2d5a8f', '#3a7a4a', '#c9a24a', '#6b4a8f', '#b35a2a'];
  const rows = Math.max(1, Math.floor(h / 8));
  for (let row = 0; row < rows; row++) {
    const by = y + 2 + row * (h / rows);
    let bx = x + 2;
    let i = 0;
    while (bx < x + w - 3) {
      const bw = 2 + Math.floor(noise(bx, by) * 3);
      ctx.fillStyle = books[(i + row) % books.length] ?? GOLD;
      ctx.fillRect(bx, by + (noise(by, bx) > 0.5 ? 1 : 0), bw, h / rows - 3);
      bx += bw + 1;
      i++;
    }
  }
}

function plant(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, x - 4, y + 4, 8, 7, '#7a4a2a', 1);
  for (const [dx, dy, r] of [
    [0, 0, 5],
    [-4, 2, 4],
    [4, 2, 4],
    [0, -4, 3.5],
  ] as const) {
    ctx.fillStyle = dy < 1 ? '#4f9a5a' : '#3a7a46';
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function barrel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  shadow(ctx, x, y, 14, 16, 4);
  rect(ctx, x, y, 14, 16, '#6b4a2a', 4);
  ctx.fillStyle = '#3a2819';
  ctx.fillRect(x, y + 4, 14, 1);
  ctx.fillRect(x, y + 11, 14, 1);
}

function doorway(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, DOOR_DARK, 1);
  rect(ctx, x + 2, y + 2, w - 4, h - 2, DOOR, 1);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(x + w - 5, y + h / 2 + 1, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function stairs(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  shadow(ctx, x, y, w, h);
  rect(ctx, x, y, w, h, DOOR_DARK, 1);
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const sy = y + (i * h) / steps;
    ctx.fillStyle = i % 2 ? WOOD : WOOD_LIGHT;
    ctx.fillRect(x + 2, sy + 1, w - 4, h / steps - 2);
  }
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 3, y, 2, h);
}

function counter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  shadow(ctx, x, y, w, h);
  rect(ctx, x, y, w, h, '#5e5e55', 2);
  rect(ctx, x + 1, y + 1, w - 2, 3, '#8a8a7e', 1);
  // stove
  rect(ctx, x + w * 0.6, y + 1, 22, h - 2, '#2a2a30', 1);
  ctx.strokeStyle = '#8f8aa3';
  ctx.lineWidth = 1;
  for (const dx of [6, 16]) {
    ctx.beginPath();
    ctx.arc(x + w * 0.6 + dx, y + h / 2, 3.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function wineRack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  shadow(ctx, x, y, w, h);
  rect(ctx, x, y, w, h, DOOR_DARK, 1);
  for (let by = y + 5; by < y + h - 3; by += 7) {
    for (let bx = x + 5; bx < x + w - 3; bx += 8) {
      ctx.fillStyle = noise(bx, by) > 0.7 ? '#1a1a1e' : '#3a1f3a';
      ctx.beginPath();
      ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function fireplace(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, '#5a3a30', 1);
  rect(ctx, x + 3, y + 4, w - 6, h - 6, '#1a1010', 1);
  const g = ctx.createRadialGradient(x + w / 2, y + h - 6, 1, x + w / 2, y + h - 6, w);
  g.addColorStop(0, 'rgba(255,170,60,0.9)');
  g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x + 3, y + 4, w - 6, h - 6);
}

function armchair(ctx: CanvasRenderingContext2D, x: number, y: number, fill = '#7a3f52'): void {
  shadow(ctx, x, y, 16, 16, 4);
  rect(ctx, x, y, 16, 16, fill, 4);
  rect(ctx, x + 3, y + 5, 10, 8, mix(fill, '#fff', 0.15), 2);
}

function lamp(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const g = ctx.createRadialGradient(x, y, 1, x, y, 22);
  g.addColorStop(0, 'rgba(255,220,140,0.45)');
  g.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 22, y - 22, 44, 44);
  rect(ctx, x - 2, y - 2, 4, 8, '#3a2819', 1);
  rect(ctx, x - 5, y - 7, 10, 6, '#f1d9a0', 2);
}

function painting(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, GOLD, 1);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, noise(x, y) > 0.5 ? '#2d5a8f' : '#5a3a6a');
  g.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = g;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
}

function pillar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6a6a78';
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8f8fa0';
  ctx.beginPath();
  ctx.arc(x - 1, y - 1, 4, 0, Math.PI * 2);
  ctx.fill();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colour: string): void {
  const g = ctx.createRadialGradient(x, y, 1, x, y, radius);
  g.addColorStop(0, colour);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function crate(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  shadow(ctx, x, y, 14, 14, 1);
  rect(ctx, x, y, 14, 14, '#8a6a3a', 1);
  ctx.strokeStyle = '#4a3418';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, 13, 13);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 14, y + 14);
  ctx.moveTo(x + 14, y);
  ctx.lineTo(x, y + 14);
  ctx.stroke();
}

function fountain(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#6a6a78';
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f7fa8';
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8f8fa0';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function sideboard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  shadow(ctx, x, y, w, 14);
  rect(ctx, x, y, w, 14, WOOD, 2);
  rect(ctx, x + 2, y + 2, w - 4, 4, WOOD_LIGHT, 1);
  for (const dx of [w * 0.3, w * 0.7]) {
    ctx.fillStyle = '#f1d9a0';
    ctx.fillRect(x + dx - 1, y - 6, 2, 7);
    glow(ctx, x + dx, y - 7, 8, 'rgba(255,200,100,0.6)');
  }
}

const PROPS: Record<string, (ctx: CanvasRenderingContext2D, r: Px) => void> = {
  conservatory: (ctx, r) => {
    // glass roof edge
    ctx.fillStyle = 'rgba(160, 220, 255, 0.18)';
    ctx.fillRect(r.x, r.y, r.w, 4);
    for (const f of [0.36, 0.56, 0.76, 0.94]) plant(ctx, r.x + r.w * f, r.y + 12);
    fountain(ctx, r.x + r.w * 0.5, r.y + r.h * 0.52);
    rect(ctx, r.x + r.w - 12, r.y + r.h * 0.3, 8, r.h * 0.45, WOOD, 2);
    plant(ctx, r.x + r.w * 0.12, r.y + r.h - 16);
  },
  lounge: (ctx, r) => {
    rug(ctx, r.x + r.w * 0.26, r.y + r.h * 0.28, r.w * 0.48, r.h * 0.5, '#5a2634');
    shadow(ctx, r.x + r.w * 0.3, r.y + 6, r.w * 0.4, 16, 4);
    rect(ctx, r.x + r.w * 0.3, r.y + 6, r.w * 0.4, 16, '#7a3f52', 4);
    rect(ctx, r.x + r.w * 0.3 + 3, r.y + 12, r.w * 0.4 - 6, 9, '#8f4a60', 3);
    fireplace(ctx, r.x + 4, r.y + r.h * 0.3, 14, r.h * 0.4);
    armchair(ctx, r.x + r.w * 0.08, r.y + r.h - 24);
    armchair(ctx, r.x + r.w - 24, r.y + r.h - 24);
    lamp(ctx, r.x + r.w - 12, r.y + r.h * 0.28);
    painting(ctx, r.x + r.w * 0.78, r.y + 4, 22, 14);
  },
  stairsLanding: (ctx, r) => {
    rug(ctx, r.x + 8, r.y + r.h * 0.22, r.w * 0.5, r.h * 0.6, '#4a2334');
    stairs(ctx, r.x + r.w * 0.68, r.y + 8, r.w * 0.26, r.h - 16);
    painting(ctx, r.x + r.w * 0.2, r.y + 4, 24, 14);
    rect(ctx, r.x + 6, r.y + r.h - 18, 8, 12, '#3a3a44', 2);
  },
  bedroomCorridor: (ctx, r) => {
    rug(ctx, r.x + r.w * 0.06, r.y + r.h * 0.4, r.w * 0.88, r.h * 0.28, '#4a2334');
    for (const f of [0.06, 0.3, 0.54, 0.78]) {
      doorway(ctx, r.x + r.w * f, r.y + 3, r.w * 0.14, 20);
      glow(ctx, r.x + r.w * (f + 0.19), r.y + 8, 10, 'rgba(255,200,100,0.55)');
      ctx.fillStyle = GOLD;
      ctx.fillRect(r.x + r.w * (f + 0.19) - 1, r.y + 6, 2, 4);
    }
    rect(ctx, r.x + r.w * 0.45, r.y + r.h - 12, 26, 8, WOOD, 2);
  },
  library: (ctx, r) => {
    bookshelf(ctx, r.x + 8, r.y + 4, r.w - 16, 20);
    bookshelf(ctx, r.x + 4, r.y + r.h * 0.3, 12, r.h * 0.5);
    bookshelf(ctx, r.x + r.w - 16, r.y + r.h * 0.3, 12, r.h * 0.4);
    table(ctx, r.x + r.w * 0.38, r.y + r.h * 0.44, r.w * 0.24, r.h * 0.16);
    chair(ctx, r.x + r.w * 0.5 - 4, r.y + r.h * 0.44 - 11);
    chair(ctx, r.x + r.w * 0.5 - 4, r.y + r.h * 0.6 + 3);
    rect(ctx, r.x + r.w * 0.7, r.y + 2, 4, 30, WOOD_LIGHT, 1);
    rect(ctx, r.x + r.w * 0.7 + 8, r.y + 2, 4, 30, WOOD_LIGHT, 1);
    lamp(ctx, r.x + r.w - 10, r.y + r.h - 14);
  },
  hall: (ctx, r) => {
    rug(ctx, r.x + r.w * 0.22, r.y + r.h * 0.2, r.w * 0.56, r.h * 0.6, '#5a1f2b');
    glow(ctx, r.x + r.w * 0.5, r.y + r.h * 0.5, 70, 'rgba(255,220,150,0.22)');
    table(ctx, r.x + r.w * 0.4, r.y + r.h * 0.36, r.w * 0.2, r.h * 0.28, true);
    pillar(ctx, r.x + 14, r.y + r.h * 0.5);
    pillar(ctx, r.x + r.w - 14, r.y + r.h * 0.5);
    for (const f of [0.28, 0.5, 0.72]) painting(ctx, r.x + r.w * f - 11, r.y + 4, 22, 14);
  },
  dining: (ctx, r) => {
    rug(ctx, r.x + r.w * 0.16, r.y + r.h * 0.3, r.w * 0.68, r.h * 0.44, '#1f3a2e');
    table(ctx, r.x + r.w * 0.22, r.y + r.h * 0.4, r.w * 0.56, r.h * 0.22);
    rect(ctx, r.x + r.w * 0.3, r.y + r.h * 0.44, r.w * 0.4, r.h * 0.1, '#e8e2d0', 1);
    for (const f of [0.28, 0.42, 0.56, 0.7]) {
      chair(ctx, r.x + r.w * f, r.y + r.h * 0.4 - 11);
      chair(ctx, r.x + r.w * f, r.y + r.h * 0.62 + 3);
    }
    sideboard(ctx, r.x + r.w * 0.3, r.y + 8, r.w * 0.4);
    painting(ctx, r.x + r.w * 0.82, r.y + 4, 22, 14);
  },
  study: (ctx, r) => {
    rug(ctx, r.x + r.w * 0.25, r.y + r.h * 0.4, r.w * 0.5, r.h * 0.42, '#3a2a4a');
    table(ctx, r.x + r.w * 0.3, r.y + 6, r.w * 0.4, 18);
    lamp(ctx, r.x + r.w * 0.64, r.y + 12);
    chair(ctx, r.x + r.w * 0.5 - 4, r.y + 27);
    bookshelf(ctx, r.x + 4, r.y + r.h * 0.32, 12, r.h * 0.5);
    rect(ctx, r.x + r.w - 18, r.y + r.h * 0.25, 14, r.h * 0.4, DOOR_DARK, 2);
    rect(ctx, r.x + r.w - 16, r.y + r.h * 0.25 + 3, 10, r.h * 0.4 - 6, WOOD, 1);
    ctx.fillStyle = '#3f7fa8';
    ctx.beginPath();
    ctx.arc(r.x + r.w - 14, r.y + r.h - 14, 6, 0, Math.PI * 2);
    ctx.fill();
  },
  cellar: (ctx, r) => {
    wineRack(ctx, r.x + 8, r.y + 4, r.w * 0.6, 22);
    barrel(ctx, r.x + 6, r.y + r.h - 24);
    barrel(ctx, r.x + 22, r.y + r.h - 24);
    barrel(ctx, r.x + 6, r.y + r.h - 44);
    crate(ctx, r.x + r.w * 0.48, r.y + r.h - 20);
    crate(ctx, r.x + r.w * 0.48 + 10, r.y + r.h - 32);
    glow(ctx, r.x + r.w * 0.82, r.y + 12, 26, 'rgba(255,170,80,0.5)');
    ctx.fillStyle = '#f1d9a0';
    ctx.fillRect(r.x + r.w * 0.82 - 1, r.y + 8, 2, 6);
  },
  kitchen: (ctx, r) => {
    counter(ctx, r.x + 6, r.y + 4, r.w - 56, 18);
    rect(ctx, r.x + 30, r.y + 7, 18, 10, '#8fa3b3', 2);
    rect(ctx, r.x + r.w - 20, r.y + 30, 14, r.h - 50, '#5e5e55', 2);
    for (const dy of [34, 46, 58])
      rect(ctx, r.x + r.w - 17, r.y + dy, 8, 6, noise(dy, r.x) > 0.5 ? '#b35a2a' : '#6a7a8a', 2);
    table(ctx, r.x + r.w * 0.34, r.y + r.h * 0.42, r.w * 0.26, r.h * 0.22);
    for (const f of [0.38, 0.52]) chair(ctx, r.x + r.w * f, r.y + r.h * 0.64 + 3);
    rect(ctx, r.x + 8, r.y + r.h - 20, 28, 12, '#5e5e55', 2);
  },
};

// ---------------------------------------------------------------- the mansion

export function paintMansion(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const t = layout.tileSize;
  const W = layout.def.cols * t;
  const H = layout.def.rows * t;

  // Walls everywhere, with faint brickwork.
  ctx.fillStyle = WALL;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = WALL_LINE;
  for (let y = 0; y < H; y += 8) {
    ctx.fillRect(0, y, W, 1);
    const off = (y / 8) % 2 ? 10 : 0;
    for (let x = off; x < W; x += 20) ctx.fillRect(x, y, 1, 8);
  }

  for (const room of layout.def.rooms) {
    const r = layout.pixelRect(room.id);
    const theme = ROOM_THEMES[room.id] ?? DEFAULT_THEME;
    switch (theme.floor) {
      case 'wood':
        floorWood(ctx, r, theme);
        break;
      case 'stone':
        floorStone(ctx, r, theme, t);
        break;
      case 'tiles':
        floorTiles(ctx, r, theme);
        break;
      case 'carpet':
        floorCarpet(ctx, r, theme);
        break;
    }
    // The wall above casts a shadow onto the floor; the skirting catches a little light.
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + 10);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    ctx.fillRect(r.x, r.y, 1, r.h);
    PROPS[room.id]?.(ctx, r);
  }

  for (const d of layout.def.doors) {
    const x = d.x * t;
    const y = d.y * t;
    ctx.fillStyle = DOOR;
    ctx.fillRect(x, y, t, t);
    ctx.fillStyle = DOOR_DARK;
    const vertical = layout.roomAt(d.x - 1, d.y) !== null || layout.roomAt(d.x + 1, d.y) !== null;
    if (vertical) {
      for (let yy = y + 3; yy < y + t; yy += 6) ctx.fillRect(x, yy, t, 1);
    } else {
      for (let xx = x + 3; xx < x + t; xx += 6) ctx.fillRect(xx, y, 1, t);
    }
    ctx.fillStyle = INK;
    if (vertical) {
      ctx.fillRect(x, y, t, 1);
      ctx.fillRect(x, y + t - 1, t, 1);
    } else {
      ctx.fillRect(x, y, 1, t);
      ctx.fillRect(x + t - 1, y, 1, t);
    }
  }
}
