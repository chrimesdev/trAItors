/** The E interaction menu: talk to someone here, pick up, plant, "discover", or end the day. */
import type { GameStore } from '../app/store';
import { legalCommands, npcRoomOf, type Command, type GameState, type Id } from '../sim';
import { choiceIndexFromKey, renderChoices, type Choice } from './choices';
import { describeCommand, room } from './text';

const MENU_TYPES: Command['type'][] = ['pickUp', 'plant', 'report', 'endDay'];

export interface Modals {
  isOpen(): boolean;
  openInteract(): void;
  render(s: GameState, prev: GameState | null): void;
}

export function mountModals(
  overlay: HTMLElement,
  store: GameStore,
  deps: { visibleTo: () => Id[]; openTalk: (npc: Id) => void; hideEndDay?: () => boolean },
): Modals {
  const el = document.createElement('div');
  el.className = 'modal panel interactive';
  el.hidden = true;
  overlay.appendChild(el);
  let choices: Choice[] = [];

  const close = (): void => {
    el.hidden = true;
    el.innerHTML = '';
    choices = [];
  };

  const send = (c: Command): void => {
    // Witnesses for picking up or planting are whoever is looking at you right now.
    const cmd: Command =
      c.type === 'pickUp' || c.type === 'plant' ? { ...c, visibleTo: deps.visibleTo() } : c;
    close();
    store.dispatch(cmd);
  };

  const openInteract = (): void => {
    const s = store.state;
    const here = Object.values(s.npcs).filter((n) => n.alive && npcRoomOf(s, n.id) === s.player.room);
    const talk: Choice[] = here.map((n) => ({
      label: `Talk to ${n.name}`,
      onPick: () => {
        close();
        deps.openTalk(n.id);
      },
    }));
    const hideEndDay = deps.hideEndDay?.() ?? false;
    const actions = legalCommands(s)
      .filter((c) => MENU_TYPES.includes(c.type) && !(hideEndDay && c.type === 'endDay'))
      .map((c) => ({ label: describeCommand(s, c), onPick: () => send(c) }));
    el.innerHTML = `<h3>${room(s, s.player.room)}</h3><p class="hint">Each action uses one of your day’s actions. <kbd>Esc</kbd> to close.</p>`;
    choices = [...talk, ...actions];
    renderChoices(el, choices);
    el.hidden = false;
  };

  window.addEventListener('keydown', (e) => {
    if (el.hidden || e.defaultPrevented) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    const i = choiceIndexFromKey(e);
    if (i >= 0) {
      e.preventDefault();
      choices[i]?.onPick();
    }
  });

  return {
    isOpen: () => !el.hidden,
    openInteract,
    render(s, prev) {
      if (!el.hidden && prev && s !== prev) close();
    },
  };
}
