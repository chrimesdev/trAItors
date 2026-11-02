/**
 * The simulation's public entry points:
 *   createGame(seed, content, balance?) -> GameState
 *   applyCommand(state, command)        -> GameState   (pure)
 *   validateCommand(state, command)     -> string | null
 *   legalCommands(state)                -> Command[]
 */
import { BALANCE, type Balance } from './balance';
import { discoveryPass, plant, pickUp, report } from './evidence';
import { murder, startDay } from './night';
import { createRng } from './rng';
import { resolveRoundTable } from './roundTable';
import { rumourPass, seedDoubt } from './rumours';
import { checkPlayer, npcArrives, playerArrives } from './sightings';
import { noteArrivalGlance, noteGlances } from './tells';
import { aliveNpcs, log, nameOf, npcRoom, rollFloat, roomName } from './state';
import { ally, bribe, chat } from './verbs';
import { isAdjacent, roomsVisitedToday } from './world';
import {
  PLAYER_ID,
  type Command,
  type Content,
  type Evidence,
  type GameState,
  type Id,
  type Npc,
  type Room,
} from './types';

export class InvalidCommandError extends Error {
  constructor(
    readonly command: Command,
    reason: string,
  ) {
    super(`Invalid command ${command.type}: ${reason}`);
    this.name = 'InvalidCommandError';
  }
}

export function createGame(seed: number, content: Content, balance: Balance = BALANCE): GameState {
  const ids = content.npcs.map((n) => n.id);
  const npcs: Record<Id, Npc> = {};
  for (const c of content.npcs) {
    const suspicion: Record<Id, number> = { [PLAYER_ID]: balance.suspicion.initial };
    const trusts: Record<Id, number> = { [PLAYER_ID]: 0 };
    for (const other of ids) {
      if (other === c.id) continue;
      suspicion[other] = balance.suspicion.initial;
      trusts[other] = 0;
    }
    npcs[c.id] = {
      id: c.id,
      name: c.name,
      archetype: c.archetype,
      weakDetective: c.weakDetective ?? false,
      alive: true,
      baseSchedule: [...c.schedule],
      schedule: {},
      suspicion,
      memory: [],
      trusts,
    };
  }

  const rooms: Record<Id, Room> = {};
  for (const r of content.rooms) rooms[r.id] = { ...r, adjacent: [...r.adjacent] };

  const evidence: Record<Id, Evidence> = {};
  for (const e of content.evidence) {
    evidence[e.id] = { id: e.id, name: e.name, belongsTo: e.belongsTo, location: e.room };
  }

  const s: GameState = {
    seed,
    rng: createRng(seed),
    balance: structuredClone(balance),
    startRoom: content.startRoom,
    day: 0,
    phase: 'day',
    tick: 0,
    actionsLeft: balance.day.actionBudget,
    player: {
      room: content.startRoom,
      inventory: [],
      lies: [],
      shield: false,
      bribeTokens: balance.verbs.startingBribeTokens,
      contactsToday: [],
      trail: [],
    },
    npcs,
    rooms,
    evidence,
    rumours: [],
    nextRumourId: 1,
    history: { tables: [], murders: [] },
    log: [],
  };
  // First impressions: nobody starts the game suspecting everyone equally.
  const jitter = balance.suspicion.initialJitter;
  if (jitter > 0) {
    for (const n of Object.values(s.npcs)) {
      for (const id of Object.keys(n.suspicion)) {
        n.suspicion[id] = (n.suspicion[id] ?? 0) + (rollFloat(s) * 2 - 1) * jitter;
      }
    }
  }
  startDay(s, 1);
  return s;
}

function npcHere(s: GameState, id: Id): string | null {
  const n = s.npcs[id];
  if (!n) return `unknown NPC "${id}"`;
  if (!n.alive) return `${n.name} is dead`;
  if (npcRoom(s, n) !== s.player.room) return `${n.name} is not in this room`;
  return null;
}

