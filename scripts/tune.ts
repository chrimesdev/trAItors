/**
 * Grid search over a few balance knobs, scored against the M5 targets.
 * Slow-ish (a few minutes); use it to pick values, then confirm with `npm run balance`.
 *
 *   npm run tune
 *   npm run tune -- --games 200
 *
 * Edit GRID below to search different knobs.
 */
import { BALANCE, carefulBot, idleBot, naiveBot, type Balance } from '../src/sim';
import { sweep } from './balance';

const TARGET = { idleMax: 0.12, naive: 0.25, careful: 0.55, carefulDaysMin: 2.6 };

type Path = string;
const GRID: Record<Path, number[]> = {
  'pressure.quietPenalty': [2, 4, 6],
  'pressure.isolationPenalty': [0, 1, 2, 3],
  'pressure.victimLeadPenalty': [4, 8, 12],
  'pressure.pushedInnocentPenalty': [0, 3, 6, 9],
  'pressure.wrongVotePenalty': [0, 2],
};

function set(b: Balance, path: Path, value: number): Balance {
  const copy = structuredClone(b) as unknown as Record<string, Record<string, number>>;
  const [group, key] = path.split('.') as [string, string];
  const g = copy[group];
  if (!g || !(key in g)) throw new Error(`Unknown key ${path}`);
  g[key] = value;
  return copy as unknown as Balance;
}

function* combos(
  entries: [Path, number[]][],
  i = 0,
  acc: [Path, number][] = [],
): Generator<[Path, number][]> {
  if (i === entries.length) {
    yield acc;
    return;
  }
  const [path, values] = entries[i] as [Path, number[]];
  for (const v of values) yield* combos(entries, i + 1, [...acc, [path, v]]);
}

const gi = process.argv.indexOf('--games');
const games = gi >= 0 ? Number(process.argv[gi + 1]) : 120;
const results: {
  score: number;
  combo: [Path, number][];
  idle: number;
  naive: number;
  careful: number;
  days: number;
}[] = [];

for (const combo of combos(Object.entries(GRID))) {
  const b = combo.reduce((acc, [p, v]) => set(acc, p, v), BALANCE);
  const idle = sweep('idle', idleBot, b, games, 5000).winRate;
  const naive = sweep('naive', naiveBot, b, games, 5000).winRate;
  const careful = sweep('careful', carefulBot, b, games, 5000);
  const score =
    Math.max(0, idle - TARGET.idleMax) * 2 +
    Math.abs(naive - TARGET.naive) +
    Math.abs(careful.winRate - TARGET.careful) +
    Math.max(0, TARGET.carefulDaysMin - careful.avgDays);
  results.push({ score, combo, idle, naive, careful: careful.winRate, days: careful.avgDays });
}

results.sort((a, b) => a.score - b.score);
console.log(`Best of ${results.length} combinations (${games} games per bot each):\n`);
for (const r of results.slice(0, 8)) {
  console.log(
    `score ${r.score.toFixed(3)}  idle ${(r.idle * 100).toFixed(0)}%  naive ${(r.naive * 100).toFixed(0)}%  careful ${(r.careful * 100).toFixed(0)}% (${r.days.toFixed(2)}d)  ` +
      r.combo.map(([p, v]) => `${p.split('.')[1]}=${v}`).join(' '),
  );
}
