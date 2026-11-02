/**
 * Turns commands and speeches into words. Placeholder phrasing for M2;
 * M3 replaces speech text with archetype dialogue templates.
 */
import { PLAYER_ID, type Command, type GameState, type Id, type Speech } from '../sim';

export function who(s: GameState, id: Id): string {
  return id === PLAYER_ID ? 'you' : (s.npcs[id]?.name ?? id);
}

export function room(s: GameState, id: Id | undefined): string {
  return id ? (s.rooms[id]?.name ?? id) : 'somewhere';
}

export function item(s: GameState, id: Id | undefined): string {
  return id ? (s.evidence[id]?.name ?? id) : 'something';
}

export function describeCommand(s: GameState, c: Command): string {
  switch (c.type) {
    case 'pickUp':
      return `Pick up the ${item(s, c.evidence)}`;
    case 'plant':
      return `Plant the ${item(s, c.evidence)} here`;
    case 'report':
      return `"Discover" the ${item(s, c.evidence)} and raise it at the table`;
    case 'chat':
      return `Chat with ${who(s, c.npc)}`;
    case 'ally':
      return `Propose an alliance to ${who(s, c.npc)}`;
    case 'bribe':
      return `Bribe ${who(s, c.npc)} (${s.player.bribeTokens} left)`;
    case 'endDay':
      return 'Wait for the bell (end the day)';
    default:
      return c.type;
  }
}

export function describeSpeech(s: GameState, sp: Speech): string {
  const speaker = sp.speaker === PLAYER_ID ? 'You' : who(s, sp.speaker);
  const target = sp.target ? who(s, sp.target) : 'someone';
  switch (sp.kind) {
    case 'evidence':
      return `${speaker} produce${sp.speaker === PLAYER_ID ? '' : 's'} the ${item(s, sp.evidence)} found in the ${room(s, sp.room)}${sp.target ? `. It points at ${target}.` : '.'}`;
    case 'caughtPlanting':
      return `${speaker}: "I watched you plant the ${item(s, sp.evidence)}."`;
    case 'contradiction':
      return `${speaker}: "That's not what I saw. You lied to us."`;
    case 'bribeExposed':
      return `${speaker}: "You tried to buy my vote."`;
    case 'accuse':
      return `${speaker} accuses ${target}.`;
    case 'grudge':
      return `${speaker} hasn't forgiven ${target}.`;
    case 'defend':
      return `${speaker} stands up for ${target}.`;
  }
}
