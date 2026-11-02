/** Bottom-left event feed: the last few log lines, newest highlighted. */
import type { GameState } from '../sim';

const LINES = 12;

export function mountFeed(overlay: HTMLElement): { render(s: GameState, prev: GameState | null): void } {
  const el = document.createElement('div');
  el.className = 'feed panel';
  overlay.appendChild(el);

  return {
    render(s, prev) {
      const fresh = prev ? s.log.length - prev.log.length : 0;
      const lines = s.log.slice(-LINES);
      el.innerHTML = '';
      lines.forEach((entry, i) => {
        const p = document.createElement('p');
        p.textContent = entry.text;
        if (i >= lines.length - fresh) p.className = 'new';
        el.appendChild(p);
      });
    },
  };
}
