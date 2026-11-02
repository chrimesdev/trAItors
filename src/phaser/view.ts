/** Small read-only helpers the presentation layer shares. No game rules here. */
import type { GameState, Id } from '../sim';

export type { GameState, Id } from '../sim';

export function aliveOnly(s: GameState, ids: Id[]): Id[] {
  return ids.filter((id) => s.npcs[id]?.alive);
}

export function npcRoomNow(s: GameState, id: Id): Id | undefined {
  return s.npcs[id]?.schedule[Math.min(s.tick, s.balance.day.ticksPerDay - 1)];
}
