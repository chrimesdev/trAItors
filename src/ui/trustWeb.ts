/**
 * The trust web: lines between seated characters, thicker for stronger feeling,
 * green for trust and red for distrust. Redrawn after each vote so you can watch
 * alliances shift.
 */
import { PLAYER_ID, type GameState, type Id } from '../sim';

const SVG = 'http://www.w3.org/2000/svg';

export interface Seat {
  id: Id;
  /** Percent of the ring box. */
  x: number;
  y: number;
}

/** Mutual trust between two characters, -1..1. The player has no trust values, so only theirs counts. */
export function mutualTrust(s: GameState, a: Id, b: Id): number {
  const ab = a === PLAYER_ID ? undefined : s.npcs[a]?.trusts[b];
  const ba = b === PLAYER_ID ? undefined : s.npcs[b]?.trusts[a];
  const values = [ab, ba].filter((v): v is number => v !== undefined);
  return values.length ? values.reduce((x, y) => x + y, 0) / values.length : 0;
}

export function createTrustWeb(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'trust-web');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  return svg;
}

export function drawTrustWeb(svg: SVGSVGElement, s: GameState, seats: Seat[]): void {
  const seen = new Set<string>();
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const a = seats[i] as Seat;
      const b = seats[j] as Seat;
      const key = `${a.id}|${b.id}`;
      seen.add(key);
      let line = svg.querySelector<SVGLineElement>(`line[data-key="${key}"]`);
      if (!line) {
        line = document.createElementNS(SVG, 'line');
        line.dataset.key = key;
        line.setAttribute('x1', String(a.x));
        line.setAttribute('y1', String(a.y));
        line.setAttribute('x2', String(b.x));
        line.setAttribute('y2', String(b.y));
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(line);
      }
      const deadA = a.id !== PLAYER_ID && !s.npcs[a.id]?.alive;
      const deadB = b.id !== PLAYER_ID && !s.npcs[b.id]?.alive;
      const t = deadA || deadB ? 0 : mutualTrust(s, a.id, b.id);
      const strength = Math.min(1, Math.abs(t));
      line.style.stroke = t >= 0 ? 'var(--trust)' : 'var(--accent)';
      line.style.strokeWidth = `${strength < 0.05 ? 0 : 1 + strength * 6}px`;
      line.style.opacity = String(strength < 0.05 ? 0 : 0.25 + strength * 0.6);
    }
  }
  for (const line of svg.querySelectorAll<SVGLineElement>('line')) {
    if (!seen.has(line.dataset.key ?? '')) line.remove();
  }
}
