/**
 * Night shift: choose a victim, then where they'll be found. The room is a clue
 * you choose to leave: anyone seen near it today falls under suspicion, you included.
 */
import { ARCHETYPE_LABEL } from '../app/palette';
import type { GameStore } from '../app/store';
import { legalCommands, roomsPlayerVisitedToday, type Command, type GameState, type Id } from '../sim';
import { choiceIndexFromKey, renderChoices, type Choice } from './choices';
import { portrait } from './portrait';
import { room, who } from './text';

type Murder = Extract<Command, { type: 'murder' }>;

export interface Night {
  isOpen(): boolean;
  render(s: GameState): void;
}

export function mountNight(overlay: HTMLElement, store: GameStore, blocked: () => boolean): Night {
  const el = document.createElement('div');
  el.className = 'screen night-screen interactive';
  el.hidden = true;
  overlay.appendChild(el);

  let victim: Id | null = null;
  let choices: Choice[] = [];

  const draw = (s: GameState): void => {
    const murders = legalCommands(s).filter((c): c is Murder => c.type === 'murder');
    el.innerHTML = '';
    const h = document.createElement('h2');
    h.className = 'screen-title';
    el.appendChild(h);
    const hint = document.createElement('p');
    hint.className = 'hint';
    el.appendChild(hint);

    if (!victim) {
      h.innerHTML = `Night shift <span class="muted">· Day ${s.day}</span>`;
      hint.textContent = 'The house is asleep. Choose who doesn’t wake up.';
      const grid = document.createElement('div');
      grid.className = 'victims';
      const victims = [...new Set(murders.map((m) => m.victim))];
      choices = victims.map((id) => ({
        label: `${who(s, id)}, the ${ARCHETYPE_LABEL[s.npcs[id]?.archetype ?? 'sheep'].toLowerCase()}`,
        onPick: () => {
          victim = id;
          draw(store.state);
        },
      }));
      for (const id of victims) {
        const p = portrait(s, id, { showAttitude: true });
        p.addEventListener('click', () => {
          victim = id;
          draw(store.state);
        });
        grid.appendChild(p);
      }
      el.appendChild(grid);
    } else {
      const chosen = victim;
      h.innerHTML = `Where will ${who(s, chosen)} be found?`;
      hint.innerHTML =
        'Anyone remembered near that room today will be suspected. <kbd>Esc</kbd> to choose someone else.';
      const visited = roomsPlayerVisitedToday(s);
      choices = murders
        .filter((m) => m.victim === chosen)
        .map((m) => ({
          label: `The ${room(s, m.room)}${visited.includes(m.room) ? '  · you were here today' : ''}`,
          onPick: () => {
            victim = null;
            el.hidden = true;
            store.dispatch(m);
          },
        }));
    }
    renderChoices(el, choices);
  };

  window.addEventListener('keydown', (e) => {
    if (el.hidden || e.defaultPrevented) return;
    if (e.key === 'Escape' && victim) {
      e.preventDefault();
      victim = null;
      draw(store.state);
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
    render(s) {
      if (s.phase !== 'night') {
        el.hidden = true;
        victim = null;
        return;
      }
      if (el.hidden && !blocked()) {
        el.hidden = false;
        draw(s);
      }
    },
  };
}
