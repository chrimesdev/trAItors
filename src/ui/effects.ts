/** Screen effects and state-driven sound cues. Presentation only: it reads state, never changes it. */
import { audio } from '../app/audio';
import type { GameState } from '../sim';

/** Shakes the whole app for a moment (the murder reveal). */
export function shake(): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.remove('shake');
  void app.offsetWidth; // restart the animation if it is already running
  app.classList.add('shake');
  app.addEventListener('animationend', () => app.classList.remove('shake'), { once: true });
}

/** Sounds that follow from what just changed in the simulation. */
export function cueSounds(s: GameState, prev: GameState | null): void {
  if (!prev || s.seed !== prev.seed) return;
  if (s.phase === 'roundTable' && prev.phase === 'day') audio.play('bell');
  if (s.history.murders.length > prev.history.murders.length) {
    audio.play('murder');
    shake();
  }
  if (s.outcome === 'win' && !prev.outcome) audio.play('win');
  for (const ev of Object.values(s.evidence)) {
    if (ev.foundBy && !prev.evidence[ev.id]?.foundBy) {
      audio.play('sting');
      break;
    }
  }
}

export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
}
