/**
 * Core simulation types (implementation plan §3, extended where M1 needed it).
 * Pure data only: everything here must survive JSON.stringify / JSON.parse.
 */
import type { Balance } from './balance';
import type { RngState } from './rng';

export type Id = string;
export type Phase = 'day' | 'roundTable' | 'night' | 'ended';
export type Archetype = 'detective' | 'sheep' | 'loyalist' | 'grudge' | 'paranoid';
export const PLAYER_ID = 'player';

// ---------------------------------------------------------------- content

export interface Room {
  id: Id;
  name: string;
  adjacent: Id[];
}

export interface NpcContent {
  id: Id;
  name: string;
  archetype: Archetype;
  weakDetective?: boolean;
  /** Base room per tick; wander rolls perturb it each day. */
  schedule: Id[];
}

export interface EvidenceContent {
  id: Id;
  name: string;
  belongsTo: Id | null;
  room: Id;
}

export interface Content {
  startRoom: Id;
  rooms: Room[];
  npcs: NpcContent[];
  evidence: EvidenceContent[];
}

// ---------------------------------------------------------------- state

export interface Sighting {
  observer: Id;
  subject: Id;
  room: Id;
  day: number;
  tick: number;
  /** Scales any suspicion derived from this sighting. */
  confidence: number;
}

export interface Npc {
  id: Id;
  name: string;
  archetype: Archetype;
  weakDetective: boolean;
  alive: boolean;
  baseSchedule: Id[];
  /** Today's schedule: tick -> roomId. Regenerated each morning. */
  schedule: Record<number, Id>;
  /** target (npc id or 'player') -> 0..100. */
  suspicion: Record<Id, number>;
  /** What they believe they saw (already distorted by memory noise). */
  memory: Sighting[];
  lastAccusedBy?: Id;
  allyOf?: Id;
  /** -1..1 toward each other character. Drives influence and the trust web. */
  trusts: Record<Id, number>;
  bribedDay?: number;
  /** Last tick a sight-cone check against the player was rolled (once per tick). */
  lastSpotCheck?: { day: number; tick: number };
  /** Day on which this NPC will mention a bribe at the Round Table. */
  exposeBribeDay?: number;
}

export interface Evidence {
  id: Id;
  name: string;
  /** Who it incriminates by default; null = whoever the finder saw in the room. */
  belongsTo: Id | null;
  /** Room id, 'player' (in inventory) or 'destroyed' (taken into custody / out of play). */
  location: Id;
  plantedBy?: Id;
  plantedDay?: number;
  foundBy?: Id;
  foundDay?: number;
  foundIn?: Id;
  /** Someone watched it being planted. */
  witnessed?: boolean;
}

export type RumourClaim = 'seenNear' | 'actedShifty' | 'hasMotive';

export interface Rumour {
  id: number;
  /** Who first said it. */
  origin: Id;
  /** Who told the holder. */
  teller: Id;
  /** Who now believes it. */
  holder: Id;
  target: Id;
  claim: RumourClaim;
  room?: Id;
  strength: number;
  day: number;
  isLie: boolean;
  lieIndex?: number;
  contradicted?: boolean;
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

export interface TrailStep {
  day: number;
  tick: number;
  room: Id;
}

export interface ChatReveal {
  npc: Id;
  /** Their top suspects among the other Faithfuls, most suspected first. */
  suspects: Id[];
  /** How they feel about you, without giving away the number. */
  attitude: 'warm' | 'neutral' | 'cold';
  /** What they remember seeing today. */
  sightings: { subject: Id; room: Id; tick: number }[];
}

export type PlayerStatement =
  | { kind: 'accuse'; target: Id; isLie: boolean }
  | { kind: 'defend'; target: Id; isLie: boolean }
  | { kind: 'alibi'; room: Id; isLie: boolean }
  | { kind: 'quiet' };

export type SpeechKind =
  | 'evidence'
  | 'caughtPlanting'
  | 'contradiction'
  | 'bribeExposed'
  | 'accuse'
  | 'defend'
  | 'grudge'
  | 'alibiConfirmed'
  | 'alibiDisproved';

/** Structured speech. Dialogue templates (M3) turn these into words. */
export interface Speech {
  speaker: Id;
  kind: SpeechKind;
  target?: Id;
  evidence?: Id;
  room?: Id;
  rumourId?: number;
}

export interface TableRecord {
  day: number;
  speeches: Speech[];
  statement: PlayerStatement;
  /** How the table reacted to the player's statement (e.g. a Detective checking an alibi). */
  reactions: Speech[];
  votes: Record<Id, Id>;
  banished: Id;
}

export interface GameState {
  seed: number;
  rng: RngState;
  balance: Balance;
  startRoom: Id;
  day: number;
  phase: Phase;
  tick: number;
  actionsLeft: number;
  player: {
    room: Id;
    inventory: Id[];
    lies: Lie[];
    shield: boolean;
    bribeTokens: number;
    trail: TrailStep[];
  };
  npcs: Record<Id, Npc>;
  rooms: Record<Id, Room>;
  evidence: Record<Id, Evidence>;
  rumours: Rumour[];
  nextRumourId: number;
  log: LogEntry[];
  lastReveal?: ChatReveal;
  lastVote?: { day: number; votes: Record<Id, Id>; banished: Id };
  /** Everything that happened at the last Round Table, in order, for the UI to replay. */
  lastTable?: TableRecord;
  lastMurder?: { day: number; victim: Id; room: Id };
  outcome?: 'win' | 'lose';
}

export type Command =
  /**
   * visibleTo (optional): NPCs whose sight cone covers the player at that moment.
   * The presentation layer supplies it; when omitted (bots, tests) everyone in the room can see.
   */
  | { type: 'move'; to: Id; sneaking: boolean; visibleTo?: Id[] }
  | { type: 'pickUp'; evidence: Id; visibleTo?: Id[] }
  | { type: 'plant'; evidence: Id; room: Id; visibleTo?: Id[] }
  /** Free action: the player stepped into an NPC's sight cone. */
  | { type: 'spotted'; npc: Id; sneaking: boolean }
  | { type: 'report'; evidence: Id }
  | { type: 'chat'; npc: Id }
  | { type: 'seedDoubt'; npc: Id; target: Id; room?: Id; isLie: boolean }
  | { type: 'ally'; npc: Id }
  | { type: 'bribe'; npc: Id }
  | { type: 'endDay' }
  | { type: 'resolveRoundTable'; playerVote: Id; statement?: PlayerStatement }
  | { type: 'murder'; victim: Id; room: Id };
