import Phaser from 'phaser';
import type { GameStore } from '../../app/store';
import { rumourText, watchingYou, whispersSince, type Rumour } from '../../sim';
import mansion from '../../content/mansion.json';
import { aliveOnly, type GameState, type Id } from '../view';
import { drawShapes } from '../../app/art/draw';
import { audio } from '../../app/audio';
import { FIGURE, figure, lookOf } from '../../app/art/looks';
import { Layout, TILE, type Point } from '../systems/layout';
import { ITEM, drawItem } from '../systems/items';
import { paintMansion } from '../systems/paint';
import { angleDiff, conePolygon, glanceWeight, inCone, sweepFacing, type Rect } from '../systems/vision';

const WALK_SPEED = 120;
const SNEAK_FACTOR = 0.5;
const PLAYER_RADIUS = 6;
const NPC_RADIUS = 9;
const FIGURE_SCALE = 1.25;
// Tells: a wary NPC turns to look straight at you this often, for this long.
const GLANCE_PERIOD_MS = 3600;
const GLANCE_HOLD_MS = 900;
const WHISPER_MS = 2800;
const STEP_MS = 300;

const PALETTE = {
  cone: 0xf5d76e,
  coneAlert: 0xff4d6d,
  label: '#8f8aa3',
  name: '#f3f1ee',
  nameWary: '#ff4d6d',
  whisper: '#f5d76e',
  whisperAboutYou: '#ff4d6d',
};

export interface MansionCallbacks {
  /** True while a DOM menu has focus; the player can't move. */
  isUiBlocking(): boolean;
  /** E pressed: open the interaction menu for the current room. */
  openInteract(): void;
  onSneakChange(sneaking: boolean): void;
  /** A DOM panel opened or closed. */
  onUiChange?(): void;
}

interface NpcView {
  body: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  cone: Phaser.GameObjects.Graphics;
  room: Id | null;
  pos: Point;
  base: number;
  phase: number;
  period: number;
  wasInCone: boolean;
  /** Suspects the player enough to watch them while they share a room. */
  wary: boolean;
}

/**
 * Renders GameState and turns player movement into engine commands.
 * Holds no game rules: crossing a door sends `move`, stepping into a cone sends `spotted`.
 */
export class MansionScene extends Phaser.Scene {
  private store!: GameStore;
  private ui!: MansionCallbacks;
  private layout!: Layout;
  private player!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private body_!: Phaser.Physics.Arcade.Body;
  private npcs = new Map<Id, NpcView>();
  private evidence = new Map<Id, Phaser.GameObjects.Container>();
  private keys!: Record<
    'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'shift' | 'e',
    Phaser.Input.Keyboard.Key
  >;
  private sneaking = false;
  private wasBlocked = false;
  private nextStepAt = 0;
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
    const count = TILE.FLOOR0 + this.layout.def.rooms.length;

    // The tilemap only provides wall collision; what you see is painted below.
    const tiles = this.textures.createCanvas('tiles', t * count, t);
    if (!tiles) throw new Error('Could not create tile texture');
    tiles.refresh();
    const map = this.make.tilemap({ data: this.layout.tileData(), tileWidth: t, tileHeight: t });
    const tileset = map.addTilesetImage('tiles', 'tiles', t, t, 0, 0);
    if (!tileset) throw new Error('Could not add tileset');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Could not create map layer');
    layer.setCollision([TILE.WALL]).setVisible(false);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.data.set('layer', layer);

    const art = this.textures.createCanvas('mansion', map.widthInPixels, map.heightInPixels);
    const ctx = art?.getContext();
    if (!art || !ctx) throw new Error('Could not create mansion texture');
    paintMansion(ctx, this.layout);
    art.refresh();
    this.add.image(0, 0, 'mansion').setOrigin(0).setDepth(0);

