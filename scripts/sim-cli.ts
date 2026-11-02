/**
 * Headless simulation runner.
 *
 *   npm run sim                      # one game, seed 42, prints the full log
 *   npm run sim -- --seed 7          # a different seed
 *   npm run sim -- --runs 200        # many games, prints win rate and game length only
 */
import { defaultContent } from '../src/content';
import { applyCommand, createGame, createRng, naiveBot, type Command, type GameState } from '../src/sim';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : fallback;
}

function run(seed: number): GameState {
  let s = createGame(seed, defaultContent);
  let rng = createRng(seed ^ 0x5eed);
  for (let i = 0; i < 500 && s.phase !== 'ended'; i++) {
    let cmd: Command;
    [cmd, rng] = naiveBot(s, rng);
    s = applyCommand(s, cmd);
  }
  return s;
}

const seed = arg('seed', 42);
const runs = arg('runs', 1);

if (runs === 1) {
  const s = run(seed);
  console.log(`TrAItors · seed ${seed} · naive bot\n`);
  let lastDay = 0;
  for (const e of s.log) {
    if (e.day !== lastDay) {
      console.log(`\n── Day ${e.day} ──`);
      lastDay = e.day;
    }
    const when = e.phase === 'day' ? `t${e.tick}` : e.phase;
    console.log(`  [${when.padEnd(10)}] ${e.text}`);
  }
  console.log(`\nOutcome: ${s.outcome?.toUpperCase()} on day ${s.day}. Lies told: ${s.player.lies.length}.`);
} else {
  let wins = 0;
  let days = 0;
  for (let i = 0; i < runs; i++) {
    const s = run(seed + i);
    if (s.outcome === 'win') wins++;
    days += s.day;
  }
  console.log(
    `${runs} games from seed ${seed}: naive bot win rate ${((wins / runs) * 100).toFixed(1)}%, ` +
      `average length ${(days / runs).toFixed(2)} days`,
  );
}
