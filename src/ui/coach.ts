/**
 * Day-1 coach (M5 "tutorial day"): a sidebar card that walks a new player through
 * one sneak, one pick-up, one plant and one conversation on their first real day.
 * It reads the commands already sent, so it survives save/resume and never touches rules.
 */
import type { KeyValueStorage } from '../app/save';
import type { GameStore } from '../app/store';
import type { Command, GameState, Id } from '../sim';
import { item, room, who } from './text';

export const COACH_KEY = 'traitors.coach.v1';

export interface Coach {
  enabled(): boolean;
  setEnabled(on: boolean): void;
  /** True while the coach still wants the plant done before the day is waited out. */
  blocksEndDay(): boolean;
  render(s: GameState): void;
}

type StepId = 'sneak' | 'pickUp' | 'plant' | 'talk';

interface Step {
  id: StepId;
  title: string;
  done(commands: readonly Command[]): boolean;
  hint(s: GameState): string;
}

/** Doors between the player's room and every other room. */
function doorsAway(s: GameState, from: Id): Record<Id, number> {
  const dist: Record<Id, number> = { [from]: 0 };
  const queue = [from];
  while (queue.length) {
    const r = queue.shift() as Id;
    for (const next of s.rooms[r]?.adjacent ?? []) {
      if (dist[next] !== undefined) continue;
      dist[next] = (dist[r] ?? 0) + 1;
      queue.push(next);
    }
  }
  return dist;
}

function nearestEvidence(s: GameState): { id: Id; doors: number } | undefined {
  const dist = doorsAway(s, s.player.room);
  let best: { id: Id; doors: number } | undefined;
  for (const ev of Object.values(s.evidence)) {
    if (!s.rooms[ev.location] || ev.foundBy) continue;
    const doors = dist[ev.location];
    if (doors === undefined) continue;
    if (!best || doors < best.doors) best = { id: ev.id, doors };
  }
  return best;
}

const STEPS: Step[] = [
  {
    id: 'sneak',
    title: 'Sneak through a door',
    done: (cmds) => cmds.some((c) => c.type === 'move' && c.sneaking),
    hint: () =>
      'Hold <kbd>Shift</kbd> while you walk into the next room. Sneaking is slow, but inside a ' +
      'sight cone you might go unnoticed. Every door costs an action.',
  },
  {
    id: 'pickUp',
    title: 'Pick up some evidence',
    done: (cmds) => cmds.some((c) => c.type === 'pickUp'),
    hint: (s) => {
      const near = nearestEvidence(s);
      if (!near) return 'Find an item lying in a room and press <kbd>E</kbd> to pick it up.';
      const ev = s.evidence[near.id];
      const where = near.doors === 0 ? 'in this room' : `in the ${room(s, ev?.location)}`;
      return `The ${item(s, near.id)} is ${where}. Stand near it and press <kbd>E</kbd>.`;
    },
  },
  {
    id: 'plant',
    title: 'Plant it on someone',
    done: (cmds) => cmds.some((c) => c.type === 'plant'),
    hint: (s) => {
      const carried = s.player.inventory[0];
      const ev = carried ? s.evidence[carried] : undefined;
      const points = ev?.belongsTo
        ? `It points at <b>${who(s, ev.belongsTo)}</b>.`
        : ev
          ? 'It points at whoever is seen near it.'
          : '';
      return (
        `${points} Press <kbd>E</kbd> to plant it in a room others walk through, where nobody ` +
        'has seen you today. Make sure no sight cone is on you when you do.'
      );
    },
  },
  {
    id: 'talk',
    title: 'Talk to someone',
    done: (cmds) => cmds.some((c) => ['chat', 'seedDoubt', 'ally', 'bribe'].includes(c.type)),
    hint: () =>
      'Press <kbd>E</kbd> in a room with someone in it. A chat tells you who they suspect and how ' +
      'they feel about you. Hold <kbd>Shift</kbd> in a conversation to lie.',
  },
];

export function mountCoach(sidebar: HTMLElement, store: GameStore, storage: KeyValueStorage | null): Coach {
  const el = document.createElement('div');
  el.className = 'coach panel interactive';
  el.hidden = true;
  sidebar.appendChild(el);

  let on = true;
  try {
    on = storage?.getItem(COACH_KEY) !== 'off';
  } catch {
    // Storage blocked: show the coach this session.
  }
  const write = (value: 'on' | 'off'): void => {
    try {
      storage?.setItem(COACH_KEY, value);
    } catch {
      // ignore
    }
  };

  let lastSeed = -1;
  let completedSeed = -1;

  const draw = (s: GameState): void => {
    const done = STEPS.map((st) => st.done(store.commands));
    const current = STEPS.findIndex((_, i) => !done[i]);
    const allDone = current === -1;
    if (allDone && completedSeed !== s.seed) {
      // Finished once: later games start without the coach. The pause menu can bring it back.
      completedSeed = s.seed;
      write('off');
    }

    let foot: string;
    if (s.phase === 'roundTable') {
      foot = 'At the table, make your case: accuse, defend or give an alibi. Staying quiet gets noticed.';
    } else if (s.phase === 'night') {
      foot = 'Choose a victim and a room from their day. Anyone who saw you there yesterday will remember.';
    } else if (allDone) {
      foot =
        'That’s the groundwork. When the bell rings, the Faithfuls vote someone out. Make sure it isn’t you.';
    } else {
      foot = STEPS[current]?.hint(s) ?? '';
    }

    el.innerHTML = `
      <h4>Your first day</h4>
      <ol>${STEPS.map(
        (st, i) => `<li class="${done[i] ? 'done' : i === current ? 'now' : ''}">${st.title}</li>`,
      ).join('')}</ol>
      <p class="hint">${foot}</p>
      <button type="button" class="skip">Hide tips</button>`;
    const skip = el.querySelector('button') as HTMLButtonElement;
    skip.addEventListener('mousedown', (e) => e.preventDefault());
    skip.addEventListener('click', () => {
      on = false;
      write('off');
      el.hidden = true;
    });
  };

  return {
    enabled: () => on,
    setEnabled(v) {
      on = v;
      write(v ? 'on' : 'off');
      if (!v) el.hidden = true;
    },
    blocksEndDay() {
      return !el.hidden && !STEPS.find((st) => st.id === 'plant')?.done(store.commands);
    },
    render(s) {
      if (s.seed !== lastSeed) {
        lastSeed = s.seed;
        // A new game re-reads the preference: a tester may have switched it off mid-game.
        try {
          on = storage?.getItem(COACH_KEY) !== 'off';
        } catch {
          // ignore
        }
      }
      if (!on || s.day !== 1 || s.phase === 'ended') {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      draw(s);
    },
  };
}
