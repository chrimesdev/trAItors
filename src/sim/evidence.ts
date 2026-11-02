/**
 * Evidence: picking up, planting, reporting and NPC discovery (plan §4.1).
 *
 * Only evidence the player has moved can be discovered by NPCs; untouched items
 * are just props waiting to be used. Provenance matters: whoever finds an item,
 * and who they saw near it, shapes who gets blamed.
 */
import { sightingsOf } from './sightings';
import { addSuspicion, aliveNpcs, isLiving, log, nameOf, npcRoom, npcsInRoom, roll, roomName } from './state';
import { PLAYER_ID, type Evidence, type GameState, type Id, type Npc } from './types';

const OUT_OF_PLAY = 'destroyed';

export function getEvidence(s: GameState, id: Id): Evidence {
  const ev = s.evidence[id];
  if (!ev) throw new Error(`Unknown evidence "${id}"`);
  return ev;
}

export function pickUp(s: GameState, id: Id): void {
  const ev = getEvidence(s, id);
  const room = s.player.room;
  ev.location = PLAYER_ID;
  s.player.inventory.push(id);
  log(s, `You pick up the ${ev.name} in the ${roomName(s, room)}.`);
  for (const w of npcsInRoom(s, room)) {
    addSuspicion(s, w, PLAYER_ID, s.balance.evidence.witnessedPickUpPenalty);
    log(s, `${w.name} watches you pocket something.`);
  }
}

export function plant(s: GameState, id: Id, room: Id): void {
  const ev = getEvidence(s, id);
  s.player.inventory = s.player.inventory.filter((x) => x !== id);
  ev.location = room;
  ev.plantedBy = PLAYER_ID;
  ev.plantedDay = s.day;
  log(s, `You plant the ${ev.name} in the ${roomName(s, room)}.`);

  const witnesses = npcsInRoom(s, room);
  if (witnesses.length === 0) return;

  // Caught in the act: the item is taken into custody and becomes evidence against you.
  ev.witnessed = true;
  ev.location = OUT_OF_PLAY;
  ev.foundBy = witnesses[0]?.id;
  ev.foundDay = s.day;
  ev.foundIn = room;
  for (const w of witnesses) {
    addSuspicion(s, w, PLAYER_ID, s.balance.evidence.witnessedPlantPenalty);
    log(s, `${w.name} sees you plant the ${ev.name}!`);
  }
}

/** The player "discovers" an item in their room and will raise it at the Round Table. */
export function report(s: GameState, id: Id): void {
  const ev = getEvidence(s, id);
  ev.foundBy = PLAYER_ID;
  ev.foundDay = s.day;
  ev.foundIn = s.player.room;
  ev.location = OUT_OF_PLAY;
  log(s, `You "discover" the ${ev.name} in the ${roomName(s, s.player.room)}.`);
}

/** Who an item points at when `finder` finds it in `room` today. */
export function incriminatedBy(s: GameState, ev: Evidence, finder: Npc, room: Id): Id | undefined {
  if (ev.belongsTo && ev.belongsTo !== finder.id) {
    return isLiving(s, ev.belongsTo) ? ev.belongsTo : undefined;
  }
  // Unowned item, or the finder's own belonging turning up somewhere it shouldn't:
  // blame the last person they saw in that room today.
  const seen = sightingsOf(finder, { room, day: s.day }).filter(
    (m) => m.subject !== finder.id && isLiving(s, m.subject),
  );
  return seen[seen.length - 1]?.subject;
}

function discover(s: GameState, finder: Npc, ev: Evidence, room: Id): void {
  const b = s.balance.evidence;
  ev.foundBy = finder.id;
  ev.foundDay = s.day;
  ev.foundIn = room;
  ev.location = OUT_OF_PLAY;

  const target = incriminatedBy(s, ev, finder, room);
  if (target) addSuspicion(s, finder, target, b.suspicionOnDiscovery);

  // Provenance: did they see you near where it turned up?
  const sawPlayer = sightingsOf(finder, { subject: PLAYER_ID, room, day: s.day });
  if (sawPlayer.length > 0) {
    const conf = Math.max(...sawPlayer.map((m) => m.confidence));
    addSuspicion(s, finder, PLAYER_ID, b.finderSawPlayerInRoomPenalty * conf);
  }

  log(
    s,
    `${finder.name} finds the ${ev.name} in the ${roomName(s, room)}` +
      (target ? ` and eyes ${nameOf(s, target)}.` : '.'),
  );
}

/** End-of-tick pass: NPCs may stumble on planted evidence in their room. */
export function discoveryPass(s: GameState): void {
  const b = s.balance.evidence;
  for (const n of aliveNpcs(s)) {
    const room = npcRoom(s, n);
    for (const ev of Object.values(s.evidence)) {
      if (ev.location !== room || ev.foundBy || ev.plantedBy === undefined) continue;
      const p = n.archetype === 'detective' ? b.detectiveDiscoverChancePerTick : b.discoverChancePerTick;
      if (roll(s, p)) discover(s, n, ev, room);
    }
  }
}

/** Evidence found today, in the order it should be raised at the Round Table. */
export function foundToday(s: GameState): Evidence[] {
  return Object.values(s.evidence).filter(
    (ev) => ev.foundDay === s.day && ev.foundBy !== undefined && isLiving(s, ev.foundBy),
  );
}
