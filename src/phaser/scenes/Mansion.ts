import Phaser from 'phaser';
import type { GameStore } from '../../app/store';
import mansion from '../../content/mansion.json';
import { aliveOnly, type GameState, type Id } from '../view';
import { Layout, TILE, type Point } from '../systems/layout';
import { conePolygon, inCone, sweepFacing, type Rect } from '../systems/vision';

const WALK_SPEED = 120;
const SNEAK_FACTOR = 0.5;
const PLAYER_RADIUS = 7;
const NPC_RADIUS = 9;

const PALETTE = {
  wall: 0x0e0e1a,
  door: 0x3a2f2a,
  floors: [
    0x2c3b33, 0x3b2f3f, 0x30324a, 0x3a3346, 0x2f3a45, 0x3a3428, 0x3e2e2e, 0x33302a, 0x2a2a30, 0x3a3a32,
  ],
  player: 0xff4d6d,
  cone: 0xf5d76e,
  coneAlert: 0xff4d6d,
  label: '#8f8aa3',
};

/** NPC colours by archetype until real portraits arrive in M6. */
const NPC_COLOURS: Record<string, number> = {
  detective: 0x6ec1f5,
  sheep: 0xe8e2d0,
  loyalist: 0x7fd18b,
  grudge: 0xc58cf5,
  paranoid: 0xf5a46e,
};

export interface MansionCallbacks {
  /** True while a DOM menu has focus; the player can't move. */
  isUiBlocking(): boolean;
  /** E pressed: open the interaction menu for the current room. */
  openInteract(): void;
  onSneakChange(sneaking: boolean): void;
}

interface NpcView {
  body: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  cone: Phaser.GameObjects.Graphics;
  room: Id | null;
  pos: Point;
  base: number;
  phase: number;
  period: number;
  wasInCone: boolean;
}

/**
 * Renders GameState and turns player movement into engine commands.
 * Holds no game rules: crossing a door sends `move`, stepping into a cone sends `spotted`.
 */
export class MansionScene extends Phaser.Scene {
  private store!: GameStore;
  private ui!: MansionCallbacks;
  private layout!: Layout;
  private player!: Phaser.GameObjects.Arc;
  private body_!: Phaser.Physics.Arcade.Body;
  private npcs = new Map<Id, NpcView>();
  private evidence = new Map<Id, Phaser.GameObjects.Container>();
  private keys!: Record<
    'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'shift' | 'e',
    Phaser.Input.Keyboard.Key
  >;
  private sneaking = false;
  private unsubscribe?: () => void;

  constructor() {
    super('Mansion');
  }

  init(data: { store: GameStore; ui: MansionCallbacks }): void {
    this.store = data.store;
    this.ui = data.ui;
    this.layout = new Layout(mansion);
  }

  create(): void {
    this.buildMap();
    this.createPlayer();
    this.createKeys();

    this.unsubscribe = this.store.subscribe((s, prev) => this.sync(s, prev));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
    this.sync(this.store.state, null);
  }

  // ------------------------------------------------------------------ setup

