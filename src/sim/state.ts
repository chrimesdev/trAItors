/**
 * Internal helpers shared by the rule modules.
 *
 * applyCommand clones the incoming state once and then the rule modules
 * mutate that private draft. Nothing outside src/sim ever sees a draft, so the
 * public API stays pure (rule 3 in AGENTS.md).
 */
import { chance, nextFloat, pick } from './rng';
import { PLAYER_ID, type GameState, type Id, type Npc } from './types';

export function log(s: GameState, text: string): void {
  s.log.push({ day: s.day, tick: s.tick, phase: s.phase, text });
}

export function nameOf(s: GameState, id: Id): string {
  if (id === PLAYER_ID) return 'You';
  return s.npcs[id]?.name ?? id;
}

export function roomName(s: GameState, id: Id): string {
  return s.rooms[id]?.name ?? id;
}

/** NPCs in content order (object key order survives clone and JSON). */
export function npcList(s: GameState): Npc[] {
  return Object.values(s.npcs);
}

export function aliveNpcs(s: GameState): Npc[] {
  return npcList(s).filter((n) => n.alive);
}

export function getNpc(s: GameState, id: Id): Npc {
  const n = s.npcs[id];
  if (!n) throw new Error(`Unknown NPC "${id}"`);
  return n;
}

/** Where an NPC is right now. Clamps the end-of-day tick to the last slot. */
export function npcRoom(s: GameState, n: Npc): Id {
  const last = s.balance.day.ticksPerDay - 1;
  const room = n.schedule[Math.min(s.tick, last)];
  if (room === undefined) throw new Error(`${n.id} has no schedule for tick ${s.tick}`);
  return room;
}

export function npcsInRoom(s: GameState, room: Id, exceptId?: Id): Npc[] {
  return aliveNpcs(s).filter((n) => n.id !== exceptId && npcRoom(s, n) === room);
}

/** True if id is the player or a living NPC. */
export function isLiving(s: GameState, id: Id): boolean {
  return id === PLAYER_ID || s.npcs[id]?.alive === true;
}

export function clampSuspicion(s: GameState, value: number): number {
  return Math.max(0, Math.min(s.balance.suspicion.max, value));
}

export function addSuspicion(s: GameState, n: Npc, target: Id, delta: number): void {
  if (target === n.id || delta === 0) return;
  const before = n.suspicion[target] ?? s.balance.suspicion.initial;
  n.suspicion[target] = clampSuspicion(s, before + delta);
}

export function addTrust(n: Npc, toward: Id, delta: number): void {
  if (toward === n.id) return;
  const before = n.trusts[toward] ?? 0;
  n.trusts[toward] = Math.max(-1, Math.min(1, before + delta));
}

/** 0..1 multiplier for how much `listener` is moved by what `speaker` says. Neutral trust = 0.5. */
export function influence(listener: Npc, speaker: Id): number {
  return (1 + (listener.trusts[speaker] ?? 0)) / 2;
}

/** The living character this NPC suspects most, excluding itself and anything in `exclude`. */
export function topSuspect(s: GameState, n: Npc, exclude: Id[] = []): Id | undefined {
  let best: Id | undefined;
  let bestScore = -Infinity;
  // Player last + strict '>' means exact ties never land on the player.
  const candidates = [...aliveNpcs(s).map((x) => x.id), PLAYER_ID];
  for (const id of candidates) {
    if (id === n.id || exclude.includes(id)) continue;
    const score = n.suspicion[id] ?? s.balance.suspicion.initial;
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

// RNG wrappers that thread state.rng through the draft.

export function roll(s: GameState, probability: number): boolean {
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  const [hit, next] = chance(s.rng, probability);
  s.rng = next;
  return hit;
}

export function rollPick<T>(s: GameState, items: readonly T[]): T {
  const [item, next] = pick(s.rng, items);
  s.rng = next;
  return item;
}

export function rollFloat(s: GameState): number {
  const [f, next] = nextFloat(s.rng);
  s.rng = next;
  return f;
}
