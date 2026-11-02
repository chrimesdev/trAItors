/**
 * Read-only questions about what the *player* knows. The UI uses these to offer
 * honest options (things you actually saw) and to mark everything else as a lie.
 */
import type { GameState, Id } from './types';

/** The room the player was in at `tick` today. */
export function playerRoomAt(s: GameState, tick: number): Id {
  let room = s.startRoom;
  for (const step of s.player.trail) {
    if (step.day === s.day && step.tick <= tick) room = step.room;
  }
  return room;
}

/** Rooms the player has been in today, in visiting order, without repeats. */
export function roomsPlayerVisitedToday(s: GameState): Id[] {
  return [...new Set(s.player.trail.filter((t) => t.day === s.day).map((t) => t.room))];
}

/** Rooms where the player has personally seen `target` so far today. */
export function playerSawToday(s: GameState, target: Id): Id[] {
  const npc = s.npcs[target];
  if (!npc) return [];
  const last = Math.min(s.tick, s.balance.day.ticksPerDay - 1);
  const rooms: Id[] = [];
  for (let t = 0; t <= last; t++) {
    const room = npc.schedule[t];
    if (room && room === playerRoomAt(s, t) && !rooms.includes(room)) rooms.push(room);
  }
  return rooms;
}

/** Where an NPC is right now (the end-of-day tick counts as the last slot). */
export function npcRoomOf(s: GameState, npcId: Id): Id | undefined {
  return s.npcs[npcId]?.schedule[Math.min(s.tick, s.balance.day.ticksPerDay - 1)];
}
