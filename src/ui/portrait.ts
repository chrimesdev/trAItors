/** Portraits: a head-and-shoulders bust drawn as inline SVG from the character's look (M6). */
import { shapesToSvg } from '../app/art/draw';
import { BUST, bust, lookOf } from '../app/art/looks';
import { PLAYER_ID, type GameState, type Id } from '../sim';

export type Attitude = 'warm' | 'neutral' | 'cold';

/** How an NPC feels about the player, as a visible tell (never the number itself). */
export function attitudeOf(s: GameState, npcId: Id): Attitude {
  const v = s.npcs[npcId]?.suspicion[PLAYER_ID] ?? s.balance.suspicion.initial;
  return v < 20 ? 'warm' : v < 45 ? 'neutral' : 'cold';
}

export function portrait(s: GameState, id: Id, opts: { showAttitude?: boolean } = {}): HTMLElement {
  const el = document.createElement('div');
  el.className = 'portrait';
  el.dataset.id = id;
  const npc = s.npcs[id];
  const isPlayer = id === PLAYER_ID;
  const face = document.createElement('div');
  face.className = 'face';
  face.innerHTML = shapesToSvg(bust(lookOf(id)), BUST.w, BUST.h);
  el.appendChild(face);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = isPlayer ? 'You' : (npc?.name ?? id);
  el.appendChild(name);

  if (npc && !npc.alive) el.classList.add('dead');
  if (opts.showAttitude && npc && !isPlayer) el.classList.add(`attitude-${attitudeOf(s, id)}`);
  return el;
}
