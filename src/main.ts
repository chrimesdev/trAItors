import Phaser from 'phaser';
import { GameStore, seedFromUrl } from './app/store';
import { MansionScene } from './phaser/scenes/Mansion';
import type { GameState } from './sim';
import { mountFeed } from './ui/feed';
import { mountHud } from './ui/hud';
import { mountModals } from './ui/modals';
import { mountMorning } from './ui/morning';
import { mountNight } from './ui/night';
import { mountReveal } from './ui/reveal';
import { mountRoundTable } from './ui/roundTable';
import { mountTalk } from './ui/talk';
import './ui/styles.css';

const overlay = document.getElementById('overlay');
if (!overlay) throw new Error('#overlay element missing from index.html');

const store = new GameStore(seedFromUrl());
// Exposed for debugging and automated smoke tests in the browser console.
(window as unknown as { traitors: GameStore }).traitors = store;

let scene: MansionScene | null = null;

const sidebar = document.createElement('aside');
sidebar.className = 'sidebar';
overlay.appendChild(sidebar);
const hud = mountHud(sidebar);
const reveal = mountReveal(sidebar);
const feed = mountFeed(sidebar);

// Full-screen moments. The Round Table plays out its reveal after the engine has
// already moved on to night, so night and the end screen wait until it closes.
const table = mountRoundTable(overlay, store, () => render(store.state, store.state));
const night = mountNight(overlay, store, () => table.isOpen());
const talk = mountTalk(overlay, store);
const morning = mountMorning(overlay);
const modals = mountModals(overlay, store, {
  visibleTo: () => scene?.visibleTo() ?? [],
  newSeed: () => Math.floor(Math.random() * 2 ** 31),
  openTalk: (npc) => talk.open(npc),
  blocked: () => table.isOpen(),
});

function render(s: GameState, prev: GameState | null): void {
  hud.render(s);
  feed.render(s, prev);
  reveal.render(s);
  talk.render(s);
  table.render(s, prev);
  night.render(s);
  morning.render(s, prev);
  modals.render(s, prev);
}
store.subscribe(render);
render(store.state, null);

const uiBlocking = (): boolean =>
  modals.isOpen() || talk.isOpen() || table.isOpen() || night.isOpen() || morning.isOpen();

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
