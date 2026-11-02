import { describe, expect, it } from 'vitest';
import {
  angleDiff,
  conePolygon,
  distanceToEdge,
  glanceWeight,
  inCone,
  sweepFacing,
} from '../../src/phaser/systems/vision';

const room = { x: 0, y: 0, w: 100, h: 100 };
const deg = (d: number) => (d * Math.PI) / 180;

describe('vision geometry', () => {
  it('angleDiff wraps around', () => {
    expect(angleDiff(deg(350), deg(10))).toBeCloseTo(deg(-20));
    expect(angleDiff(deg(10), deg(350))).toBeCloseTo(deg(20));
  });

  it('sees a target straight ahead within range', () => {
    expect(inCone({ x: 50, y: 50 }, 0, { x: 80, y: 50 }, deg(30), 40)).toBe(true);
  });

  it('does not see behind, beside, or beyond range', () => {
    const o = { x: 50, y: 50 };
    expect(inCone(o, 0, { x: 20, y: 50 }, deg(30), 40)).toBe(false);
    expect(inCone(o, 0, { x: 50, y: 80 }, deg(30), 40)).toBe(false);
    expect(inCone(o, 0, { x: 95, y: 50 }, deg(30), 40)).toBe(false);
  });

  it('does not see outside its room', () => {
    expect(inCone({ x: 90, y: 50 }, 0, { x: 110, y: 50 }, deg(30), 40, room)).toBe(false);
  });

  it('distanceToEdge measures to the wall in the facing direction', () => {
    expect(distanceToEdge({ x: 50, y: 50 }, 0, room)).toBeCloseTo(50);
    expect(distanceToEdge({ x: 50, y: 20 }, -Math.PI / 2, room)).toBeCloseTo(20);
  });

  it('cone polygons never leave the room', () => {
    const pts = conePolygon({ x: 90, y: 50 }, 0, deg(30), 200, room);
    for (const p of pts) {
      expect(p.x).toBeLessThanOrEqual(100.0001);
      expect(p.y).toBeGreaterThanOrEqual(-0.0001);
      expect(p.y).toBeLessThanOrEqual(100.0001);
    }
  });

  it('sweepFacing stays within the sweep either side of base', () => {
    for (let ms = 0; ms < 10000; ms += 137) {
      const f = sweepFacing(ms, 1, 0.5, 4000, 0.3);
      expect(f).toBeGreaterThanOrEqual(0.5 - 1e-9);
      expect(f).toBeLessThanOrEqual(1.5 + 1e-9);
    }
  });

  it('glanceWeight holds a full look once per period and is zero in between', () => {
    expect(glanceWeight(0, 4000, 800, 0)).toBe(0);
    expect(glanceWeight(400, 4000, 800, 0)).toBe(1);
    expect(glanceWeight(2000, 4000, 800, 0)).toBe(0);
    expect(glanceWeight(4400, 4000, 800, 0)).toBe(1);
    expect(glanceWeight(90, 4000, 800, 0, 180)).toBeCloseTo(0.5);
  });
});
