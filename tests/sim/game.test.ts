import { describe, expect, it } from 'vitest';
import { defaultContent } from '../../src/content';
import {
  BALANCE,
  InvalidCommandError,
  applyCommand,
  createGame,
  legalCommands,
  naiveBot,
  validateCommand,
} from '../../src/sim';
import { newGame, play, quietBalance, runBot } from './helpers';

describe('createGame', () => {
  it('starts day 1 in the hall with six living Faithfuls', () => {
    const s = createGame(42, defaultContent);
    expect(s.day).toBe(1);
    expect(s.phase).toBe('day');
    expect(s.player.room).toBe('hall');
    expect(Object.values(s.npcs).filter((n) => n.alive)).toHaveLength(6);
    expect(s.actionsLeft).toBe(BALANCE.day.actionBudget);
  });

  it('gives every NPC a full schedule of real rooms', () => {
    const s = createGame(42, defaultContent);
    for (const n of Object.values(s.npcs)) {
      for (let t = 0; t < BALANCE.day.ticksPerDay; t++)
        expect(s.rooms[n.schedule[t] as string]).toBeDefined();
    }
  });
});

describe('purity and determinism', () => {
  it('applyCommand never mutates its input', () => {
    const s = createGame(7, defaultContent);
    const snapshot = JSON.stringify(s);
    for (const cmd of legalCommands(s)) applyCommand(s, cmd);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('state survives a JSON round-trip and keeps playing identically', () => {
    let s = createGame(3, defaultContent);
    s = play(s, { type: 'move', to: 'library', sneaking: false });
    const restored = JSON.parse(JSON.stringify(s));
    const cmd = { type: 'move', to: 'study', sneaking: true } as const;
    expect(applyCommand(restored, cmd)).toEqual(applyCommand(s, cmd));
  });

  it('the same seed and the same bot produce the same game', () => {
    expect(runBot(11, naiveBot)).toEqual(runBot(11, naiveBot));
  });

  it('different seeds produce different games', () => {
    expect(runBot(1, naiveBot).log).not.toEqual(runBot(2, naiveBot).log);
  });
});

describe('validation', () => {
  it('rejects moving to a room that is not adjacent', () => {
    const s = newGame();
    expect(validateCommand(s, { type: 'move', to: 'cellar', sneaking: false })).toMatch(/not adjacent/);
    expect(() => applyCommand(s, { type: 'move', to: 'cellar', sneaking: false })).toThrow(
      InvalidCommandError,
    );
  });

  it('rejects day actions at the Round Table and murders by day', () => {
    const s = newGame();
    expect(validateCommand(s, { type: 'murder', victim: 'priya', room: 'kitchen' })).toMatch(/night/);
    const table = play(s, { type: 'endDay' });
    expect(table.phase).toBe('roundTable');
    expect(validateCommand(table, { type: 'move', to: 'lounge', sneaking: false })).toMatch(/roundTable/);
  });

  it('every legal command is accepted', () => {
    const s = createGame(5, defaultContent);
    for (const cmd of legalCommands(s)) expect(validateCommand(s, cmd)).toBeNull();
  });
});

describe('day flow', () => {
  it('each action costs one action and advances one tick; the bell rings when they run out', () => {
    let s = newGame();
    s = play(s, { type: 'move', to: 'library', sneaking: false });
    expect(s.actionsLeft).toBe(BALANCE.day.actionBudget - 1);
    expect(s.tick).toBe(1);
    for (let i = 1; i < BALANCE.day.actionBudget; i++) {
      s = play(s, { type: 'move', to: s.player.room === 'library' ? 'hall' : 'library', sneaking: false });
    }
    expect(s.phase).toBe('roundTable');
  });

  it('endDay skips straight to the Round Table', () => {
    expect(play(newGame(), { type: 'endDay' }).phase).toBe('roundTable');
  });
});

describe('full runs (M1 done-when)', () => {
  it('a full run from seed 42 completes with an outcome and no exceptions', () => {
    const s = runBot(42, naiveBot);
    expect(s.phase).toBe('ended');
    expect(['win', 'lose']).toContain(s.outcome);
  });

  it('200 seeded runs all finish without throwing', () => {
    const outcomes = { win: 0, lose: 0 };
    for (let seed = 1; seed <= 200; seed++) {
      const s = runBot(seed, naiveBot);
      expect(s.phase, `seed ${seed}`).toBe('ended');
      outcomes[s.outcome as 'win' | 'lose']++;
    }
    expect(outcomes.win + outcomes.lose).toBe(200);
  });
});

describe('first impressions', () => {
  it('starting suspicion varies per NPC, so nobody is voted out purely by tie-break', () => {
    const s = createGame(42, defaultContent);
    const scores = Object.values(s.npcs.marcus?.suspicion ?? {});
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  it('an exact tie in suspicion never falls on the player', () => {
    // Quiet balance with the silence/isolation penalties off: every score is exactly equal.
    const s = newGame(quietBalance({ pressure: { quietPenalty: 0, isolationPenalty: 0 } }));
    const table = play(s, { type: 'endDay' });
    const after = applyCommand(table, { type: 'resolveRoundTable', playerVote: 'theo' });
    expect(Object.values(after.lastVote?.votes ?? {})).not.toContain('player');
  });
});
