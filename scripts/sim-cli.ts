/**
 * Headless simulation runner.
 *   npm run sim -- --seed 42
 *
 * M0: proves the sim runs outside the browser.
 * M1: replace the body with a full seeded run that prints state.log.
 */
import { BALANCE, createRng, nextInt } from '../src/sim';

const seedArg = process.argv.indexOf('--seed');
const seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 42;

let rng = createRng(seed);
const rolls: number[] = [];
for (let i = 0; i < BALANCE.day.ticksPerDay; i++) {
  let n: number;
  [n, rng] = nextInt(rng, 1, 6);
  rolls.push(n);
}
console.log(`TrAItors sim · seed ${seed} · ${BALANCE.day.ticksPerDay} ticks/day`);
console.log(`dice: ${rolls.join(' ')}`);
