/**
 * DOM overlay HUD. All UI text lives in the DOM, not the canvas, so it stays
 * crisp and accessible. M2+ extends this with day/tick/room state from the sim.
 */
export interface Hud {
  setSneaking(sneaking: boolean): void;
}

export function mountHud(overlay: HTMLElement): Hud {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <strong>Tr<span class="ai">AI</span>tors</strong><br />
    WASD / arrows to move · hold <kbd>Shift</kbd> to sneak<br />
    <span data-sneak>Walking</span>
  `;
  overlay.appendChild(el);
  const sneakEl = el.querySelector<HTMLSpanElement>('[data-sneak]');

  return {
    setSneaking(sneaking) {
      if (sneakEl) sneakEl.textContent = sneaking ? 'Sneaking…' : 'Walking';
    },
  };
}
