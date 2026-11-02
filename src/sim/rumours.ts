/**
 * Rumours: doubts the player seeds, which then spread NPC to NPC (plan §4.2–4.3),
 * and the Detective's cross-check of claims against what they actually saw.
 */
import { sightingsOf } from './sightings';
import { addSuspicion, aliveNpcs, getNpc, influence, log, nameOf, npcRoom, roll, roomName } from './state';
import { roomsVisitedToday } from './world';
import { PLAYER_ID, type GameState, type Id, type Npc, type Rumour, type RumourClaim } from './types';

/** What a rumour claims, as a clause: "Theo was near the Wine Cellar", "you have been acting shifty". */
export function rumourText(s: GameState, r: Pick<Rumour, 'target' | 'claim' | 'room'>): string {
  const you = r.target === PLAYER_ID;
  const name = you ? 'you' : nameOf(s, r.target);
  if (r.claim === 'seenNear' && r.room)
    return `${name} ${you ? 'were' : 'was'} near the ${roomName(s, r.room)}`;
  if (r.claim === 'hasMotive') return `${name} ${you ? 'have' : 'has'} a motive`;
  return `${name} ${you ? 'have' : 'has'} been acting shifty`;
}

export function seedDoubt(s: GameState, npcId: Id, target: Id, room: Id | undefined, isLie: boolean): void {
  const npc = getNpc(s, npcId);
  const claim: RumourClaim = room ? 'seenNear' : 'actedShifty';
  const strength = s.balance.verbs.seedDoubtStrength;

  let lieIndex: number | undefined;
  const claimText = rumourText(s, { target, claim, ...(room ? { room } : {}) });
  if (isLie) {
    lieIndex = s.player.lies.length;
    s.player.lies.push({ day: s.day, toNpc: npcId, claim: claimText });
  }

  s.rumours.push({
    id: s.nextRumourId++,
    origin: PLAYER_ID,
    teller: PLAYER_ID,
    holder: npcId,
    target,
    claim,
    ...(room ? { room } : {}),
    strength,
    day: s.day,
    isLie,
    ...(lieIndex !== undefined ? { lieIndex } : {}),
  });
  addSuspicion(s, npc, target, strength * influence(npc, PLAYER_ID));
  log(s, `You tell ${npc.name} that ${claimText}.`);
}

function sameStory(a: Rumour, b: Rumour): boolean {
  return (
    a.origin === b.origin &&
    a.target === b.target &&
    a.claim === b.claim &&
    a.room === b.room &&
    a.day === b.day
  );
}

function strongestToShare(s: GameState, teller: Npc, listener: Npc): Rumour | undefined {
  return s.rumours
    .filter((r) => r.holder === teller.id && r.target !== listener.id)
    .filter((r) => !s.rumours.some((x) => x.holder === listener.id && sameStory(x, r)))
    .sort((a, b) => b.strength - a.strength)[0];
}

/** End-of-tick pass: NPCs sharing a room may pass on their strongest rumour. */
export function rumourPass(s: GameState): void {
  const r = s.balance.rumours;
  const living = aliveNpcs(s);
  const additions: Rumour[] = [];

  for (const teller of living) {
    for (const listener of living) {
      if (teller.id === listener.id || npcRoom(s, teller) !== npcRoom(s, listener)) continue;
      if (!roll(s, r.exchangeChance)) continue;
      const rumour = strongestToShare(s, teller, listener);
      if (!rumour) continue;
      const strength = rumour.strength * r.relayFactor;
      if (strength < r.minStrength) continue;
      if (additions.some((x) => x.holder === listener.id && sameStory(x, rumour))) continue;
      additions.push({ ...rumour, id: s.nextRumourId++, teller: teller.id, holder: listener.id, strength });
      addSuspicion(s, listener, rumour.target, strength * influence(listener, teller.id));
      // A tell: whispers in your own room are overheard.
      if (npcRoom(s, teller) === s.player.room) {
        log(s, `You overhear ${teller.name} whisper to ${listener.name} that ${rumourText(s, rumour)}.`);
      }
    }
  }
  s.rumours.push(...additions);
}

/** Rumours passed NPC to NPC since `sinceId` (a previous state's nextRumourId): the whispers to show. */
export function whispersSince(s: GameState, sinceId: number): Rumour[] {
  return s.rumours.filter((r) => r.id >= sinceId && r.teller !== PLAYER_ID);
}

/** Morning: rumours fade, and weak ones are forgotten. */
export function decayRumours(s: GameState): void {
  const r = s.balance.rumours;
  s.rumours = s.rumours
    .map((x) => ({ ...x, strength: x.strength - r.decayPerDay }))
    .filter((x) => x.strength >= r.minStrength);
}

/**
 * Rumours the player started today that a living Detective holding them can disprove:
 * the Detective saw the target today, and the target was never scheduled in the claimed room.
 * Pure: used both to preview Round Table speeches and to resolve them.
 */
export function contradictions(s: GameState): { detective: Id; rumour: Rumour }[] {
  const out: { detective: Id; rumour: Rumour }[] = [];
  const seenStories: Rumour[] = [];
  for (const d of aliveNpcs(s).filter((n) => n.archetype === 'detective')) {
    for (const r of s.rumours) {
      if (r.holder !== d.id || r.origin !== PLAYER_ID || r.day !== s.day || !r.room || r.contradicted)
        continue;
      if (roomsVisitedToday(s, r.target).includes(r.room)) continue;
      if (sightingsOf(d, { subject: r.target, day: s.day }).length === 0) continue;
      if (seenStories.some((x) => sameStory(x, r))) continue;
      seenStories.push(r);
      out.push({ detective: d.id, rumour: r });
    }
  }
  return out;
}

/** Marks every copy of a disproved story as contradicted and records it against the lie. */
export function markContradicted(s: GameState, rumour: Rumour, detective: Id): void {
  for (const r of s.rumours) if (sameStory(r, rumour)) r.contradicted = true;
  if (rumour.lieIndex !== undefined) {
    const lie = s.player.lies[rumour.lieIndex];
    if (lie) lie.contradictedBy = detective;
  }
}
