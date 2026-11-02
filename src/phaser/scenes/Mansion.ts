import Phaser from 'phaser';
import { BALANCE } from '../../sim';

const WALK_SPEED = 160;
const SNEAK_FACTOR = 0.5;

/**
 * M0 placeholder: a grey-box "room" and a player rectangle.
 * WASD / arrows to move, hold Shift to sneak at half speed.
 * M2 replaces this with the Tiled mansion, NPCs and sight cones.
 */
export class MansionScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    shift: Phaser.Input.Keyboard.Key;
  };
  private onSneakChange?: (sneaking: boolean) => void;
  private wasSneaking = false;

  constructor() {
    super('Mansion');
  }

  init(data: { onSneakChange?: (sneaking: boolean) => void }): void {
    this.onSneakChange = data.onSneakChange;
  }

  create(): void {
    const { width, height } = this.scale;

    // Grey-box room outline.
    this.add.rectangle(width / 2, height / 2, width - 80, height - 80).setStrokeStyle(2, 0x5c5c6e);
    this.add
      .text(width / 2, 60, `Day 1 · ${BALANCE.day.actionBudget} actions`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#c9b6bb',
      })
      .setOrigin(0.5);

    this.player = this.add.rectangle(width / 2, height / 2, 24, 24, 0xff4d6d);

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
    };
  }

  override update(_time: number, deltaMs: number): void {
    const k = this.keys;
    const dx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const dy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);

    const sneaking = k.shift.isDown;
    if (sneaking !== this.wasSneaking) {
      this.wasSneaking = sneaking;
      this.player.setAlpha(sneaking ? 0.45 : 1);
      this.onSneakChange?.(sneaking);
    }

    if (dx === 0 && dy === 0) return;
    const len = Math.hypot(dx, dy);
    const speed = WALK_SPEED * (sneaking ? SNEAK_FACTOR : 1);
    const step = (speed * deltaMs) / 1000;

    const { width, height } = this.scale;
    const half = this.player.width / 2;
    this.player.x = Phaser.Math.Clamp(this.player.x + (dx / len) * step, 40 + half, width - 40 - half);
    this.player.y = Phaser.Math.Clamp(this.player.y + (dy / len) * step, 40 + half, height - 40 - half);
  }
}
