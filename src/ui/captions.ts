/**
 * Subtitles: new log lines about the world (someone spots you, a whisper, a glance)
 * appear one at a time along the bottom of the map, so they aren't missed in the
 * sidebar. Your own routine actions are left out.
 */
import type { GameState } from '../sim';

const SHOW_MS = 3200;
const QUIET = /^You (walk|creep|wait|chat|tell|propose|slip)/;

export function mountCaptions(
  overlay: HTMLElement,
  busy: () => boolean,
): { render(s: GameState, prev: GameState | null): void } {
  const el = document.createElement('div');
  el.className = 'captions';
  el.hidden = true;
  overlay.appendChild(el);
  const queue: string[] = [];
  let until = 0;

  window.setInterval(() => {
    const now = Date.now();
    if (!el.hidden && now >= until) el.hidden = true;
    if (el.hidden && queue.length && !busy()) {
      el.textContent = queue.shift() ?? '';
      el.hidden = false;
      until = now + SHOW_MS;
    }
  }, 120);

  return {
    render(s, prev) {
      if (!prev || s.seed !== prev.seed) {
        queue.length = 0;
        el.hidden = true;
        return;
      }
      for (const entry of s.log.slice(prev.log.length)) {
        if (entry.phase === 'day' && !QUIET.test(entry.text)) queue.push(entry.text);
      }
      // Never let a backlog build up: only the newest few matter.
      if (queue.length > 4) queue.splice(0, queue.length - 4);
    },
  };
}
