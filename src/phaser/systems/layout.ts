/**
 * Mansion layout helpers. Pure TypeScript (no Phaser import) so they can be unit tested.
 *
 * The map is a grid: wall tiles everywhere except room interiors and door tiles.
 * Placeholder for M2; M6 can swap in a Tiled map as long as it provides the same queries.
 */
export interface RoomRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MansionLayout {
  tileSize: number;
  cols: number;
  rows: number;
  rooms: RoomRect[];
  doors: { x: number; y: number }[];
}

export interface Point {
  x: number;
  y: number;
}

export const TILE = { WALL: 0, DOOR: 1, FLOOR0: 2 } as const;

export class Layout {
  private readonly roomGrid: (string | null)[][];
  private readonly doorSet: Set<string>;

  constructor(readonly def: MansionLayout) {
    this.roomGrid = Array.from({ length: def.rows }, () => Array<string | null>(def.cols).fill(null));
    for (const r of def.rooms) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          const row = this.roomGrid[y];
          if (row) row[x] = r.id;
        }
      }
    }
    this.doorSet = new Set(def.doors.map((d) => `${d.x},${d.y}`));
  }

  get tileSize(): number {
    return this.def.tileSize;
  }

  roomAt(tx: number, ty: number): string | null {
    return this.roomGrid[ty]?.[tx] ?? null;
  }

  isDoor(tx: number, ty: number): boolean {
    return this.doorSet.has(`${tx},${ty}`);
  }

  isWalkable(tx: number, ty: number): boolean {
    return this.roomAt(tx, ty) !== null || this.isDoor(tx, ty);
  }

  roomAtPixel(px: number, py: number): string | null {
    return this.roomAt(Math.floor(px / this.tileSize), Math.floor(py / this.tileSize));
  }

  rect(roomId: string): RoomRect {
    const r = this.def.rooms.find((x) => x.id === roomId);
    if (!r) throw new Error(`No layout for room "${roomId}"`);
    return r;
  }

  /** Room interior in pixels. */
  pixelRect(roomId: string): { x: number; y: number; w: number; h: number } {
    const r = this.rect(roomId);
    const t = this.tileSize;
    return { x: r.x * t, y: r.y * t, w: r.w * t, h: r.h * t };
  }

  centre(roomId: string): Point {
    const p = this.pixelRect(roomId);
    return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  }

  /** Tile indices for building a tilemap: wall, door, or a per-room floor colour. */
  tileData(): number[][] {
    const ids = this.def.rooms.map((r) => r.id);
    return this.roomGrid.map((row, y) =>
      row.map((room, x) => {
        if (room) return TILE.FLOOR0 + ids.indexOf(room);
        return this.isDoor(x, y) ? TILE.DOOR : TILE.WALL;
      }),
    );
  }

  /** Pairs of rooms joined by a door (each pair sorted, deduplicated). */
  connections(): [string, string][] {
    const pairs = new Set<string>();
    for (const { x, y } of this.def.doors) {
      const sides: [Point, Point][] = [
        [
          { x: x - 1, y },
          { x: x + 1, y },
        ],
        [
          { x, y: y - 1 },
          { x, y: y + 1 },
        ],
      ];
      for (const [a, b] of sides) {
        const ra = this.roomAt(a.x, a.y);
        const rb = this.roomAt(b.x, b.y);
        if (ra && rb && ra !== rb) pairs.add([ra, rb].sort().join('|'));
      }
    }
    return [...pairs].map((p) => p.split('|') as [string, string]);
  }

  /** Where NPC number `index` stands in a room (fractions of the room rect, kept clear of walls). */
  npcSpot(roomId: string, index: number): Point {
    const fractions = [
      [0.3, 0.35],
      [0.7, 0.65],
      [0.7, 0.35],
      [0.3, 0.65],
      [0.5, 0.25],
      [0.5, 0.75],
    ];
    const [fx, fy] = fractions[index % fractions.length] as [number, number];
    const p = this.pixelRect(roomId);
    return { x: p.x + p.w * fx, y: p.y + p.h * fy };
  }

  /** Where evidence item number `index` lies in a room (near the corners). */
  evidenceSpot(roomId: string, index: number): Point {
    const t = this.tileSize;
    const p = this.pixelRect(roomId);
    const corners: Point[] = [
      { x: p.x + t, y: p.y + t },
      { x: p.x + p.w - t, y: p.y + p.h - t },
      { x: p.x + p.w - t, y: p.y + t },
      { x: p.x + t, y: p.y + p.h - t },
    ];
    return corners[index % corners.length] as Point;
  }
}