/** Returns why a command is not allowed right now, or null if it is. */
export function validateCommand(s: GameState, c: Command): string | null {
  if (s.phase === 'ended') return 'the game is over';
  const dayOnly = [
    'move',
    'pickUp',
    'plant',
    'report',
    'chat',
    'seedDoubt',
    'ally',
    'bribe',
    'endDay',
    'spotted',
  ];
  if (dayOnly.includes(c.type) && s.phase !== 'day') return `not allowed during ${s.phase}`;
  if (c.type === 'resolveRoundTable' && s.phase !== 'roundTable') return 'no Round Table in progress';
  if (c.type === 'murder' && s.phase !== 'night') return 'murders happen at night';

  switch (c.type) {
    case 'move':
      if (!s.rooms[c.to]) return `unknown room "${c.to}"`;
      if (!isAdjacent(s, s.player.room, c.to)) return `${c.to} is not adjacent to ${s.player.room}`;
      return null;
    case 'pickUp': {
      const ev = s.evidence[c.evidence];
      if (!ev) return `unknown evidence "${c.evidence}"`;
      if (ev.location !== s.player.room) return `${ev.name} is not here`;
      return null;
    }
    case 'plant':
      if (!s.player.inventory.includes(c.evidence)) return `you are not carrying "${c.evidence}"`;
      if (c.room !== s.player.room) return 'you can only plant evidence in the room you are in';
      return null;
    case 'report': {
      const ev = s.evidence[c.evidence];
      if (!ev) return `unknown evidence "${c.evidence}"`;
      if (ev.location !== s.player.room || ev.foundBy) return `${ev.name} is not here to find`;
      return null;
    }
    case 'chat':
    case 'ally':
      return npcHere(s, c.npc);
    case 'bribe':
      if (s.player.bribeTokens <= 0) return 'you have nothing left to bribe with';
      return npcHere(s, c.npc);
    case 'seedDoubt': {
      const here = npcHere(s, c.npc);
      if (here) return here;
      if (c.target === c.npc) return 'you cannot seed doubt about someone to their face';
      if (!s.npcs[c.target]?.alive) return `"${c.target}" is not a living Faithful`;
      if (c.room !== undefined && !s.rooms[c.room]) return `unknown room "${c.room}"`;
      return null;
    }
    case 'endDay':
      return null;
    case 'spotted':
      return npcHere(s, c.npc);
    case 'resolveRoundTable': {
      const t = s.npcs[c.playerVote];
      if (!t || !t.alive) return `you must vote for a living Faithful`;
      const st = c.statement;
      if (st && (st.kind === 'accuse' || st.kind === 'defend') && !s.npcs[st.target]?.alive) {
        return `"${st.target}" is not a living Faithful`;
      }
      if (st && st.kind === 'alibi' && !s.rooms[st.room]) return `unknown room "${st.room}"`;
      return null;
    }
    case 'murder': {
      const v = s.npcs[c.victim];
      if (!v || !v.alive) return 'you must choose a living Faithful';
      if (!roomsVisitedToday(s, c.victim).includes(c.room)) return `${v.name} was never in ${c.room} today`;
      return null;
    }
  }
}

/** One action has been spent: the world reacts, time moves on, NPCs move. */
function endOfAction(s: GameState): void {
  discoveryPass(s);
  rumourPass(s);
  s.actionsLeft -= 1;
  s.tick += 1;
  if (s.tick >= s.balance.day.ticksPerDay || s.actionsLeft <= 0) {
    s.phase = 'roundTable';
    log(s, 'The bell rings. The Faithfuls gather at the Round Table.');
    return;
  }
  for (const n of aliveNpcs(s)) {
    const before = n.schedule[s.tick - 1];
    if (before !== npcRoom(s, n)) {
      npcArrives(s, n.id);
      noteArrivalGlance(s, n.id);
    }
  }
}

