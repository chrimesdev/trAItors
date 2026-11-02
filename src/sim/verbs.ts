/** The room verbs other than seedDoubt (plan §4.2): chat, ally, bribe. */
import { sightingsOf } from './sightings';
import { addSuspicion, addTrust, aliveNpcs, getNpc, log, roll } from './state';
import { PLAYER_ID, type ChatReveal, type GameState, type Id } from './types';

export function chat(s: GameState, npcId: Id): void {
  const npc = getNpc(s, npcId);
  const others = aliveNpcs(s).filter((n) => n.id !== npcId);
  const suspects = others
    .map((n) => ({ id: n.id, score: npc.suspicion[n.id] ?? s.balance.suspicion.initial }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((x) => x.id);

  const toward = npc.suspicion[PLAYER_ID] ?? s.balance.suspicion.initial;
  const attitude: ChatReveal['attitude'] = toward < 20 ? 'warm' : toward < 45 ? 'neutral' : 'cold';

  const sightings = sightingsOf(npc, { day: s.day })
    .filter((m) => m.subject !== PLAYER_ID)
    .slice(-3)
    .map((m) => ({ subject: m.subject, room: m.room, tick: m.tick }));

  s.lastReveal = { npc: npcId, suspects, attitude, sightings };
  log(s, `You chat with ${npc.name}.`);
  const names = suspects.map((id) => s.npcs[id]?.name ?? id);
  const seen = sightings.map(
    (m) => `${s.npcs[m.subject]?.name ?? m.subject} in the ${s.rooms[m.room]?.name ?? m.room}`,
  );
  log(
    s,
    `${npc.name} suspects ${names.length ? names.join(' and ') : 'nobody in particular'}` +
      (seen.length ? `, and saw ${seen.join(', ')}.` : '.'),
  );
}

export function ally(s: GameState, npcId: Id): void {
  const npc = getNpc(s, npcId);
  const v = s.balance.verbs;
  addTrust(npc, PLAYER_ID, v.allyTrustGain);
  if (npc.archetype === 'loyalist' && !npc.allyOf) npc.allyOf = PLAYER_ID;
  if (npc.archetype === 'paranoid') addSuspicion(s, npc, PLAYER_ID, v.paranoidAllyPenalty);
  log(s, `You propose an alliance to ${npc.name}.`);
}

export function bribe(s: GameState, npcId: Id): void {
  const npc = getNpc(s, npcId);
  s.player.bribeTokens -= 1;
  npc.bribedDay = s.day;
  if (npc.archetype === 'sheep' && roll(s, s.balance.verbs.sheepMentionsBribeChance)) {
    npc.exposeBribeDay = s.day;
  }
  log(s, `You slip ${npc.name} something to keep your name out of their mouth.`);
}
