/**
 * The E interaction menu and the end-of-game screen.
 * Talking, the Round Table, night and morning each have their own panel.
 */
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
  deps: {
    visibleTo: () => Id[];
    newSeed: () => number;
    openTalk: (npc: Id) => void;
    blocked: () => boolean;
  },
): Modals {
  const el = document.createElement('div');
  el.className = 'modal panel interactive';
  el.hidden = true;
  overlay.appendChild(el);

  let choices: Choice[] = [];
  let mode: 'none' | 'interact' | 'end' = 'none';

  const close = (): void => {
    el.hidden = true;
    el.innerHTML = '';
    choices = [];
    mode = 'none';
  };

  const show = (title: string, hint: string, list: Choice[], body = ''): void => {
    el.innerHTML = `<h3>${title}</h3>${hint ? `<p class="hint">${hint}</p>` : ''}${body}`;
    choices = list;
    renderChoices(el, list);
    el.hidden = false;
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
    const actions = legalCommands(s)
      .filter((c) => MENU_TYPES.includes(c.type))
      .map((c) => ({ label: describeCommand(s, c), onPick: () => send(c) }));
    mode = 'interact';
    show(room(s, s.player.room), 'Each action uses one of your day’s actions. <kbd>Esc</kbd> to close.', [
      ...talk,
      ...actions,
    ]);
  };

  const showEnd = (s: GameState): void => {
    mode = 'end';
    const won = s.outcome === 'win';
    const lies = s.player.lies.length;
    const caught = s.player.lies.filter((l) => l.contradictedBy).length;
    const banished = s.log.filter((e) => e.text.endsWith('They were a Faithful.')).map((e) => e.text);
    show(
      won ? 'The Traitor wins' : 'Banished',
      won
        ? `You reached the end on day ${s.day} with the Faithfuls none the wiser.`
        : `The Faithfuls saw through you on day ${s.day}.`,
      [{ label: 'Play again', onPick: () => (close(), store.newGame(deps.newSeed())) }],
      `<ul>${banished.map((b) => `<li>${b}</li>`).join('')}
        <li>You told ${lies} lie${lies === 1 ? '' : 's'}; ${caught} ${caught === 1 ? 'was' : 'were'} caught.</li>
        <li>Seed ${s.seed}: add <code>?seed=${s.seed}</code> to the URL to replay.</li></ul>`,
    );
  };

  window.addEventListener('keydown', (e) => {
    if (el.hidden || e.defaultPrevented) return;
    if (e.key === 'Escape' && mode === 'interact') {
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
      if (mode === 'interact' && prev && s !== prev) close();
      if (mode === 'end' && s.phase !== 'ended') close();
      if (s.phase === 'ended' && mode !== 'end' && !deps.blocked()) showEnd(s);
    },
  };
}
