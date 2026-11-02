/**
 * Tells (M5): how the Faithfuls' feelings leak into the mansion. Rules decide
 * *who* is wary; the scene decides how a glance looks.
 */
import { aliveNpcs, log, npcRoom } from './state';
import { PLAYER_ID, type GameState, type Id, type Npc } from './types';

/** True if this NPC suspects the player enough to watch them. */
export function isWary(s: GameState, n: Npc): boolean {
  return (
    n.alive && (n.suspicion[PLAYER_ID] ?? s.balance.suspicion.initial) >= s.balance.tells.glanceSuspicion
  );
}

/** Living NPCs sharing the player's room who are wary of them: the ones whose eyes follow you. */
export function watchingYou(s: GameState): Id[] {
  return aliveNpcs(s)
    .filter((n) => npcRoom(s, n) === s.player.room && isWary(s, n))
    .map((n) => n.id);
}

/** The player has just been noticed by these NPCs: the wary ones keep looking. */
export function noteGlances(s: GameState, noticedBy: Id[]): void {
  for (const id of noticedBy) {
    const n = s.npcs[id];
    if (n && isWary(s, n)) log(s, `${n.name}'s eyes follow you.`);
  }
}

/** An NPC has walked in on the player: a wary one makes it obvious. */
export function noteArrivalGlance(s: GameState, npcId: Id): void {
  const n = s.npcs[npcId];
  if (!n || npcRoom(s, n) !== s.player.room || !isWary(s, n)) return;
  log(s, `${n.name} comes in and doesn't take their eyes off you.`);
}
