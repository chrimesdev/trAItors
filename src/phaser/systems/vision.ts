/**
 * Sight-cone geometry. Pure TypeScript (no Phaser) so it can be unit tested.
 * Cones are clipped to the NPC's room rectangle: nobody sees through walls.
 */
import type { Point } from './layout';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Smallest signed difference between two angles, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function inRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function inCone(
  origin: Point,
  facing: number,
  target: Point,
  halfAngle: number,
  range: number,
  room?: Rect,
): boolean {
  if (room && !inRect(target, room)) return false;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist === 0) return true;
  return Math.abs(angleDiff(Math.atan2(dy, dx), facing)) <= halfAngle;
}

/** Distance from `origin` (inside `r`) along `angle` to the rectangle's edge. */
export function distanceToEdge(origin: Point, angle: number, r: Rect): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tx = dx > 0 ? (r.x + r.w - origin.x) / dx : dx < 0 ? (r.x - origin.x) / dx : Infinity;
  const ty = dy > 0 ? (r.y + r.h - origin.y) / dy : dy < 0 ? (r.y - origin.y) / dy : Infinity;
  return Math.max(0, Math.min(tx, ty));
}

/** Polygon points for drawing a cone, clipped to the room. First point is the origin. */
export function conePolygon(
  origin: Point,
  facing: number,
  halfAngle: number,
  range: number,
  room: Rect,
  segments = 16,
): Point[] {
  const pts: Point[] = [{ ...origin }];
  for (let i = 0; i <= segments; i++) {
    const a = facing - halfAngle + (2 * halfAngle * i) / segments;
    const d = Math.min(range, distanceToEdge(origin, a, room));
    pts.push({ x: origin.x + Math.cos(a) * d, y: origin.y + Math.sin(a) * d });
  }
  return pts;
}

/**
 * Where an NPC is looking at time `ms`: a slow sweep either side of `base`,
 * with a pause at each end so the player can time a dash.
 */
export function sweepFacing(
  ms: number,
  base: number,
  sweep: number,
  periodMs: number,
  phase: number,
): number {
  const t = (((ms / periodMs + phase) % 1) + 1) % 1;
  // Smoothstep-ish: hold at the extremes, move through the middle.
  const s = Math.sin(t * Math.PI * 2);
  const eased = Math.sign(s) * Math.min(1, Math.abs(s) * 1.4);
  return base + eased * sweep;
}
