import { describe, expect, it } from 'vitest';
import { defaultContent } from '../../src/content';
import { shapesToSvg } from '../../src/app/art/draw';
import { BUST, FIGURE, LOOKS, bust, figure, lookOf } from '../../src/app/art/looks';

describe('character looks', () => {
  it('every shipped character and the player has a look', () => {
    for (const npc of defaultContent.npcs) expect(LOOKS[npc.id], npc.id).toBeDefined();
    expect(LOOKS.player).toBeDefined();
  });

  it('figures and busts stay inside their frames', () => {
    for (const id of [...Object.keys(LOOKS), 'nobody']) {
      const l = lookOf(id);
      for (const frame of [0, 1] as const) {
        for (const s of figure(l, frame)) {
          const [x0, y0, x1, y1] =
            s.kind === 'rect'
              ? [s.x, s.y, s.x + s.w, s.y + s.h]
              : s.kind === 'circle'
                ? [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r]
                : [s.x - s.rx, s.y - s.ry, s.x + s.rx, s.y + s.ry];
          expect(x0, id).toBeGreaterThanOrEqual(-1);
          expect(y0, id).toBeGreaterThanOrEqual(-1);
          expect(x1, id).toBeLessThanOrEqual(FIGURE.w + 1);
          expect(y1, id).toBeLessThanOrEqual(FIGURE.h + 1);
        }
      }
      expect(bust(l).length).toBeGreaterThan(3);
    }
  });

  it('renders a portrait as inline SVG', () => {
    const svg = shapesToSvg(bust(lookOf('marcus')), BUST.w, BUST.h);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<circle');
  });
});
