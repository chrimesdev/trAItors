/**
 * Turns structured speeches into words using content/dialogue.json (plan §5.4).
 *
 * Pure and deterministic, and it never consumes the game RNG: the line variant
 * is chosen by hashing who is speaking, about what, on which day. The same
 * speech always reads the same, and the UI can preview it before resolving.
 */
import dialogue from '../content/dialogue.json';
import { PLAYER_ID, type Archetype, type GameState, type Id, type Speech } from './types';

type Band = 'mid' | 'high' | 'any';
type Lines = Partial<Record<Band, string[]>>;
type ByArchetype = Partial<Record<Archetype | 'default', Lines>>;

const SPEECH = dialogue.speech as Record<string, ByArchetype>;
const GREET = dialogue.greet as Record<Archetype, Record<'warm' | 'neutral' | 'cold', string[]>>;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function choose(lines: string[], key: string): string {
  return lines[hash(key) % lines.length] ?? '';
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function nameFor(s: GameState, id: Id | undefined): string {
  if (!id) return 'someone';
  if (id === PLAYER_ID) return 'you';
  return s.npcs[id]?.name ?? id;
}

export function fill(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const lower = key.charAt(0).toLowerCase() + key.slice(1);
    const value = slots[lower];
    if (value === undefined) return match;
    return key === lower ? value : capitalise(value);
  });
}

function speechKey(sp: Speech): string {
  if (sp.kind === 'evidence' && sp.speaker === PLAYER_ID) return 'evidenceByPlayer';
  if (sp.kind === 'evidence' && !sp.target) return 'evidenceUnknown';
  return sp.kind;
}

function linesFor(s: GameState, sp: Speech, key: string): string[] {
  const byArchetype = SPEECH[key];
  if (!byArchetype) return [];
  const archetype = s.npcs[sp.speaker]?.archetype;
  const lines = (archetype && byArchetype[archetype]) || byArchetype.default || {};
  const strength = sp.target ? (s.npcs[sp.speaker]?.suspicion[sp.target] ?? 0) : 0;
  const band: Band = strength >= 50 ? 'high' : 'mid';
  return lines[band] ?? lines.any ?? lines.mid ?? lines.high ?? [];
}

/** What a speech sounds like out loud. */
export function speak(s: GameState, sp: Speech): string {
  const key = speechKey(sp);
  const lines = linesFor(s, sp, key);
  if (lines.length === 0) return `${nameFor(s, sp.speaker)}: (${sp.kind})`;
  const rumour = sp.rumourId !== undefined ? s.rumours.find((r) => r.id === sp.rumourId) : undefined;
  const template = choose(lines, `${sp.speaker}|${key}|${sp.target ?? ''}|${s.day}`);
  return fill(template, {
    speaker: nameFor(s, sp.speaker),
    target: nameFor(s, sp.target),
    room: s.rooms[sp.room ?? rumour?.room ?? '']?.name ?? 'that room',
    item: s.evidence[sp.evidence ?? '']?.name.toLowerCase() ?? 'evidence',
    about: nameFor(s, rumour?.target),
  });
}

/** How an NPC greets the player, by how they feel about them. */
export function greet(s: GameState, npcId: Id): string {
  const npc = s.npcs[npcId];
  if (!npc) return '';
  const toward = npc.suspicion[PLAYER_ID] ?? s.balance.suspicion.initial;
  const mood = toward < 20 ? 'warm' : toward < 45 ? 'neutral' : 'cold';
  return choose(GREET[npc.archetype][mood], `${npcId}|greet|${s.day}|${s.tick}`);
}
