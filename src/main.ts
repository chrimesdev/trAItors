import Phaser from 'phaser';
import { browserStorage } from './app/save';
import { GameStore, randomSeed, seedFromUrl } from './app/store';
import { MansionScene } from './phaser/scenes/Mansion';
import type { GameState } from './sim';
import { mountEndScreen } from './ui/endScreen';
import { mountFeed } from './ui/feed';
import { mountHud } from './ui/hud';
import { mountModals } from './ui/modals';
import { mountMorning } from './ui/morning';
import { mountNight } from './ui/night';
import { mountPause } from './ui/pause';
import { mountReveal } from './ui/reveal';
import { mountRoundTable } from './ui/roundTable';
import { mountTalk } from './ui/talk';
import { mountTitle } from './ui/title';
import './ui/styles.css';

const overlay = document.getElementById('overlay');
if (!overlay) throw new Error('#overlay element missing from index.html');

const storage = browserStorage();
const urlSeed = seedFromUrl();
// A game exists behind the title screen so the mansion renders; the title replaces it.
const store = new GameStore(urlSeed ?? randomSeed(), storage);
// Exposed for debugging and automated smoke tests in the browser console.
(window as unknown as { traitors: GameStore }).traitors = store;

let scene: MansionScene | null = null;

const sidebar = document.createElement('aside');
sidebar.className = 'sidebar';
overlay.appendChild(sidebar);
const hud = mountHud(sidebar, () => pause.open());
const reveal = mountReveal(sidebar);
const feed = mountFeed(sidebar);

// Full-screen moments. The Round Table plays out its reveal after the engine has
// already moved on, so night and the end screen wait until it closes.
const table = mountRoundTable(overlay, store, () => render(store.state, store.state));
const night = mountNight(overlay, store, () => table.isOpen());
const talk = mountTalk(overlay, store);
const morning = mountMorning(overlay);
const modals = mountModals(overlay, store, {
  visibleTo: () => scene?.visibleTo() ?? [],
  openTalk: (npc) => talk.open(npc),
});
const end = mountEndScreen(overlay, store, {
  blocked: () => table.isOpen(),
  newSeed: randomSeed,
  toTitle: () => title.open(),
});
const title = mountTitle(overlay, store, storage, {
  urlSeed,
  randomSeed,
  onStart: () => render(store.state, null),
});

const panels = [modals, talk, table, night, morning, end, title];
const uiBlocking = (): boolean => panels.some((p) => p.isOpen()) || pause.isOpen();

// Mounted last so it only sees an Escape no other panel used.
const pause = mountPause(overlay, store, {
  canOpen: () => !panels.some((p) => p.isOpen()),
  newSeed: randomSeed,
  toTitle: () => title.open(),
});

function render(s: GameState, prev: GameState | null): void {
  hud.render(s);
  feed.render(s, prev);
  reveal.render(s);
  if (title.isOpen()) return; // the game behind the title waits
  talk.render(s);
  table.render(s, prev);
  night.render(s);
  morning.render(s, prev);
  modals.render(s, prev);
  end.render(s, prev);
}
store.subscribe(render);
// Title first: game panels (like the day-1 briefing) wait until a game is chosen.
title.open();
render(store.state, null);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1200, // 960px mansion + 240px sidebar for the HUD (DOM overlay)
  height: 528,
  backgroundColor: '#0e0e1a',
  pixelArt: true,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
});

game.scene.add('Mansion', MansionScene, true, {
  store,
  ui: {
    isUiBlocking: uiBlocking,
    openInteract: () => modals.openInteract(),
    onSneakChange: (sneaking: boolean) => hud.setSneaking(sneaking),
  },
});
game.events.once(Phaser.Core.Events.READY, () => {
  scene = game.scene.getScene('Mansion') as MansionScene;
});
