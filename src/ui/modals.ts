/**
 * Centre-screen panels: the E interaction menu, and placeholder Round Table,
 * night and end screens. M3 replaces the Round Table and night screens with the
 * real ones (portraits, typed speeches, statements, trust web).
 */
import type { GameStore } from '../app/store';
import { legalCommands, roundTableSpeeches, type Command, type GameState, type Id } from '../sim';
import { choiceIndexFromKey, renderChoices, type Choice } from './choices';
import { describeCommand, describeSpeech, room, who } from './text';

const MENU_TYPES: Command['type'][] = ['pickUp', 'plant', 'report', 'chat', 'ally', 'bribe', 'endDay'];

export interface Modals {
  /** True while any modal is open: the mansion ignores movement. */
  isOpen(): boolean;
  openInteract(): void;
  render(s: GameState, prev: GameState | null): void;
}

export function mountModals(
  overlay: HTMLElement,
  store: GameStore,
  visibleTo: () => Id[],
  newSeed: () => number,
): Modals {
  const el = document.createElement('div');
  el.className = 'modal panel interactive';
  el.hidden = true;
  overlay.appendChild(el);

  let choices: Choice[] = [];
  let mode: 'none' | 'interact' | 'phase' = 'none';
  let nightVictim: Id | null = null;

  const close = (): void => {
    el.hidden = true;
    el.innerHTML = '';
    choices = [];
    mode = 'none';
  };

  const show = (title: string, hint: string, body: HTMLElement | null, list: Choice[]): void => {
    el.innerHTML = `<h3>${title}</h3>${hint ? `<p class="hint">${hint}</p>` : ''}`;
    if (body) el.appendChild(body);
    choices = list;
    renderChoices(el, list);
    el.hidden = false;
  };

  const send = (c: Command): void => {
    // Witnesses for picking up or planting are whoever is looking at you right now.
    const cmd: Command = c.type === 'pickUp' || c.type === 'plant' ? { ...c, visibleTo: visibleTo() } : c;
    close();
    store.dispatch(cmd);
  };

  const openInteract = (): void => {
    const s = store.state;
    const cmds = legalCommands(s).filter((c) => MENU_TYPES.includes(c.type));
    mode = 'interact';
    show(
      room(s, s.player.room),
      'Each action uses one of your day’s actions. <kbd>Esc</kbd> to close. Seeding doubt arrives in M3.',
      null,
      cmds.map((c) => ({ label: describeCommand(s, c), onPick: () => send(c) })),
    );
  };

  const list = (items: string[]): HTMLElement => {
    const ul = document.createElement('ul');
    for (const t of items) {
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    }
    return ul;
  };

  const renderPhase = (s: GameState): void => {
    if (s.phase === 'roundTable') {
      mode = 'phase';
      const speeches = roundTableSpeeches(s).map((sp) => describeSpeech(s, sp));
      const voteFor = Object.values(s.npcs).filter((n) => n.alive);
      show(
        'The Round Table',
        'Placeholder table (M3 adds statements, lies and the trust web). Who do you vote to banish?',
        list(speeches.length ? speeches : ['An uneasy silence. Nobody wants to go first.']),
        voteFor.map((n) => ({
          label: `Vote for ${n.name}`,
          onPick: () => {
            close();
            store.dispatch({ type: 'resolveRoundTable', playerVote: n.id, statement: { kind: 'quiet' } });
          },
        })),
      );
      return;
    }

    if (s.phase === 'night') {
      mode = 'phase';
      const banished = s.lastVote ? `${who(s, s.lastVote.banished)} was banished.` : '';
      const murders = legalCommands(s).filter(
        (c): c is Extract<Command, { type: 'murder' }> => c.type === 'murder',
      );
      if (!nightVictim) {
        const victims = [...new Set(murders.map((m) => m.victim))];
        show(
          'Night shift',
          `${banished} Choose tonight's victim.`,
          null,
          victims.map((v) => ({
            label: who(s, v),
            onPick: () => {
              nightVictim = v;
              renderPhase(store.state);
            },
          })),
        );
      } else {
        const victim = nightVictim;
        show(
          `Where will ${who(s, victim)} be found?`,
          'Anyone who remembers seeing someone in that room today will suspect them.',
          null,
          murders
            .filter((m) => m.victim === victim)
            .map((m) => ({
              label: room(s, m.room),
              onPick: () => {
                nightVictim = null;
                close();
                store.dispatch(m);
              },
            })),
        );
      }
      return;
    }

    if (s.phase === 'ended') {
      mode = 'phase';
      const won = s.outcome === 'win';
      show(
        won ? 'The Traitor wins' : 'Banished',
        won
          ? `You survived to day ${s.day} without being caught.`
          : `The Faithfuls saw through you on day ${s.day}.`,
        list(s.log.slice(-4).map((e) => e.text)),
        [{ label: 'Play again', onPick: () => (close(), store.newGame(newSeed())) }],
      );
      return;
    }

    if (mode === 'phase') close();
  };

  window.addEventListener('keydown', (e) => {
    if (el.hidden) return;
    if (e.key === 'Escape' && mode === 'interact') {
      close();
      return;
    }
    const i = choiceIndexFromKey(e);
    if (i >= 0) choices[i]?.onPick();
  });

  return {
    isOpen: () => !el.hidden,
    openInteract,
    render(s, prev) {
      if (mode === 'interact' && prev && s !== prev) close();
      if (s.phase !== 'day' || mode === 'phase') renderPhase(s);
    },
  };
}
