/**
 * Morning cards: the opening briefing on day 1, and the body being found on
 * every day after a murder.
 */
import type { GameState } from '../sim';
import { choiceIndexFromKey, isAdvanceKey, renderChoices } from './choices';
import { room, who } from './text';

export interface Morning {
  isOpen(): boolean;
  render(s: GameState, prev: GameState | null): void;
}

export function mountMorning(overlay: HTMLElement): Morning {
  const el = document.createElement('div');
  el.className = 'modal panel morning interactive';
  el.hidden = true;
  overlay.appendChild(el);
  let shownFor = '';

  const close = (): void => {
    el.hidden = true;
  };

  const show = (title: string, body: string): void => {
    el.innerHTML = `<h3>${title}</h3><p>${body}</p>`;
    renderChoices(el, [{ label: 'Begin the day', onPick: close }]);
    el.hidden = false;
  };

  window.addEventListener('keydown', (e) => {
    if (el.hidden || e.defaultPrevented) return;
    if (isAdvanceKey(e) || choiceIndexFromKey(e) === 0) {
      e.preventDefault();
      close();
    }
  });

  return {
    isOpen: () => !el.hidden,
    render(s, prev) {
      if (prev === null) shownFor = '';
      if (s.phase !== 'day' || s.tick !== 0) return;
      const key = `${s.seed}:${s.day}`;
      if (shownFor === key) return;
      shownFor = key;

      if (s.day === 1) {
        show(
          'You are the Traitor',
          `Six Faithfuls share this house, and none of them know it’s you. Each day you have
           <b>${s.balance.day.actionBudget} actions</b>: every door you walk through and every
           conversation costs one. Hold <kbd>Shift</kbd> to sneak past their gaze, and to lie.
           Plant evidence, seed doubt, and make sure it’s someone else they banish tonight.`,
        );
      } else if (s.lastMurder && s.lastMurder.day === s.day - 1) {
        show(
          `Day ${s.day}`,
          `${who(s, s.lastMurder.victim)} is found dead in the <b>${room(s, s.lastMurder.room)}</b>.
           Anyone remembered near there yesterday is under suspicion.`,
        );
      }
    },
  };
}
