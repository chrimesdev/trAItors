import { describe, expect, it } from 'vitest';
import { GameStore } from '../../src/app/store';
import {
  SAVE_KEY,
  SAVE_VERSION,
  readSave,
  runReport,
  writeSave,
  type KeyValueStorage,
} from '../../src/app/save';
import { defaultContent } from '../../src/content';
import { applyCommand, createGame, createRng, naiveBot, type Command } from '../../src/sim';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function playSome(store: GameStore, steps: number, seed = 1): void {
  let rng = createRng(seed);
  for (let i = 0; i < steps && store.state.phase !== 'ended'; i++) {
    let cmd: Command;
    [cmd, rng] = naiveBot(store.state, rng);
    store.dispatch(cmd);
  }
}

describe('save and resume', () => {
  it('autosaves after every command and resumes to the identical state', () => {
    const storage = memoryStorage();
    const a = new GameStore(42, storage);
    playSome(a, 4); // stay within day 1 so the game can't have ended
    const file = readSave(storage);
    expect(file?.version).toBe(SAVE_VERSION);
    expect(file?.commands).toHaveLength(a.commands.length);

    const b = new GameStore(1, storage);
    b.resume(file!);
    expect(b.state).toEqual(a.state);
    expect(b.commands).toEqual(a.commands);
  });

  it('a resumed game plays on identically to one that never stopped', () => {
    const storage = memoryStorage();
    const a = new GameStore(7, storage);
    playSome(a, 5);
    const b = new GameStore(1, null);
    b.resume(readSave(storage)!);
    playSome(a, 20, 99);
    playSome(b, 20, 99);
    expect(b.state).toEqual(a.state);
  });

  it('replaying the saved commands from the seed reproduces the game', () => {
    const storage = memoryStorage();
    const a = new GameStore(11, storage);
    playSome(a, 4);
    const file = readSave(storage)!;
    const replayed = file.commands.reduce(applyCommand, createGame(file.state.seed, defaultContent));
    expect(replayed).toEqual(a.state);
  });

  it('finished games are not offered for resume', () => {
    const storage = memoryStorage();
    const a = new GameStore(3, storage);
    playSome(a, 500);
    expect(a.state.phase).toBe('ended');
    expect(readSave(storage)).toBeNull();
  });

  it('ignores saves from an older version or garbage', () => {
    const storage = memoryStorage();
    writeSave(storage, createGame(1, defaultContent), []);
    const old = JSON.parse(storage.data.get(SAVE_KEY)!);
    storage.setItem(SAVE_KEY, JSON.stringify({ ...old, version: SAVE_VERSION - 1 }));
    expect(readSave(storage)).toBeNull();
    storage.setItem(SAVE_KEY, '{not json');
    expect(readSave(storage)).toBeNull();
  });

  it('works without storage at all', () => {
    const a = new GameStore(5, null);
    playSome(a, 3);
    expect(readSave(null)).toBeNull();
  });
});

describe('run report', () => {
  it('summarises the run and includes replay data', () => {
    const a = new GameStore(42, null);
    playSome(a, 500);
    const report = runReport(a.state, [...a.commands]);
    expect(report).toContain('Seed 42');
    expect(report).toMatch(/Day 1: \w+ banished/);
    const data = JSON.parse(report.split('\n').at(-1)!);
    expect(data.seed).toBe(42);
    expect(data.commands).toHaveLength(a.commands.length);
  });
});
