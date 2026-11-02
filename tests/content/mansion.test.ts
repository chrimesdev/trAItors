import { describe, expect, it } from 'vitest';
import mansion from '../../src/content/mansion.json';
import rooms from '../../src/content/rooms.json';
import npcs from '../../src/content/npcs.json';
import evidence from '../../src/content/evidence.json';
import { Layout } from '../../src/phaser/systems/layout';

const layout = new Layout(mansion);
const key = (a: string, b: string) => [a, b].sort().join('|');

describe('mansion layout', () => {
  it('has a layout rectangle for every room and nothing extra', () => {
    expect(mansion.rooms.map((r) => r.id).sort()).toEqual(rooms.map((r) => r.id).sort());
  });

  it('doors connect exactly the rooms rooms.json says are adjacent', () => {
    const fromDoors = new Set(layout.connections().map(([a, b]) => key(a, b)));
    const fromData = new Set(rooms.flatMap((r) => r.adjacent.map((other) => key(r.id, other))));
    expect([...fromDoors].sort()).toEqual([...fromData].sort());
  });

  it('adjacency in rooms.json is symmetric', () => {
    for (const r of rooms) {
      for (const other of r.adjacent) {
        expect(rooms.find((x) => x.id === other)?.adjacent, `${other} -> ${r.id}`).toContain(r.id);
      }
    }
  });

  it('rooms do not overlap and fit inside the outer wall', () => {
    const seen = new Set<string>();
    for (const r of mansion.rooms) {
      expect(r.x).toBeGreaterThan(0);
      expect(r.y).toBeGreaterThan(0);
      expect(r.x + r.w).toBeLessThan(mansion.cols);
      expect(r.y + r.h).toBeLessThan(mansion.rows);
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) {
          expect(seen.has(`${x},${y}`), `${r.id} overlaps at ${x},${y}`).toBe(false);
          seen.add(`${x},${y}`);
        }
    }
  });

  it('every door tile is a wall position between two rooms', () => {
    for (const d of mansion.doors) expect(layout.roomAt(d.x, d.y)).toBeNull();
  });
});

describe('content references', () => {
  const roomIds = new Set(rooms.map((r) => r.id));

  it('NPC schedules only use real rooms', () => {
    for (const n of npcs) for (const r of n.schedule) expect(roomIds.has(r), `${n.id}: ${r}`).toBe(true);
  });

  it('evidence starts in real rooms and belongs to real NPCs', () => {
    const npcIds = new Set(npcs.map((n) => n.id));
    for (const e of evidence) {
      expect(roomIds.has(e.room)).toBe(true);
      if (e.belongsTo !== null) expect(npcIds.has(e.belongsTo)).toBe(true);
    }
  });
});