  private buildMap(): void {
    const t = this.layout.tileSize;
    const floors = PALETTE.floors;
    const count = TILE.FLOOR0 + this.layout.def.rooms.length;

    const canvas = this.textures.createCanvas('tiles', t * count, t);
    const ctx = canvas?.getContext();
    if (!canvas || !ctx) throw new Error('Could not create tile texture');
    const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
    for (let i = 0; i < count; i++) {
      const colour =
        i === TILE.WALL
          ? PALETTE.wall
          : i === TILE.DOOR
            ? PALETTE.door
            : floors[(i - TILE.FLOOR0) % floors.length];
      ctx.fillStyle = hex(colour ?? PALETTE.wall);
      ctx.fillRect(i * t, 0, t, t);
      if (i >= TILE.FLOOR0) {
        // Faint grid so movement reads on a flat floor.
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.strokeRect(i * t + 0.5, 0.5, t - 1, t - 1);
      }
    }
    canvas.refresh();

    const map = this.make.tilemap({ data: this.layout.tileData(), tileWidth: t, tileHeight: t });
    const tileset = map.addTilesetImage('tiles', 'tiles', t, t, 0, 0);
    if (!tileset) throw new Error('Could not add tileset');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Could not create map layer');
    layer.setCollision([TILE.WALL]);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.data.set('layer', layer);

    const names = this.store.state.rooms;
    for (const r of this.layout.def.rooms) {
      this.add
        .text(r.x * t + 4, r.y * t + 2, (names[r.id]?.name ?? r.id).toUpperCase(), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '9px',
          color: PALETTE.label,
        })
        .setDepth(1);
    }
  }

  private createPlayer(): void {
    const start = this.layout.centre(this.store.state.startRoom);
    this.player = this.add.circle(start.x, start.y, PLAYER_RADIUS, PALETTE.player).setDepth(10);
    this.player.setStrokeStyle(2, 0xffffff, 0.8);
    this.physics.add.existing(this.player);
    this.body_ = this.player.body as Phaser.Physics.Arcade.Body;
    this.body_.setCircle(PLAYER_RADIUS);
    this.body_.setCollideWorldBounds(true);
    const layer = this.data.get('layer') as Phaser.Tilemaps.TilemapLayer;
    this.physics.add.collider(this.player, layer);
  }

  private createKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) throw new Error('Keyboard input unavailable');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP),
      down: kb.addKey(K.DOWN),
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W),
      a: kb.addKey(K.A),
      s: kb.addKey(K.S),
      d: kb.addKey(K.D),
      shift: kb.addKey(K.SHIFT),
      e: kb.addKey(K.E),
    };
    this.keys.e.on('down', () => {
      if (!this.ui.isUiBlocking() && this.store.state.phase === 'day') this.ui.openInteract();
    });
  }

  // ------------------------------------------------------------------ state -> view

  private sync(s: GameState, prev: GameState | null): void {
    // New day (or new game): the engine put the player back in the start room.
    const roomUnderPlayer = this.layout.roomAtPixel(this.player.x, this.player.y);
    if (!prev || s.day !== prev.day || (roomUnderPlayer && roomUnderPlayer !== s.player.room)) {
      const c = this.layout.centre(s.player.room);
      this.player.setPosition(c.x, c.y);
      this.body_.reset(c.x, c.y);
    }
    this.syncNpcs(s, prev === null);
    this.syncEvidence(s);
  }

  private syncNpcs(s: GameState, instant: boolean): void {
    const ids = Object.keys(s.npcs);
    ids.forEach((id, index) => {
      const npc = s.npcs[id];
      if (!npc) return;
      let view = this.npcs.get(id);
      if (!view) view = this.createNpcView(id, npc.name, npc.archetype, index);

      if (!npc.alive) {
        this.tweens.killTweensOf([view.body, view.label, view.cone]);
        view.body.setVisible(false);
        view.label.setVisible(false);
        view.cone.setVisible(false);
        view.room = null;
        return;
      }
      const room = npc.schedule[Math.min(s.tick, s.balance.day.ticksPerDay - 1)] ?? null;
      if (!room || room === view.room) return;

      const to = this.layout.npcSpot(room, index);
      const centre = this.layout.centre(room);
      view.room = room;
      view.base = Math.atan2(centre.y - to.y, centre.x - to.x);
      view.wasInCone = false;

      // Fade out, move, fade in: NPCs don't path-find in M2. Several ticks can pass in one
      // update (e.g. "end day"), so cancel any fade in flight and always land on the latest spot.
      const parts = [view.body, view.label, view.cone];
      this.tweens.killTweensOf(parts);
      if (instant) {
        for (const p of parts) p.setAlpha(1);
        this.placeNpc(view, to);
        return;
      }
      this.tweens.add({
        targets: parts,
        alpha: 0,
        duration: 160,
        onComplete: () => {
          this.placeNpc(view, to);
          this.tweens.add({ targets: parts, alpha: 1, duration: 200 });
        },
      });
    });
  }

  private createNpcView(id: Id, name: string, archetype: string, index: number): NpcView {
    const colour = NPC_COLOURS[archetype] ?? 0xcccccc;
    const body = this.add.circle(0, 0, NPC_RADIUS, colour).setDepth(9).setStrokeStyle(2, 0x1a1a2e);
    const label = this.add
      .text(0, 0, name, { fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#f3f1ee' })
      .setOrigin(0.5, 0)
      .setDepth(11);
    const cone = this.add.graphics().setDepth(5);
    const view: NpcView = {
      body,
      label,
      cone,
      room: null,
      pos: { x: 0, y: 0 },
      base: 0,
      phase: (index * 0.37) % 1,
      period: 4200 + index * 450,
      wasInCone: false,
    };
    this.npcs.set(id, view);
    return view;
  }

  private placeNpc(view: NpcView, at: Point): void {
    view.pos = at;
    view.body.setPosition(at.x, at.y).setVisible(true);
    view.label.setPosition(at.x, at.y + NPC_RADIUS + 1).setVisible(true);
    view.cone.setVisible(true);
  }

  private syncEvidence(s: GameState): void {
    const items = Object.values(s.evidence);
    items.forEach((ev, index) => {
      let view = this.evidence.get(ev.id);
      const inRoom = Boolean(s.rooms[ev.location]);
      if (!inRoom) {
        view?.setVisible(false);
        return;
      }
      if (!view) {
        const box = this.add.rectangle(0, 0, 10, 10, 0xf3f1ee).setStrokeStyle(1, 0x1a1a2e);
        const text = this.add
          .text(0, 8, ev.name, { fontFamily: 'system-ui, sans-serif', fontSize: '8px', color: '#c9b6bb' })
          .setOrigin(0.5, 0);
        view = this.add.container(0, 0, [box, text]).setDepth(4);
        this.evidence.set(ev.id, view);
      }
      const at = this.layout.evidenceSpot(ev.location, index);
      view.setPosition(at.x, at.y).setVisible(true);
      (view.list[0] as Phaser.GameObjects.Rectangle).setFillStyle(ev.plantedBy ? 0xff4d6d : 0xf3f1ee);
    });
  }

  // ------------------------------------------------------------------ per frame

  /** NPCs in the player's room whose cone covers the player right now. */
  visibleTo(): Id[] {
    const s = this.store.state;
    const out: Id[] = [];
    for (const [id, v] of this.npcs) {
      if (v.room === s.player.room && s.npcs[id]?.alive && this.coversPlayer(v)) out.push(id);
    }
    return out;
  }

  private coneParams(): { half: number; range: number } {
    const d = this.store.state.balance.detection;
    return { half: ((d.coneDegrees / 2) * Math.PI) / 180, range: d.coneRangeTiles * this.layout.tileSize };
  }

  private facing(v: NpcView): number {
    return sweepFacing(this.time.now, v.base, 1.2, v.period, v.phase);
  }

  private coversPlayer(v: NpcView): boolean {
    if (!v.room) return false;
    const { half, range } = this.coneParams();
    return inCone(
      v.pos,
      this.facing(v),
      { x: this.player.x, y: this.player.y },
      half,
      range,
      this.layout.pixelRect(v.room),
    );
  }

  override update(): void {
    const s = this.store.state;
    const k = this.keys;
    const blocked = this.ui.isUiBlocking() || s.phase !== 'day';

    const sneaking = k.shift.isDown;
    if (sneaking !== this.sneaking) {
      this.sneaking = sneaking;
      this.player.setAlpha(sneaking ? 0.45 : 1);
      this.ui.onSneakChange(sneaking);
    }

    let vx = 0;
    let vy = 0;
    if (!blocked) {
      vx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
      vy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    }
    const len = Math.hypot(vx, vy) || 1;
    const speed = WALK_SPEED * (sneaking ? SNEAK_FACTOR : 1);
    this.body_.setVelocity((vx / len) * speed, (vy / len) * speed);

    if (!blocked) this.checkRoomChange();
    this.drawCones(blocked);
  }

  private checkRoomChange(): void {
    const s = this.store.state;
    const room = this.layout.roomAtPixel(this.player.x, this.player.y);
    if (!room || room === s.player.room) return;
    // Entering a new room costs an action. Who sees you depends on where they're looking right now.
    const visibleTo = aliveOnly(
      s,
      [...this.npcs.entries()].filter(([, v]) => v.room === room && this.coversPlayer(v)).map(([id]) => id),
    );
    const ok = this.store.dispatch({ type: 'move', to: room, sneaking: this.sneaking, visibleTo });
    if (!ok) {
      const back = this.layout.centre(s.player.room);
      this.player.setPosition(back.x, back.y);
      this.body_.reset(back.x, back.y);
    }
  }

  private drawCones(frozen: boolean): void {
    const s = this.store.state;
    const { half, range } = this.coneParams();
    for (const [id, v] of this.npcs) {
      v.cone.clear();
      if (!v.room || !s.npcs[id]?.alive) continue;
      const rect: Rect = this.layout.pixelRect(v.room);
      const facing = this.facing(v);
      const covering = v.room === s.player.room && this.coversPlayer(v);

      // Stepping into a cone is a free detection check by the engine.
      if (covering && !v.wasInCone && !frozen && s.phase === 'day') {
        this.store.dispatch({ type: 'spotted', npc: id, sneaking: this.sneaking });
      }
      v.wasInCone = covering;

      const pts = conePolygon(v.pos, facing, half, range, rect);
      v.cone.fillStyle(covering ? PALETTE.coneAlert : PALETTE.cone, covering ? 0.28 : 0.12);
      v.cone.fillPoints(
        pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
        true,
      );
    }
  }
}