/** Pure: returns a new state and never mutates `state`. Throws InvalidCommandError if not allowed. */
export function applyCommand(state: GameState, c: Command): GameState {
  const reason = validateCommand(state, c);
  if (reason) throw new InvalidCommandError(c, reason);
  const s = structuredClone(state);
  if (c.type === 'chat' || c.type === 'seedDoubt' || c.type === 'ally' || c.type === 'bribe') {
    if (!s.player.contactsToday.includes(c.npc)) s.player.contactsToday.push(c.npc);
  }

  switch (c.type) {
    case 'move': {
      s.player.room = c.to;
      s.player.trail.push({ day: s.day, tick: s.tick, room: c.to });
      const seenBy = playerArrives(s, c.to, c.sneaking, c.visibleTo);
      log(
        s,
        `You ${c.sneaking ? 'creep' : 'walk'} into the ${roomName(s, c.to)}` +
          (seenBy.length
            ? `. ${seenBy.map((id) => nameOf(s, id)).join(' and ')} ${seenBy.length === 1 ? 'notices' : 'notice'} you.`
            : '.'),
      );
      noteGlances(s, seenBy);
      endOfAction(s);
      break;
    }
    case 'pickUp':
      pickUp(s, c.evidence, c.visibleTo);
      endOfAction(s);
      break;
    case 'plant':
      plant(s, c.evidence, c.room, c.visibleTo);
      endOfAction(s);
      break;
    case 'report':
      report(s, c.evidence);
      endOfAction(s);
      break;
    case 'chat':
      chat(s, c.npc);
      endOfAction(s);
      break;
    case 'seedDoubt':
      seedDoubt(s, c.npc, c.target, c.room, c.isLie);
      endOfAction(s);
      break;
    case 'ally':
      ally(s, c.npc);
      endOfAction(s);
      break;
    case 'bribe':
      bribe(s, c.npc);
      endOfAction(s);
      break;
    case 'spotted': {
      // Free action: no tick passes.
      const npc = s.npcs[c.npc];
      if (npc && checkPlayer(s, npc, c.sneaking)) {
        log(s, `${npc.name} spots you in the ${roomName(s, s.player.room)}.`);
      }
      break;
    }
    case 'endDay':
      log(s, 'You wait for the day to pass.');
      while (s.phase === 'day') endOfAction(s);
      break;
    case 'resolveRoundTable':
      resolveRoundTable(s, c.playerVote, c.statement ?? { kind: 'quiet' });
      break;
    case 'murder':
      murder(s, c.victim, c.room);
      break;
  }
  return s;
}

/**
 * Every command that is valid right now. Used by bots, tests and (later) the UI.
 * Round Table options only include the quiet statement; the UI builds richer ones.
 */
export function legalCommands(s: GameState): Command[] {
  const out: Command[] = [];
  if (s.phase === 'day') {
    for (const to of s.rooms[s.player.room]?.adjacent ?? []) {
      out.push({ type: 'move', to, sneaking: false }, { type: 'move', to, sneaking: true });
    }
    for (const ev of Object.values(s.evidence)) {
      if (ev.location === s.player.room && !ev.foundBy) {
        out.push({ type: 'pickUp', evidence: ev.id });
        if (ev.plantedBy) out.push({ type: 'report', evidence: ev.id });
      }
    }
    for (const id of s.player.inventory) out.push({ type: 'plant', evidence: id, room: s.player.room });
    const here = aliveNpcs(s).filter((n) => npcRoom(s, n) === s.player.room);
    for (const n of here) {
      out.push({ type: 'chat', npc: n.id }, { type: 'ally', npc: n.id });
      if (s.player.bribeTokens > 0) out.push({ type: 'bribe', npc: n.id });
      for (const t of aliveNpcs(s)) {
        if (t.id === n.id) continue;
        out.push({ type: 'seedDoubt', npc: n.id, target: t.id, isLie: false });
        const truthful = roomsVisitedToday(s, t.id);
        for (const room of new Set(truthful)) {
          out.push({ type: 'seedDoubt', npc: n.id, target: t.id, room, isLie: false });
        }
        const lie = Object.keys(s.rooms).find((r) => !truthful.includes(r));
        if (lie) out.push({ type: 'seedDoubt', npc: n.id, target: t.id, room: lie, isLie: true });
      }
    }
    out.push({ type: 'endDay' });
  } else if (s.phase === 'roundTable') {
    for (const n of aliveNpcs(s)) {
      out.push({ type: 'resolveRoundTable', playerVote: n.id, statement: { kind: 'quiet' } });
    }
  } else if (s.phase === 'night') {
    for (const n of aliveNpcs(s)) {
      for (const room of new Set(roomsVisitedToday(s, n.id)))
        out.push({ type: 'murder', victim: n.id, room });
    }
  }
  return out;
}
