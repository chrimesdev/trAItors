/**
 * Short labels for names, rooms, items and menu commands.
 * Speech lines come from the dialogue templates (sim/dialogue.ts).
 */
import { PLAYER_ID, type Command, type GameState, type Id } from '../sim';

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
