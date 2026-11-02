/**
 * Replays a playtester's run from its run report (or just the replay-data JSON line).
 *
 *   npm run replay -- report.txt
 *
 * Prints the game log and checks the replay reaches the same outcome. If the build
 * differs from the one the report was made with, the replay may diverge.
 */
import { readFileSync } from 'node:fs';
import { defaultContent } from '../src/content';
import { applyCommand, createGame, type Command } from '../src/sim';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run replay -- <report.txt>');
  process.exit(1);
}

const text = readFileSync(file, 'utf8');
const line = text
  .split('\n')
  .map((l) => l.trim())
  .reverse()
  .find((l) => l.startsWith('{') && l.includes('"commands"'));
if (!line) {
  console.error('No replay data found. Expected a JSON line with "seed" and "commands".');
  process.exit(1);
}
const data = JSON.parse(line) as { build?: string; seed: number; commands: Command[] };

let s = createGame(data.seed, defaultContent);
for (const [i, c] of data.commands.entries()) {
  try {
    s = applyCommand(s, c);
  } catch (e) {
    console.error(`Replay diverged at command ${i + 1} (${c.type}): ${(e as Error).message}`);
    console.error(`Report build: ${data.build ?? 'unknown'}. Check out that commit to replay exactly.`);
    process.exit(2);
  }
}

let lastDay = 0;
for (const e of s.log) {
  if (e.day !== lastDay) {
    console.log(`\n── Day ${e.day} ──`);
    lastDay = e.day;
  }
  console.log(`  [${(e.phase === 'day' ? `t${e.tick}` : e.phase).padEnd(10)}] ${e.text}`);
}
console.log(`\nSeed ${data.seed} · build ${data.build ?? '?'} · ${data.commands.length} commands`);
console.log(`Outcome: ${s.outcome ?? `unfinished (day ${s.day}, ${s.phase})`}`);
