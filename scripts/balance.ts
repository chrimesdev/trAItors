/**
 * Balance sweep: plays many seeded games per bot and reports how they go.
 *
 *   npm run balance                         # 400 games per bot with BALANCE
 *   npm run balance -- --games 1000
 *   npm run balance -- --set day.faithfulsLeftToWin=1 --set lies.contradictionPenalty=20
 *
 * Targets (implementation plan M5): naive ≈ 25% wins, careful ≈ 55%, and doing
 * nothing should lose most of the time.
 */
import { defaultContent } from '../src/content';
import {
  BALANCE,
  applyCommand,
  carefulBot,
  createGame,
  createRng,
  idleBot,
  naiveBot,
  type Balance,
  type Bot,
  type Command,
  type GameState,
} from '../src/sim';

function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1] as string);
  });
  return out;
}

function withOverrides(base: Balance, sets: string[]): Balance {
  const b = structuredClone(base) as unknown as Record<string, unknown>;
  for (const set of sets) {
    const [path, raw] = set.split('=');
    if (!path || raw === undefined) throw new Error(`Bad --set "${set}" (use path.to.key=value)`);
    const keys = path.split('.');
    let node = b as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>;
    const last = keys.at(-1) as string;
    if (!(last in node)) throw new Error(`Unknown balance key "${path}"`);
    node[last] = Number(raw);
  }
  return b as unknown as Balance;
}

export function play(seed: number, bot: Bot, balance: Balance): GameState {
  let s = createGame(seed, defaultContent, balance);
  let rng = createRng(seed ^ 0xb07);
  for (let i = 0; i < 800 && s.phase !== 'ended'; i++) {
    let cmd: Command;
    [cmd, rng] = bot(s, rng);
    s = applyCommand(s, cmd);
  }
  return s;
}

export interface Summary {
  bot: string;
  games: number;
  winRate: number;
  avgDays: number;
  lossDays: Record<number, number>;
  liesCaught: number;
}

export function sweep(name: string, bot: Bot, balance: Balance, games: number, firstSeed = 1): Summary {
  let wins = 0;
  let days = 0;
  let caught = 0;
  const lossDays: Record<number, number> = {};
  for (let i = 0; i < games; i++) {
    const s = play(firstSeed + i, bot, balance);
    if (s.outcome === 'win') wins++;
    else lossDays[s.day] = (lossDays[s.day] ?? 0) + 1;
    days += s.day;
    caught += s.player.lies.filter((l) => l.contradictedBy).length;
  }
  return {
    bot: name,
    games,
    winRate: wins / games,
    avgDays: days / games,
    lossDays,
    liesCaught: caught / games,
  };
}

const isMain = process.argv[1]?.endsWith('balance.ts');
if (isMain) {
  const games = Number(args('games')[0] ?? 400);
  const balance = withOverrides(BALANCE, args('set'));
  const bots: [string, Bot][] = [
    ['idle', idleBot],
    ['naive', naiveBot],
    ['careful', carefulBot],
  ];
  console.log(`${games} games per bot${args('set').length ? ` · ${args('set').join(' ')}` : ''}\n`);
  console.log('bot       win%   avg days   losses by day');
  for (const [name, bot] of bots) {
    const r = sweep(name, bot, balance, games);
    const losses = Object.entries(r.lossDays)
      .map(([d, n]) => `d${d}:${n}`)
      .join(' ');
    console.log(
      `${name.padEnd(9)} ${(r.winRate * 100).toFixed(1).padStart(5)}   ${r.avgDays.toFixed(2).padStart(8)}   ${losses}`,
    );
  }
}
