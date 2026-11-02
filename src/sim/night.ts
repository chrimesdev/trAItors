/**
 * Night and the following morning (plan §4.5): the murder, the body being
 * found, suspicion normalisation, and setting up the next day.
 */
import { decayRumours } from './rumours';
import { npcArrives, sightingsOf } from './sightings';
import { addSuspicion, aliveNpcs, getNpc, influence, log, roomName, topSuspect } from './state';
import { buildDaySchedules } from './world';
import { PLAYER_ID, type GameState, type Id } from './types';

export function murder(s: GameState, victimId: Id, room: Id): void {
  const victim = getNpc(s, victimId);
  // The dead remember: who was the victim onto? Read before they're gone.
  const lead = topSuspect(s, victim);
  const voiced = lead !== undefined && (victim.suspicion[lead] ?? 0) >= s.balance.roundTable.accuseThreshold;
  victim.alive = false;
  s.lastMurder = { day: s.day, victim: victimId, room, ...(voiced ? { lead } : {}) };
  s.history.murders.push({ ...s.lastMurder });
  log(s, `Under cover of the night shift, you murder ${victim.name} in the ${roomName(s, room)}.`);

  revealBody(s, victimId, room);
  if (voiced && lead) {
    for (const npc of aliveNpcs(s)) {
      if (npc.id === lead) continue;
      addSuspicion(s, npc, lead, s.balance.pressure.victimLeadPenalty * influence(npc, victimId));
    }
    log(
      s,
      `${victim.name} had been suspicious of ${lead === PLAYER_ID ? 'you' : (s.npcs[lead]?.name ?? lead)}.`,
    );
  }
  normaliseSuspicion(s);

  if (aliveNpcs(s).length <= s.balance.day.faithfulsLeftToWin) {
    s.outcome = 'win';
    s.phase = 'ended';
    log(s, 'Morning comes and too few Faithfuls remain. The Traitor wins.');
    return;
  }
  if (s.day >= s.balance.day.maxDays) {
    s.outcome = 'win';
    s.phase = 'ended';
    log(s, `You survived ${s.day} days undetected. The Traitor wins.`);
    return;
  }
  startDay(s, s.day + 1);
}

/** Anyone who remembers being near the body's room yesterday falls under suspicion. */
function revealBody(s: GameState, victimId: Id, room: Id): void {
  const n = s.balance.night;
  for (const npc of aliveNpcs(s)) {
    const seen = sightingsOf(npc, { room, day: s.day });
    const seenPlayer = seen.filter((m) => m.subject === PLAYER_ID);
    if (seenPlayer.length > 0) {
      const conf = Math.max(...seenPlayer.map((m) => m.confidence));
      addSuspicion(s, npc, PLAYER_ID, n.sawPlayerInBodyRoomPenalty * conf);
    }
    const others = new Set(seen.map((m) => m.subject).filter((id) => id !== PLAYER_ID && id !== victimId));
    for (const other of others) {
      if (!s.npcs[other]?.alive) continue;
      const conf = Math.max(...seen.filter((m) => m.subject === other).map((m) => m.confidence));
      addSuspicion(s, npc, other, n.sawNpcInBodyRoomPenalty * conf);
    }
  }
}

/** Stops suspicion from locking in: scale each NPC's scores so their maximum is the cap. */
function normaliseSuspicion(s: GameState): void {
  const cap = s.balance.night.suspicionCapAfterNight;
  for (const npc of aliveNpcs(s)) {
    const max = Math.max(...Object.values(npc.suspicion));
    if (max <= cap) continue;
    for (const id of Object.keys(npc.suspicion)) {
      npc.suspicion[id] = ((npc.suspicion[id] ?? 0) * cap) / max;
    }
  }
}

export function startDay(s: GameState, day: number): void {
  s.day = day;
  s.tick = 0;
  s.phase = 'day';
  s.actionsLeft = s.balance.day.actionBudget;
  s.player.room = s.startRoom;
  delete s.lastReveal;
  if (day > 1) decayRumours(s);
  buildDaySchedules(s);
  s.player.trail.push({ day, tick: 0, room: s.player.room });
  s.player.contactsToday = [];

  if (s.lastMurder && s.lastMurder.day === day - 1) {
    log(
      s,
      `Day ${day}. ${s.npcs[s.lastMurder.victim]?.name} is found dead in the ${roomName(s, s.lastMurder.room)}.`,
    );
  } else {
    log(s, `Day ${day}. The Faithfuls gather in the ${roomName(s, s.player.room)}.`);
  }
  for (const npc of aliveNpcs(s)) npcArrives(s, npc.id);
}
