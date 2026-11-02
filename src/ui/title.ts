/** Title screen: continue a saved game, start a new one, pick a seed, or read how to play. */
import type { GameStore } from '../app/store';
import { readSave, type KeyValueStorage, type SaveFile } from '../app/save';
import { choiceIndexFromKey, renderChoices, type Choice } from './choices';

export interface Title {
  isOpen(): boolean;
  open(): void;
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

export const HOW_TO_PLAY = `
  <p>You are the <b>Traitor</b>. Six Faithfuls share the mansion, and none of them know it’s you.
  Survive until only one of them is left.</p>
  <ul>
    <li><b>Day.</b> Walk with <kbd>WASD</kbd> or the arrow keys. Every door you go through and every
      conversation uses one of your <b>6 actions</b>. Press <kbd>E</kbd> to act in a room.</li>
    <li><b>Sight cones.</b> NPCs look around. Inside a cone, you’re seen. Hold <kbd>Shift</kbd> to
      sneak: slower, but they might not notice.</li>
    <li><b>Evidence.</b> Pick it up, plant it where someone else will find it. Get caught planting
      and it’s evidence against you.</li>
    <li><b>Talk.</b> Chat to learn who suspects whom. Seed doubt, form alliances, bribe. Hold
      <kbd>Shift</kbd> to lie, but Detectives check what you say against what they saw.</li>
    <li><b>Round Table.</b> Everyone speaks, you make your case, everyone votes. Most votes is
      banished. Ties go against you. Staying quiet, or ignoring people all day, looks suspicious.</li>
    <li><b>Night.</b> Choose a victim and where they’re found. Anyone remembered near that room
      falls under suspicion, including you. So does whoever the victim suspected.</li>
  </ul>
  <p><kbd>1</kbd>–<kbd>9</kbd> pick options · <kbd>Space</kbd> continues · <kbd>Esc</kbd> backs out or opens the menu.</p>
`;

export function mountTitle(
  overlay: HTMLElement,
  store: GameStore,
  storage: KeyValueStorage | null,
  deps: { urlSeed: number | null; randomSeed: () => number; onStart: () => void },
): Title {
  const el = document.createElement('div');
  el.className = 'title-screen interactive';
  el.hidden = true;
  overlay.appendChild(el);

  let choices: Choice[] = [];
  let view: 'main' | 'seed' | 'help' = 'main';

  const start = (fn: () => void): void => {
    el.hidden = true;
    fn();
    deps.onStart();
  };

  const draw = (): void => {
    const save: SaveFile | null = readSave(storage);
    el.innerHTML = `
      <div class="title-inner">
        <h1 class="logo">Tr<span class="ai">AI</span>tors</h1>
        <p class="tagline">Shift the blame. Survive the night shift.</p>
        <div class="title-body"></div>
        <p class="title-foot">GitHub Game Off 2026 · theme: SHIFT · build ${BUILD_ID}</p>
      </div>`;
    const body = el.querySelector('.title-body') as HTMLElement;

    if (view === 'help') {
      body.innerHTML = `<div class="help">${HOW_TO_PLAY}</div>`;
      choices = [{ label: 'Back', onPick: () => ((view = 'main'), draw()) }];
    } else if (view === 'seed') {
      body.innerHTML = `
        <p class="hint">The same seed and the same choices always play out the same way.</p>
        <form class="seed-form"><input type="number" min="0" inputmode="numeric" placeholder="e.g. 42" aria-label="Seed" />
        <button type="submit">Start</button></form>`;
      const form = body.querySelector('form') as HTMLFormElement;
      const input = body.querySelector('input') as HTMLInputElement;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const n = Number(input.value);
        if (input.value !== '' && Number.isFinite(n)) start(() => store.newGame(n >>> 0));
      });
      setTimeout(() => input.focus(), 0);
      choices = [{ label: 'Back', onPick: () => ((view = 'main'), draw()) }];
    } else {
      choices = [];
      if (save) {
        choices.push({
          label: `Continue · Day ${save.state.day}, saved ${ago(save.savedAt)}`,
          onPick: () => start(() => store.resume(save)),
        });
      }
      if (deps.urlSeed !== null) {
        const seed = deps.urlSeed;
        choices.push({ label: `Play seed ${seed}`, onPick: () => start(() => store.newGame(seed)) });
      }
      choices.push(
        { label: 'New game', onPick: () => start(() => store.newGame(deps.randomSeed())) },
        { label: 'New game from a seed…', onPick: () => ((view = 'seed'), draw()) },
        { label: 'How to play', onPick: () => ((view = 'help'), draw()) },
      );
    }
    renderChoices(body, choices);
  };

  window.addEventListener('keydown', (e) => {
    if (el.hidden || e.defaultPrevented) return;
    if ((e.target as HTMLElement).tagName === 'INPUT') {
      if (e.key === 'Escape') {
        e.preventDefault();
        view = 'main';
        draw();
      }
      return;
    }
    if (e.key === 'Escape' && view !== 'main') {
      e.preventDefault();
      view = 'main';
      draw();
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
      view = 'main';
      el.hidden = false;
      draw();
    },
  };
}
