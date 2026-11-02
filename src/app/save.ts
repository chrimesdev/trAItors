/**
 * Save/resume and run reports. Lives outside src/sim: persistence is not a game rule.
 *
 * A save holds the full GameState plus every command sent, so a game can resume
 * exactly where it stopped and a playtester's run can be replayed command by command.
 */
import type { Command, GameState } from '../sim';

export const SAVE_KEY = 'traitors.save.v1';
/** Bump whenever GameState changes shape, so old saves are discarded instead of breaking. */
export const SAVE_VERSION = 2;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveFile {
  version: number;
  build: string;
  savedAt: string;
  state: GameState;
  commands: Command[];
}

/** localStorage if it works (private windows and sandboxed iframes may refuse), else null. */
export function browserStorage(): KeyValueStorage | null {
  try {
    const s = window.localStorage;
    const probe = '__traitors_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function writeSave(storage: KeyValueStorage | null, state: GameState, commands: Command[]): void {
  if (!storage) return;
  try {
    if (state.phase === 'ended') {
      storage.removeItem(SAVE_KEY);
      return;
    }
    const file: SaveFile = {
      version: SAVE_VERSION,
      build: BUILD_ID,
      savedAt: new Date().toISOString(),
      state,
      commands,
    };
    storage.setItem(SAVE_KEY, JSON.stringify(file));
  } catch {
    // Storage full or blocked: the game carries on without saving.
  }
}

export function readSave(storage: KeyValueStorage | null): SaveFile | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const file = JSON.parse(raw) as Partial<SaveFile>;
    const s = file.state;
    const valid =
      file.version === SAVE_VERSION &&
      Array.isArray(file.commands) &&
      s !== undefined &&
      typeof s.seed === 'number' &&
      typeof s.day === 'number' &&
      s.phase !== 'ended' &&
      typeof s.npcs === 'object' &&
      typeof s.rng === 'object' &&
      Array.isArray(s.history?.tables);
    return valid ? (file as SaveFile) : null;
  } catch {
    return null;
  }
}

export function clearSave(storage: KeyValueStorage | null): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------- run report

function name(s: GameState, id: string): string {
  return id === 'player' ? 'you' : (s.npcs[id]?.name ?? id);
}

function roomName(s: GameState, id: string): string {
  return s.rooms[id]?.name ?? id;
}

/** Plain-text summary of a run, with the full command list for replaying it. */
export function runReport(s: GameState, commands: Command[]): string {
  const lines: string[] = [];
  const outcome = s.outcome
    ? `${s.outcome.toUpperCase()} on day ${s.day}`
    : `in progress (day ${s.day}, ${s.phase})`;
  lines.push('TrAItors run report');
  lines.push(`Build ${BUILD_ID} · Seed ${s.seed} · ${outcome}`);
  lines.push('');

  const days = Math.max(s.history.tables.length, s.history.murders.length);
  for (let d = 1; d <= days; d++) {
    const t = s.history.tables.find((x) => x.day === d);
    if (t) {
      const st = t.statement;
      const said =
        st.kind === 'quiet'
          ? 'stayed quiet'
          : st.kind === 'alibi'
            ? `claimed the ${roomName(s, st.room)}${st.isLie ? ' (lie)' : ''}`
            : `${st.kind}d ${name(s, st.target)}`;
      const votes = Object.entries(t.votes)
        .map(([v, target]) => `${name(s, v)}→${name(s, target)}`)
        .join(', ');
      lines.push(`Day ${d}: ${name(s, t.banished)} banished. You ${said}. Votes: ${votes}`);
    }
    const m = s.history.murders.find((x) => x.day === d);
    if (m) lines.push(`Night ${d}: you murdered ${name(s, m.victim)} in the ${roomName(s, m.room)}.`);
  }

  const caught = s.player.lies.filter((l) => l.contradictedBy);
  lines.push('');
  lines.push(`Lies: ${s.player.lies.length} told, ${caught.length} caught.`);
  const suspicion = Object.values(s.npcs)
    .map((n) => `${n.name}${n.alive ? '' : '†'} ${Math.round(n.suspicion.player ?? 0)}`)
    .join(', ');
  lines.push(`Suspicion of you at the end: ${suspicion}`);

  const counts: Record<string, number> = {};
  for (const c of commands) {
    const key = c.type === 'move' && c.sneaking ? 'sneak' : c.type;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  lines.push(
    `Commands: ${Object.entries(counts)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
  );
  lines.push('');
  lines.push('Replay data (seed + commands):');
  lines.push(JSON.stringify({ build: BUILD_ID, seed: s.seed, commands }));
  return lines.join('\n');
}
