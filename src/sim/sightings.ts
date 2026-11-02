/**
 * Sightings: who saw whom, where and when (plan §4.1).
 *
 * Memory noise is applied when the sighting is stored, so each NPC sticks to
 * one (possibly wrong) story instead of changing it every time it is asked.
 */
import { getNpc, isLiving, npcRoom, npcsInRoom, roll, rollPick } from './state';
import { PLAYER_ID, type GameState, type Id, type Npc, type Sighting } from './types';

/**
 * Records that `observerId` saw `subject` in `room` at the current tick.
 * Exported so the M2 Phaser scene can report cone hits directly.
 */
export function recordSighting(s: GameState, observerId: Id, subject: Id, room: Id): void {
  const obs = s.npcs[observerId];
  if (!obs || !obs.alive || subject === observerId) return;

  let rememberedRoom = room;
  let rememberedSubject = subject;
  let confidence = 1;
  const mem = s.balance.memory;
  const noise = mem.noise[obs.archetype];

  if (noise > 0 && roll(s, noise)) {
    switch (obs.archetype) {
      case 'sheep': {
        const adj = s.rooms[room]?.adjacent ?? [];
        if (adj.length > 0) rememberedRoom = rollPick(s, adj);
        confidence = mem.sheepMisremberConfidence;
        break;
      }
      case 'grudge': {
        const grudge = obs.lastAccusedBy;
        if (grudge && grudge !== observerId && isLiving(s, grudge)) rememberedSubject = grudge;
        confidence = mem.grudgeSwapConfidence;
        break;
      }
      case 'paranoid':
        confidence = mem.paranoidInflatedConfidence;
        break;
      default:
        // Loyalist (and anyone else with noise): simply forgets.
        return;
    }
  }

  const duplicate = obs.memory.some(
    (m) =>
      m.day === s.day && m.tick === s.tick && m.subject === rememberedSubject && m.room === rememberedRoom,
  );
  if (duplicate) return;

  obs.memory.push({
    observer: observerId,
    subject: rememberedSubject,
    room: rememberedRoom,
    day: s.day,
    tick: s.tick,
    confidence,
  });
}

/** Chance that `npc` notices the player sneaking into its room. */
export function sneakDetectChance(s: GameState, npc: Npc): number {
  if (npc.weakDetective) return s.balance.detection.weakDetectiveSneakingDetect;
  return s.balance.detection.sneakingDetect[npc.archetype];
}

/** NPCs in `room` who can see the player: everyone, or only those in `visibleTo` when cones are in play. */
export function watchers(s: GameState, room: Id, visibleTo?: Id[]): Npc[] {
  const here = npcsInRoom(s, room);
  return visibleTo ? here.filter((n) => visibleTo.includes(n.id)) : here;
}

/**
 * One detection check of the player by `npc`: always seen when walking, a roll when sneaking.
 * Each NPC gets at most one check per tick, so lingering in a cone can't be re-rolled until it succeeds.
 */
export function checkPlayer(s: GameState, npc: Npc, sneaking: boolean): boolean {
  const last = npc.lastSpotCheck;
  if (last && last.day === s.day && last.tick === s.tick) return false;
  npc.lastSpotCheck = { day: s.day, tick: s.tick };
  if (sneaking && !roll(s, sneakDetectChance(s, npc))) return false;
  recordSighting(s, npc.id, PLAYER_ID, s.player.room);
  return true;
}

/** The player has just entered `room`. NPCs who can see the doorway may notice them. */
export function playerArrives(s: GameState, room: Id, sneaking: boolean, visibleTo?: Id[]): Id[] {
  return watchers(s, room, visibleTo)
    .filter((n) => checkPlayer(s, n, sneaking))
    .map((n) => n.id);
}

/** An NPC has just entered its current room: it sees everyone there and they see it. */
export function npcArrives(s: GameState, npcId: Id): void {
  const n = getNpc(s, npcId);
  const room = npcRoom(s, n);
  if (s.player.room === room) recordSighting(s, n.id, PLAYER_ID, room);
  for (const other of npcsInRoom(s, room, n.id)) {
    recordSighting(s, n.id, other.id, room);
    recordSighting(s, other.id, n.id, room);
  }
}

export function sightingsOf(n: Npc, filter: Partial<Pick<Sighting, 'subject' | 'room' | 'day'>>): Sighting[] {
  return n.memory.filter(
    (m) =>
      (filter.subject === undefined || m.subject === filter.subject) &&
      (filter.room === undefined || m.room === filter.room) &&
      (filter.day === undefined || m.day === filter.day),
  );
}
