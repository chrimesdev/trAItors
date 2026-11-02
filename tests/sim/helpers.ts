import { defaultContent } from '../../src/content';
import {
  BALANCE,
  applyCommand,
  createGame,
  createRng,
  type Balance,
  type Bot,
  type Command,
  type GameState,
} from '../../src/sim';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge<T>(base: T, patch: DeepPartial<T>): T {
  const out = structuredClone(base) as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object'
        ? merge(cur, v as DeepPartial<typeof cur>)
        : v;
  }
  return out as T;
}

/** BALANCE with every source of randomness switched off, so a test controls exactly what happens. */
export function quietBalance(patch: DeepPartial<Balance> = {}): Balance {
  const quiet = merge(BALANCE, {
    schedule: { wanderChance: 0 },
    suspicion: { initialJitter: 0 },
    memory: { noise: { detective: 0, sheep: 0, grudge: 0, loyalist: 0, paranoid: 0 } },
    evidence: { discoverChancePerTick: 0, detectiveDiscoverChancePerTick: 0 },
    rumours: { exchangeChance: 0 },
    verbs: { sheepMentionsBribeChance: 0 },
  });
  return merge(quiet, patch);
}

export function newGame(balance: Balance = quietBalance(), seed = 1): GameState {
  return createGame(seed, defaultContent, balance);
}

/** Test fixture setup only: returns a modified copy without going through the rules. */
export function tweak(s: GameState, fn: (draft: GameState) => void): GameState {
  const draft = structuredClone(s);
  fn(draft);
  return draft;
}

export function play(s: GameState, ...commands: Command[]): GameState {
  return commands.reduce(applyCommand, s);
}

/** Sets every NPC's schedule to a single room for the whole day. */
export function pinSchedule(s: GameState, npcId: string, rooms: string | string[]): void {
  const npc = s.npcs[npcId];
  if (!npc) throw new Error(npcId);
  const list = Array.isArray(rooms) ? rooms : Array(s.balance.day.ticksPerDay).fill(rooms);
  npc.schedule = Object.fromEntries(list.map((r, i) => [i, r]));
}

export function runBot(seed: number, bot: Bot, balance: Balance = BALANCE, maxSteps = 500): GameState {
  let s = createGame(seed, defaultContent, balance);
  let rng = createRng(seed ^ 0x5eed);
  for (let i = 0; i < maxSteps && s.phase !== 'ended'; i++) {
    let cmd: Command;
    [cmd, rng] = bot(s, rng);
    s = applyCommand(s, cmd);
  }
  return s;
}
