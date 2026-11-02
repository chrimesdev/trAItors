/** Top-left status: day, actions, room, inventory, sneak state. */
import type { GameState } from '../sim';
import { item, room } from './text';

export interface Hud {
  render(s: GameState): void;
  setSneaking(sneaking: boolean): void;
}

export function mountHud(overlay: HTMLElement): Hud {
  const el = document.createElement('div');
  el.className = 'hud panel';
  overlay.appendChild(el);
  let sneaking = false;
  let last: GameState | null = null;

  const draw = (): void => {
    const s = last;
    if (!s) return;
    const left = Math.max(0, s.actionsLeft);
    const used = s.balance.day.actionBudget - left;
    const carrying = s.player.inventory.map((id) => item(s, id)).join(', ') || 'nothing';
    const alive = Object.values(s.npcs).filter((n) => n.alive).length;
    el.innerHTML = `
      <strong>Tr<span class="ai">AI</span>tors</strong> · Day <b>${s.day}</b><br />
      <div class="row"><b>${alive}</b> Faithfuls remain</div>
      <div class="row">Actions <span class="pips">${'●'.repeat(left)}${'○'.repeat(used)}</span></div>
      <div class="row">Room <b>${room(s, s.player.room)}</b></div>
      <div class="row">Carrying <b>${carrying}</b></div>
      <div class="row ${sneaking ? 'sneak-on' : ''}">${sneaking ? 'Sneaking…' : 'Walking'}</div>
      <div class="row"><kbd>WASD</kbd> move · <kbd>Shift</kbd> sneak · <kbd>E</kbd> act</div>
    `;
  };

  return {
    render(s) {
      last = s;
      draw();
    },
    setSneaking(v) {
      sneaking = v;
      draw();
    },
  };
}
