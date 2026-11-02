/** Rooms, adjacency and daily NPC schedules. */
import { aliveNpcs, roll, rollPick } from './state';
import type { GameState, Id } from './types';

export function isAdjacent(s: GameState, from: Id, to: Id): boolean {
  return s.rooms[from]?.adjacent.includes(to) ?? false;
}

/**
 * Builds today's schedule for every living NPC from its base schedule,
 * with a per-tick chance of wandering into an adjacent room. Called each morning.
 */
export function buildDaySchedules(s: GameState): void {
  const ticks = s.balance.day.ticksPerDay;
  for (const n of aliveNpcs(s)) {
    const today: Record<number, Id> = {};
    for (let t = 0; t < ticks; t++) {
      const base = n.baseSchedule[t % n.baseSchedule.length];
      if (base === undefined) throw new Error(`${n.id} has an empty schedule`);
      const adjacent = s.rooms[base]?.adjacent ?? [];
      today[t] =
        adjacent.length > 0 && roll(s, s.balance.schedule.wanderChance) ? rollPick(s, adjacent) : base;
    }
    n.schedule = today;
  }
}

/** Every room an NPC is scheduled to visit today. */
export function roomsVisitedToday(s: GameState, npcId: Id): Id[] {
  const n = s.npcs[npcId];
  return n ? Object.values(n.schedule) : [];
}