    const names = this.store.state.rooms;
    for (const r of this.layout.def.rooms) {
      // Name plates sit on the wall above each room, clear of the furniture.
      this.add
        .text(r.x * t + 4, r.y * t - 12, (names[r.id]?.name ?? r.id).toUpperCase(), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '9px',
          color: PALETTE.label,
        })
        .setDepth(1);
    }
  }

  private itemTexture(id: string): string {
    const key = `item-${id}`;
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, ITEM.w, ITEM.h);
    const ctx = tex?.getContext();
    if (!tex || !ctx) throw new Error('Could not create item texture');
    drawItem(ctx, id);
    tex.refresh();
    return key;
  }

  /** A two-frame walking sprite sheet drawn from the character's look. */
  private characterSheet(id: string): string {
    const key = `char-${id}`;
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, FIGURE.w * 2, FIGURE.h);
    const ctx = tex?.getContext();
    if (!tex || !ctx) throw new Error('Could not create character texture');
    const look = lookOf(id);
    drawShapes(ctx, figure(look, 0), 0, 0);
    drawShapes(ctx, figure(look, 1), FIGURE.w, 0);
    tex.add('f0', 0, 0, 0, FIGURE.w, FIGURE.h);
    tex.add('f1', 0, FIGURE.w, 0, FIGURE.w, FIGURE.h);
    tex.refresh();
    this.anims.create({
      key: `walk-${id}`,
      frames: [
        { key, frame: 'f0' },
        { key, frame: 'f1' },
      ],
      frameRate: 6,
      repeat: -1,
    });
    return key;
  }

  private createPlayer(): void {
    const start = this.layout.centre(this.store.state.startRoom);
    const key = this.characterSheet('player');
    this.playerShadow = this.add.ellipse(start.x, start.y + 12, 16, 6, 0x000000, 0.35).setDepth(8);
    this.player = this.add.sprite(start.x, start.y, key, 'f0').setScale(FIGURE_SCALE).setDepth(10);
    this.physics.add.existing(this.player);
    this.body_ = this.player.body as Phaser.Physics.Arcade.Body;
    // Collide with the feet, not the head, so the figure can stand close to walls.
    this.body_.setCircle(PLAYER_RADIUS, FIGURE.w / 2 - PLAYER_RADIUS, FIGURE.h - PLAYER_RADIUS * 2 - 1);
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
    // Rumours were traded before anyone moved on, so show them where the NPCs still stand.
    if (prev && s.seed === prev.seed) this.showWhispers(s, whispersSince(s, prev.nextRumourId));
    this.syncNpcs(s, prev === null);
    this.syncEvidence(s);
  }

  private syncNpcs(s: GameState, instant: boolean): void {
    const ids = Object.keys(s.npcs);
    const watching = new Set(watchingYou(s));
    ids.forEach((id, index) => {
      const npc = s.npcs[id];
      if (!npc) return;
      let view = this.npcs.get(id);
      if (!view) view = this.createNpcView(id, npc.name, npc.archetype, index);
      view.wary = watching.has(id);
      view.label.setColor(view.wary ? PALETTE.nameWary : PALETTE.name);

      if (!npc.alive) {
        this.tweens.killTweensOf([view.body, view.shadow, view.label, view.cone]);
        view.body.setVisible(false);
        view.shadow.setVisible(false);
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
      const parts = [view.body, view.shadow, view.label, view.cone];
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

  private createNpcView(id: Id, name: string, _archetype: string, index: number): NpcView {
    const shadow = this.add.ellipse(0, 0, 16, 6, 0x000000, 0.35).setDepth(8);
    const body = this.add.sprite(0, 0, this.characterSheet(id), 'f0').setScale(FIGURE_SCALE).setDepth(9);
    const label = this.add
      .text(0, 0, name, { fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#f3f1ee' })
      .setOrigin(0.5, 0)
      .setDepth(11);
    const cone = this.add.graphics().setDepth(5);
    const view: NpcView = {
      body,
      shadow,
      label,
      cone,
      room: null,
      pos: { x: 0, y: 0 },
      base: 0,
      phase: (index * 0.37) % 1,
      period: 4200 + index * 450,
      wasInCone: false,
      wary: false,
    };
    this.npcs.set(id, view);
    return view;
  }

  private placeNpc(view: NpcView, at: Point): void {
    view.pos = at;
    view.body.setPosition(at.x, at.y).setVisible(true);
    view.shadow.setPosition(at.x, at.y + 12).setVisible(true);
    view.label.setPosition(at.x, at.y + NPC_RADIUS + 6).setVisible(true);
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
        const ring = this.add.circle(0, 0, 12, 0xff4d6d, 0.22);
        const icon = this.add.image(0, 0, this.itemTexture(ev.id)).setScale(1.25);
        const text = this.add
          .text(0, 11, ev.name, { fontFamily: 'system-ui, sans-serif', fontSize: '8px', color: '#c9b6bb' })
          .setOrigin(0.5, 0);
        view = this.add.container(0, 0, [ring, icon, text]).setDepth(4);
        this.evidence.set(ev.id, view);
      }
      const at = this.layout.evidenceSpot(ev.location, index);
      view.setPosition(at.x, at.y).setVisible(true);
      (view.list[0] as Phaser.GameObjects.Arc).setVisible(Boolean(ev.plantedBy));
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

  /** Where the NPC is looking: the usual sweep, interrupted by a hard look at you if they're wary. */
  private facing(v: NpcView): number {
    const sweep = sweepFacing(this.time.now, v.base, 1.2, v.period, v.phase);
    if (!v.wary) return sweep;
    const w = glanceWeight(this.time.now, GLANCE_PERIOD_MS, GLANCE_HOLD_MS, v.phase);
    if (w <= 0) return sweep;
    const atPlayer = Math.atan2(this.player.y - v.pos.y, this.player.x - v.pos.x);
    return sweep + angleDiff(atPlayer, sweep) * w;
  }

  /** Rumours passed between NPCs float up as whispered text between the two of them. */
  private showWhispers(s: GameState, whispers: Rumour[]): void {
    const bounds = this.physics.world.bounds;
    whispers.forEach((r, i) => {
      const a = this.npcs.get(r.teller);
      const b = this.npcs.get(r.holder);
      if (!a?.room || !b?.room) return;
      const x = Phaser.Math.Clamp((a.pos.x + b.pos.x) / 2, 70, bounds.width - 70);
      const y = (a.pos.y + b.pos.y) / 2 - NPC_RADIUS - 4 - (i % 3) * 12;
      const aboutYou = r.target === 'player';
      const text = this.add
        .text(x, y, `“${rumourText(s, r)}…”`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '9px',
          fontStyle: 'italic',
          color: aboutYou ? PALETTE.whisperAboutYou : PALETTE.whisper,
          backgroundColor: 'rgba(14, 14, 26, 0.8)',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 1)
        .setDepth(20)
        .setAlpha(0);
      const delay = Math.floor(i / 3) * 500;
      this.tweens.add({ targets: text, alpha: 1, duration: 250, delay });
      this.tweens.add({ targets: text, y: y - 16, duration: WHISPER_MS, delay, ease: 'Sine.easeOut' });
      this.tweens.add({
        targets: text,
        alpha: 0,
        duration: 600,
        delay: delay + WHISPER_MS - 600,
        onComplete: () => text.destroy(),
      });
    });
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
    if (blocked !== this.wasBlocked) {
      this.wasBlocked = blocked;
      this.ui.onUiChange?.();
    }

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
    this.playerShadow.setPosition(this.player.x, this.player.y + 12);
    if (vx || vy) {
      if (!this.player.anims.isPlaying) this.player.play('walk-player');
      this.player.anims.timeScale = sneaking ? 0.5 : 1;
      if (vx) this.player.setFlipX(vx < 0);
      if (this.time.now >= this.nextStepAt) {
        audio.play(sneaking ? 'sneakStep' : 'step');
        this.nextStepAt = this.time.now + STEP_MS * (sneaking ? 1.6 : 1);
      }
    } else if (this.player.anims.isPlaying) {
      this.player.stop();
      this.player.setFrame('f0');
    }

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

      // Stepping into a cone is a free detection check by the engine, at most once per tick per NPC
      // (the engine ignores repeats, so don't clutter the command history with them).
      const checked = s.npcs[id]?.lastSpotCheck;
      const alreadyChecked = checked?.day === s.day && checked.tick === s.tick;
      if (covering && !v.wasInCone && !frozen && s.phase === 'day' && !alreadyChecked) {
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
