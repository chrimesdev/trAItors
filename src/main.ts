import Phaser from 'phaser';
import { GameStore, seedFromUrl } from './app/store';
import { MansionScene } from './phaser/scenes/Mansion';
import { mountFeed } from './ui/feed';
import { mountHud } from './ui/hud';
import { mountModals } from './ui/modals';
import { mountReveal } from './ui/reveal';
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
const modals = mountModals(
  overlay,
  store,
  () => scene?.visibleTo() ?? [],
  () => Math.floor(Math.random() * 2 ** 31),
);

const render = (s = store.state, prev: typeof s | null = null): void => {
  hud.render(s);
  feed.render(s, prev);
  reveal.render(s);
  modals.render(s, prev);
};
store.subscribe(render);
render();

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
    isUiBlocking: () => modals.isOpen(),
    openInteract: () => modals.openInteract(),
    onSneakChange: (sneaking: boolean) => hud.setSneaking(sneaking),
  },
});
game.events.once(Phaser.Core.Events.READY, () => {
  scene = game.scene.getScene('Mansion') as MansionScene;
});
