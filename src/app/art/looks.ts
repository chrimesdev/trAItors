/**
 * Character art as data (M6). Each character is a list of simple shapes in a small
 * coordinate space, so the same look draws the walking sprite on the Phaser canvas
 * and the portrait as inline SVG in the DOM. No image files: the build stays tiny.
 */
import { ARCHETYPE_COLOUR, PLAYER_COLOUR, cssColour } from '../palette';
import type { Archetype, Id } from '../../sim';

export type HairStyle = 'short' | 'long' | 'bun' | 'bald' | 'curly' | 'slick' | 'hood';
export type Accessory = 'glasses' | 'hat' | 'beard' | 'earrings' | 'scarf' | 'bowtie';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  /** Clothes. Defaults to the archetype colour. */
  body: string;
  accessory?: Accessory;
}

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: string; r?: number }
  | { kind: 'circle'; x: number; y: number; r: number; fill: string; stroke?: string }
  | { kind: 'ellipse'; x: number; y: number; rx: number; ry: number; fill: string };

const INK = '#1a1a2e';
const OUTLINE = 'rgba(14, 14, 26, 0.9)';

function look(archetype: Archetype, partial: Omit<Look, 'body'> & { body?: string }): Look {
  return { body: cssColour(ARCHETYPE_COLOUR[archetype]), ...partial };
}

/** One look per shipped character. Unknown ids fall back to a plain grey figure. */
export const LOOKS: Record<Id, Look> = {
  player: { skin: '#e2b48c', hair: '#2b1b17', hairStyle: 'hood', body: cssColour(PLAYER_COLOUR) },
  marcus: look('detective', { skin: '#c68642', hair: '#d9d4c7', hairStyle: 'short', accessory: 'glasses' }),
  priya: look('sheep', { skin: '#8d5524', hair: '#1c1210', hairStyle: 'long', accessory: 'earrings' }),
  dalton: look('loyalist', { skin: '#f1c27d', hair: '#5a3a1e', hairStyle: 'bald', accessory: 'beard' }),
  imogen: look('grudge', { skin: '#ffdbac', hair: '#b3341f', hairStyle: 'curly' }),
  theo: look('paranoid', { skin: '#e0ac69', hair: '#4a2c17', hairStyle: 'slick', accessory: 'scarf' }),
  rosa: look('detective', { skin: '#a86a3d', hair: '#2d1b12', hairStyle: 'bun', accessory: 'hat' }),
};

export const FALLBACK_LOOK: Look = { skin: '#d8b89a', hair: '#333', hairStyle: 'short', body: '#888888' };

export function lookOf(id: Id): Look {
  return LOOKS[id] ?? FALLBACK_LOOK;
}

/** Sprite frame size for `figure`. */
export const FIGURE = { w: 16, h: 24 } as const;

function hair(l: Look, cx: number, cy: number, r: number, out: Shape[]): void {
  const f = l.hair;
  switch (l.hairStyle) {
    case 'short':
      out.push({ kind: 'rect', x: cx - r, y: cy - r, w: r * 2, h: r * 0.9, fill: f, r: r * 0.6 });
      break;
    case 'slick':
      out.push({ kind: 'rect', x: cx - r, y: cy - r - 1, w: r * 2, h: r * 0.7, fill: f, r: 1 });
      break;
    case 'long':
      out.push({ kind: 'rect', x: cx - r - 1, y: cy - r, w: r * 2 + 2, h: r * 2.6, fill: f, r: r * 0.5 });
      break;
    case 'bun':
      out.push({ kind: 'rect', x: cx - r, y: cy - r, w: r * 2, h: r * 0.8, fill: f, r: r * 0.6 });
      out.push({ kind: 'circle', x: cx, y: cy - r - 1, r: r * 0.45, fill: f });
      break;
    case 'curly':
      for (const dx of [-0.9, -0.3, 0.3, 0.9]) {
        out.push({ kind: 'circle', x: cx + dx * r, y: cy - r * 0.85, r: r * 0.5, fill: f });
      }
      out.push({ kind: 'circle', x: cx - r * 1.05, y: cy, r: r * 0.45, fill: f });
      out.push({ kind: 'circle', x: cx + r * 1.05, y: cy, r: r * 0.45, fill: f });
      break;
    case 'hood':
      out.push({ kind: 'circle', x: cx, y: cy - r * 0.15, r: r * 1.3, fill: l.body });
      break;
    case 'bald':
      break;
  }
}

