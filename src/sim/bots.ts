/**
 * Scripted players for tests, the headless CLI and the balancing sweep (M5).
 * Bots use their own RNG so they never disturb the game's random stream.
 *
 *   idleBot    — does nothing: waits out every day, stays quiet, votes and kills at random.
 *   naiveBot   — random legal actions; a first-time player who hasn't worked anything out.
 *   carefulBot — a deliberate framer: sneaks, plants evidence unseen, talks to everyone,
 *                pushes one scapegoat, and murders whoever suspects them most where they
 *                were never seen. It reads NPC suspicion directly, standing in for a
 *                skilled player who reads the tells and chat reveals.
 */
import { legalCommands } from './game';
import { playerSawToday, roomsPlayerVisitedToday } from './queries';
import { pick, type RngState } from './rng';
import { aliveNpcs, npcRoom } from './state';
import { roomsVisitedToday } from './world';
import { PLAYER_ID, type Command, type GameState, type Id } from './types';

export type Bot = (s: GameState, rng: RngState) => [Command, RngState];

/** Picks uniformly among legal commands, but avoids ending the day early. */
export const naiveBot: Bot = (s, rng) => {
  const legal = legalCommands(s);
  const preferred = s.phase === 'day' ? legal.filter((c) => c.type !== 'endDay') : legal;
  return pick(rng, preferred.length > 0 ? preferred : legal);
};

/** Never acts: waits out each day, says nothing, votes and murders at random. */
export const idleBot: Bot = (s, rng) => {
  if (s.phase === 'day') return [{ type: 'endDay' }, rng];
  return pick(rng, legalCommands(s));
};

// ------------------------------------------------------------------ careful

/** The living Faithful everyone else already suspects most: the easiest one to frame. */
export function scapegoat(s: GameState): Id | undefined {
  const living = aliveNpcs(s);
  let best: Id | undefined;
  let bestScore = -Infinity;
  for (const target of living) {
    const others = living.filter((n) => n.id !== target.id);
    const avg =
      others.reduce((sum, n) => sum + (n.suspicion[target.id] ?? 0), 0) / Math.max(1, others.length);
    if (avg > bestScore) {
      bestScore = avg;
      best = target.id;
    }
  }
  return best;
}

/** First step on a shortest path between rooms, or undefined if already there. */
function stepToward(s: GameState, from: Id, to: Id): Id | undefined {
  if (from === to) return undefined;
  const prev: Record<Id, Id> = {};
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length) {
    const room = queue.shift() as Id;
    for (const next of s.rooms[room]?.adjacent ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev[next] = room;
      if (next === to) {
        let step = next;
        while (prev[step] !== from) step = prev[step] as Id;
        return step;
      }
      queue.push(next);
    }
  }
  return undefined;
}

function nobodyHere(s: GameState, room: Id): boolean {
  return aliveNpcs(s).every((n) => npcRoom(s, n) !== room);
}

/** Rooms where `who` is scheduled for the rest of today. */
function roomsLaterToday(s: GameState, who: Id): Id[] {
  const n = s.npcs[who];
  if (!n) return [];
  const out: Id[] = [];
  for (let t = s.tick + 1; t < s.balance.day.ticksPerDay; t++) {
    const r = n.schedule[t];
    if (r) out.push(r);
  }
  return out;
}

function carefulDay(s: GameState): Command {
  const here = s.player.room;
  const goat = scapegoat(s);
  const talkedToday = new Set(
    s.log
      .filter((e) => e.day === s.day && e.phase === 'day')
      .map((e) => /^You (?:chat with|tell|propose an alliance to) (\w+)/.exec(e.text)?.[1])
      .filter((x): x is string => Boolean(x)),
  );

  // 1. Plant what we carry where someone else will find it and nobody is watching.
  const carried = s.player.inventory[0];
  if (carried && nobodyHere(s, here)) {
    const visitors = aliveNpcs(s).filter((n) => roomsLaterToday(s, n.id).includes(here));
    if (visitors.length > 0) return { type: 'plant', evidence: carried, room: here };
  }

  // 2. Pick up unused evidence that points at someone, if nobody is watching.
  if (!carried && nobodyHere(s, here)) {
    const item = Object.values(s.evidence).find((e) => e.location === here && !e.plantedBy && e.belongsTo);
    if (item) return { type: 'pickUp', evidence: item.id };
  }

  // 3. Work the room: talk to anyone not spoken to today, pushing the scapegoat.
  const company = aliveNpcs(s).filter((n) => npcRoom(s, n) === here && !talkedToday.has(n.name));
  const listener = company[0];
  if (listener) {
    if (goat && goat !== listener.id) {
      const saw = playerSawToday(s, goat);
      return saw[0]
        ? { type: 'seedDoubt', npc: listener.id, target: goat, room: saw[0], isLie: false }
        : { type: 'seedDoubt', npc: listener.id, target: goat, isLie: false };
    }
    return { type: 'chat', npc: listener.id };
  }

  // 4. Move (sneaking): towards evidence if empty-handed, else towards company.
  let target: Id | undefined;
  if (!carried) {
    target = Object.values(s.evidence).find(
      (e) => s.rooms[e.location] && !e.plantedBy && e.belongsTo,
    )?.location;
  }
  if (!target) {
    const nextTick = Math.min(s.tick + 1, s.balance.day.ticksPerDay - 1);
    target = aliveNpcs(s).find((n) => n.schedule[nextTick] !== here)?.schedule[nextTick];
  }
  const step = target ? stepToward(s, here, target) : undefined;
  const fallback = s.rooms[here]?.adjacent[0];
  const to = step ?? fallback;
  return to ? { type: 'move', to, sneaking: true } : { type: 'endDay' };
}

export const carefulBot: Bot = (s, rng) => {
  if (s.phase === 'day') return [carefulDay(s), rng];

  if (s.phase === 'roundTable') {
    const goat = scapegoat(s);
    const living = aliveNpcs(s);
    const vote = goat ?? living[0]?.id;
    if (!vote) return pick(rng, legalCommands(s));
    return [
      {
        type: 'resolveRoundTable',
        playerVote: vote,
        statement: goat ? { kind: 'accuse', target: goat, isLie: false } : { kind: 'quiet' },
      },
      rng,
    ];
  }

  if (s.phase === 'night') {
    // Remove the biggest threat, somewhere we were never seen, ideally where the scapegoat was.
    const living = aliveNpcs(s);
    const goat = scapegoat(s);
    const threat = [...living]
      .filter((n) => n.id !== goat || living.length <= 2)
      .sort((a, b) => (b.suspicion[PLAYER_ID] ?? 0) - (a.suspicion[PLAYER_ID] ?? 0))[0];
    if (threat) {
      const ours = roomsPlayerVisitedToday(s);
      const theirs = roomsVisitedToday(s, threat.id);
      const goatRooms = goat ? roomsVisitedToday(s, goat) : [];
      const room =
        theirs.find((r) => !ours.includes(r) && goatRooms.includes(r)) ??
        theirs.find((r) => !ours.includes(r)) ??
        theirs[0];
      if (room) return [{ type: 'murder', victim: threat.id, room }, rng];
    }
  }
  return pick(rng, legalCommands(s));
};
