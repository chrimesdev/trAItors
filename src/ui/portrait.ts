/** Placeholder portraits: a coloured disc with an initial. Real portraits arrive in M6. */
import { ARCHETYPE_COLOUR, PLAYER_COLOUR, cssColour } from '../app/palette';
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
  const colour = isPlayer ? PLAYER_COLOUR : npc ? ARCHETYPE_COLOUR[npc.archetype] : 0x888888;
  const face = document.createElement('div');
  face.className = 'face';
  face.style.background = cssColour(colour);
  face.textContent = isPlayer ? 'You' : (npc?.name.charAt(0) ?? '?');
  el.appendChild(face);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = isPlayer ? 'You' : (npc?.name ?? id);
  el.appendChild(name);

  if (npc && !npc.alive) el.classList.add('dead');
  if (opts.showAttitude && npc && !isPlayer) el.classList.add(`attitude-${attitudeOf(s, id)}`);
  return el;
}
