import Phaser from 'phaser';
import { MansionScene } from './phaser/scenes/Mansion';
import { mountHud } from './ui/hud';

const overlay = document.getElementById('overlay');
if (!overlay) throw new Error('#overlay element missing from index.html');
const hud = mountHud(overlay);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

game.scene.add('Mansion', MansionScene, true, {
  onSneakChange: (sneaking: boolean) => hud.setSneaking(sneaking),
});
