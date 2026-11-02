/**
 * In-world HUD (no sidebar): overlays in the corners of the map, GTA-style.
 *   top-left     day, and the cast as small portraits (dimmed when gone)
 *   top-right    action stars, sneaking tag, menu
 *   bottom-left  what E does here
 *   bottom-right the item you carry, and bribe tokens
 */
import { shapesToSvg } from '../app/art/draw';
import { BUST, bust, lookOf } from '../app/art/looks';
import { drawItem, ITEM } from '../phaser/systems/items';
import { legalCommands, npcRoomOf, type GameState } from '../sim';
import { item, who } from './text';

export interface Hud {
  render(s: GameState): void;
  setSneaking(sneaking: boolean): void;
  /** Hide the context prompt while a panel has the keyboard. */
  setBusy(busy: boolean): void;
}

function itemCanvas(id: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = ITEM.w;
  c.height = ITEM.h;
  const ctx = c.getContext('2d');
  if (ctx) drawItem(ctx, id);
  return c;
}

export function mountHud(overlay: HTMLElement, openMenu: () => void): Hud {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-cast"><span class="day"></span><span class="faces"></span></div>
    <div class="hud-right">
      <button type="button" class="menu-button interactive">Menu <kbd>Esc</kbd></button>
      <div class="stars" title="Actions left today"></div>
      <div class="sneak">SNEAKING</div>
    </div>
    <div class="hud-prompt"></div>
    <div class="hud-item"><div class="slot"></div><div class="caption"></div></div>`;
  overlay.appendChild(el);
  const dayEl = el.querySelector('.day') as HTMLElement;
  const faces = el.querySelector('.faces') as HTMLElement;
  const stars = el.querySelector('.stars') as HTMLElement;
  const sneak = el.querySelector('.sneak') as HTMLElement;
  const prompt = el.querySelector('.hud-prompt') as HTMLElement;
  const slot = el.querySelector('.slot') as HTMLElement;
  const caption = el.querySelector('.caption') as HTMLElement;
  const menu = el.querySelector('.menu-button') as HTMLButtonElement;
  menu.addEventListener('mousedown', (e) => e.preventDefault());
  menu.addEventListener('click', openMenu);

  let last: GameState | null = null;
  let sneaking = false;
  let busy = false;
  let castKey = '';
  let itemKey = '';

  const drawPrompt = (s: GameState): void => {
    if (busy || s.phase !== 'day') {
      prompt.hidden = true;
      return;
    }
    const here = Object.values(s.npcs).filter((n) => n.alive && npcRoomOf(s, n.id) === s.player.room);
    const parts: string[] = here.map((n) => `Talk to ${n.name}`);
    for (const c of legalCommands(s)) {
      if (c.type === 'pickUp') parts.push(`Pick up the ${item(s, c.evidence)}`);
      else if (c.type === 'plant') parts.push(`Plant the ${item(s, c.evidence)}`);
    }
    if (parts.length === 0) {
      prompt.innerHTML = `<kbd>E</kbd> <span class="muted">nothing to do here · wait for the bell from the menu</span>`;
    } else {
      prompt.innerHTML = `<kbd>E</kbd> ${parts.slice(0, 3).join(' · ')}${parts.length > 3 ? ' · …' : ''}`;
    }
    prompt.hidden = false;
  };

  const draw = (): void => {
    const s = last;
    if (!s) return;
    const alive = Object.values(s.npcs).filter((n) => n.alive).length;
    dayEl.innerHTML = `Day <b>${s.day}</b> <span class="muted">· ${alive} Faithful${alive === 1 ? '' : 's'}</span>`;

    const key = Object.values(s.npcs)
      .map((n) => `${n.id}${n.alive ? '' : '-'}`)
      .join();
    if (key !== castKey) {
      castKey = key;
      faces.innerHTML = Object.values(s.npcs)
        .map(
          (n) =>
            `<span class="mini${n.alive ? '' : ' gone'}" title="${n.name}${n.alive ? '' : ' (gone)'}">${shapesToSvg(bust(lookOf(n.id)), BUST.w, BUST.h)}</span>`,
        )
        .join('');
    }

    const left = Math.max(0, s.actionsLeft);
    const total = s.balance.day.actionBudget;
    stars.innerHTML = Array.from(
      { length: total },
      (_, i) => `<span class="${i < left ? 'on' : 'off'}">★</span>`,
    ).join('');
    stars.classList.toggle('low', s.phase === 'day' && left <= 2);
    stars.classList.toggle('spent', s.phase !== 'day');
    sneak.hidden = !sneaking || s.phase !== 'day';

    const carried = s.player.inventory[0];
    const ik = `${carried ?? ''}|${s.player.bribeTokens}`;
    if (ik !== itemKey) {
      itemKey = ik;
      slot.innerHTML = '';
      slot.classList.toggle('empty', !carried);
      if (carried) {
        slot.appendChild(itemCanvas(carried));
        const ev = s.evidence[carried];
        caption.innerHTML = `<b>${item(s, carried)}</b>${ev?.belongsTo ? `<br><span class="muted">points at ${who(s, ev.belongsTo)}</span>` : ''}`;
      } else {
        caption.innerHTML = `<span class="muted">carrying nothing</span>`;
      }
      if (s.player.bribeTokens > 0) {
        caption.innerHTML += `<br><span class="coin">●</span> bribe ×${s.player.bribeTokens}`;
      }
    }
    drawPrompt(s);
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
    setBusy(v) {
      busy = v;
      if (last) drawPrompt(last);
    },
  };
}
