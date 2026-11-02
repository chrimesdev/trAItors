/**
 * Core simulation types (implementation plan §3).
 * Pure data only: everything here must survive JSON.stringify / JSON.parse.
 */
import type { RngState } from './rng';

export type Id = string;
export type Phase = 'day' | 'roundTable' | 'night' | 'ended';
export type Archetype = 'detective' | 'sheep' | 'loyalist' | 'grudge' | 'paranoid';
export const PLAYER_ID = 'player';

export interface Room {
  id: Id;
  name: string;
  adjacent: Id[];
}

export interface Sighting {
  observer: Id;
  subject: Id;
  room: Id;
  day: number;
  tick: number;
  confidence: number;
}

export interface Npc {
  id: Id;
  name: string;
  archetype: Archetype;
  alive: boolean;
  /** dayTick -> roomId (ticks 0..ticksPerDay-1). */
  schedule: Record<number, Id>;
  /** target (npc id or 'player') -> 0..100. */
  suspicion: Record<Id, number>;
  memory: Sighting[];
  lastAccusedBy?: Id;
  allyOf?: Id;
  /** -1..1, drives the trust web and alliances. */
  trusts: Record<Id, number>;
}

export interface Evidence {
  id: Id;
  name: string;
  /** Who it incriminates by default; null = whoever is seen with it. */
  belongsTo: Id | null;
  location: Id | typeof PLAYER_ID | 'destroyed';
  plantedBy?: Id;
  plantedDay?: number;
  foundBy?: Id;
  foundDay?: number;
}

export type RumourClaim = 'seenNear' | 'actedShifty' | 'hasMotive';

export interface Rumour {
  source: Id;
  target: Id;
  claim: RumourClaim;
  room?: Id;
  strength: number;
  day: number;
  isLie: boolean;
}

export interface Lie {
  day: number;
  toNpc: Id;
  claim: string;
  contradictedBy?: Id;
}

export interface LogEntry {
  day: number;
  tick: number;
  phase: Phase;
  text: string;
}

export interface GameState {
  seed: number;
  rng: RngState;
  day: number;
  phase: Phase;
  tick: number;
  actionsLeft: number;
  player: {
    room: Id;
    inventory: Id[];
    lies: Lie[];
    shield: boolean;
  };
  npcs: Record<Id, Npc>;
  rooms: Record<Id, Room>;
  evidence: Record<Id, Evidence>;
  rumours: Rumour[];
  log: LogEntry[];
  lastVote?: { votes: Record<Id, Id>; banished: Id };
  outcome?: 'win' | 'lose';
}

export type Command =
  | { type: 'move'; to: Id; sneaking: boolean }
  | { type: 'pickUp'; evidence: Id }
  | { type: 'plant'; evidence: Id; room: Id }
  | { type: 'chat'; npc: Id }
  | { type: 'seedDoubt'; npc: Id; target: Id; room?: Id; isLie: boolean }
  | { type: 'ally'; npc: Id }
  | { type: 'bribe'; npc: Id }
  | { type: 'endDay' }
  | { type: 'resolveRoundTable' }
  | { type: 'murder'; victim: Id; room: Id };
