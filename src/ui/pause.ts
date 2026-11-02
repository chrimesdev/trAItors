/** Esc menu during play: resume, restart, new game, run report, how to play, title. */
import type { GameStore } from '../app/store';
import { choiceIndexFromKey, renderChoices, type Choice } from './choices';
import { copyOrShow, feedbackUrl } from './report';
import { runReport } from '../app/save';
import { HOW_TO_PLAY } from './title';

export interface Pause {
  isOpen(): boolean;
  open(): void;
}

export function mountPause(
  overlay: HTMLElement,
  store: GameStore,
  deps: {
    canOpen: () => boolean;
    newSeed: () => number;
    toTitle: () => void;
    tips?: { enabled(): boolean; setEnabled(on: boolean): void };
  },
): Pause {
  const el = document.createElement('div');
  el.className = 'modal panel pause interactive';
  el.hidden = true;
  overlay.appendChild(el);
  let choices: Choice[] = [];
  let help = false;

  const close = (): void => {
    el.hidden = true;
    help = false;
  };

  const draw = (): void => {
    const s = store.state;
    if (help) {
      el.innerHTML = `<h3>How to play</h3><div class="help">${HOW_TO_PLAY}</div>`;
      choices = [{ label: 'Back', onPick: () => ((help = false), draw()) }];
      renderChoices(el, choices);
      return;
    }
    el.innerHTML = `<h3>Paused</h3><p class="hint">Day ${s.day} · seed ${s.seed} · your game saves automatically.</p>`;
    const status = document.createElement('p');
    status.className = 'hint';
    choices = [
      { label: 'Resume', onPick: close },
      { label: 'How to play', onPick: () => ((help = true), draw()) },
      ...(deps.tips
        ? [
            {
              label: `First-day tips: ${deps.tips.enabled() ? 'on' : 'off'}`,
              onPick: () => (deps.tips?.setEnabled(!deps.tips.enabled()), draw()),
            },
          ]
        : []),
      { label: `Restart this seed (${s.seed})`, onPick: () => (close(), store.newGame(s.seed)) },
      { label: 'New game', onPick: () => (close(), store.newGame(deps.newSeed())) },
      {
        label: 'Copy run report',
        onPick: () =>
          void copyOrShow(runReport(store.state, [...store.commands]), el).then((how) => {
            status.textContent = how === 'copied' ? 'Copied.' : 'Select the text below and copy it.';
          }),
      },
      {
        label: 'Send playtest feedback',
        onPick: () => window.open(feedbackUrl(store.state, store.commands), '_blank', 'noopener'),
      },
      { label: 'Quit to title', onPick: () => (close(), deps.toTitle()) },
    ];
    renderChoices(el, choices);
    el.appendChild(status);
  };

  // Registered last in main.ts: only opens if no other panel claimed the Escape.
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    if (el.hidden) {
      if (e.key === 'Escape' && deps.canOpen()) {
        e.preventDefault();
        el.hidden = false;
        draw();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (help) {
        help = false;
        draw();
      } else close();
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
    open() {
      if (!deps.canOpen()) return;
      el.hidden = false;
      draw();
    },
  };
}