function accessory(l: Look, cx: number, cy: number, r: number, out: Shape[]): void {
  switch (l.accessory) {
    case 'glasses':
      out.push({
        kind: 'circle',
        x: cx - r * 0.45,
        y: cy,
        r: r * 0.32,
        fill: 'rgba(255,255,255,0.15)',
        stroke: INK,
      });
      out.push({
        kind: 'circle',
        x: cx + r * 0.45,
        y: cy,
        r: r * 0.32,
        fill: 'rgba(255,255,255,0.15)',
        stroke: INK,
      });
      break;
    case 'hat':
      out.push({ kind: 'rect', x: cx - r * 1.3, y: cy - r * 0.95, w: r * 2.6, h: r * 0.3, fill: INK, r: 1 });
      out.push({ kind: 'rect', x: cx - r * 0.75, y: cy - r * 1.7, w: r * 1.5, h: r * 0.9, fill: INK, r: 1 });
      break;
    case 'beard':
      out.push({
        kind: 'rect',
        x: cx - r * 0.7,
        y: cy + r * 0.35,
        w: r * 1.4,
        h: r * 0.8,
        fill: l.hair,
        r: r * 0.4,
      });
      break;
    case 'earrings':
      out.push({ kind: 'circle', x: cx - r * 1.05, y: cy + r * 0.35, r: r * 0.14, fill: '#f5d76e' });
      out.push({ kind: 'circle', x: cx + r * 1.05, y: cy + r * 0.35, r: r * 0.14, fill: '#f5d76e' });
      break;
    case 'scarf':
      out.push({
        kind: 'rect',
        x: cx - r * 0.9,
        y: cy + r * 0.85,
        w: r * 1.8,
        h: r * 0.5,
        fill: '#8f2d3a',
        r: 1,
      });
      break;
    case 'bowtie':
      out.push({
        kind: 'rect',
        x: cx - r * 0.6,
        y: cy + r * 0.95,
        w: r * 1.2,
        h: r * 0.4,
        fill: '#8f2d3a',
        r: 1,
      });
      break;
  }
}

/**
 * A full figure in a 16×24 box, facing the viewer. Frame 0 stands; frame 1 steps.
 * Drawn back to front, so later shapes overlap earlier ones.
 */
export function figure(l: Look, frame: 0 | 1): Shape[] {
  const out: Shape[] = [];
  const step = frame === 1 ? 1 : 0;
  // legs
  out.push({ kind: 'rect', x: 5, y: 18 - step, w: 3, h: 5, fill: INK });
  out.push({ kind: 'rect', x: 8, y: 18 + step - 1, w: 3, h: 5, fill: INK });
  // body
  out.push({ kind: 'rect', x: 3, y: 11, w: 10, h: 8, fill: l.body, r: 2 });
  // head
  const cx = 8;
  const cy = 7;
  const r = 4.5;
  out.push({ kind: 'circle', x: cx, y: cy, r, fill: l.skin, stroke: OUTLINE });
  if (l.hairStyle === 'hood') {
    // Hood behind the face: draw it first, then the face again on top.
    out.splice(out.length - 1, 0, ...hairShapes(l, cx, cy, r));
  } else {
    out.push(...hairShapes(l, cx, cy, r));
  }
  out.push({ kind: 'rect', x: 6, y: 7, w: 1.2, h: 1.2, fill: INK });
  out.push({ kind: 'rect', x: 9, y: 7, w: 1.2, h: 1.2, fill: INK });
  accessory(l, cx, cy, r, out);
  return out;
}

function hairShapes(l: Look, cx: number, cy: number, r: number): Shape[] {
  const out: Shape[] = [];
  hair(l, cx, cy, r, out);
  return out;
}

/** Portrait frame size for `bust`. */
export const BUST = { w: 32, h: 32 } as const;

/** Head and shoulders in a 32×32 box, for portraits. */
export function bust(l: Look): Shape[] {
  const out: Shape[] = [];
  const cx = 16;
  const cy = 14;
  const r = 8;
  // shoulders
  out.push({ kind: 'rect', x: 4, y: 24, w: 24, h: 12, fill: l.body, r: 5 });
  if (l.hairStyle === 'hood') out.push(...hairShapes(l, cx, cy, r));
  out.push({ kind: 'circle', x: cx, y: cy, r, fill: l.skin, stroke: OUTLINE });
  if (l.hairStyle !== 'hood') out.push(...hairShapes(l, cx, cy, r));
  // eyes and mouth
  out.push({ kind: 'rect', x: cx - 3.5, y: cy - 0.5, w: 2, h: 2, fill: INK, r: 0.5 });
  out.push({ kind: 'rect', x: cx + 1.5, y: cy - 0.5, w: 2, h: 2, fill: INK, r: 0.5 });
  out.push({ kind: 'rect', x: cx - 1.5, y: cy + 4, w: 3, h: 1, fill: 'rgba(26,26,46,0.6)' });
  accessory(l, cx, cy, r, out);
  return out;
}
