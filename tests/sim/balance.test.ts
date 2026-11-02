/**
 * Balance guard rails. Not exact targets (use `npm run balance` for those), just
 * wide bands that catch a change which breaks the game's difficulty curve.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE, carefulBot, idleBot, naiveBot } from '../../src/sim';
import { sweep } from '../../scripts/balance';

const GAMES = 200;

describe('balance guard rails', () => {
  const idle = sweep('idle', idleBot, BALANCE, GAMES, 9000);
  const naive = sweep('naive', naiveBot, BALANCE, GAMES, 9000);
  const careful = sweep('careful', carefulBot, BALANCE, GAMES, 9000);

  it('doing nothing loses', () => {
    expect(idle.winRate).toBeLessThan(0.1);
  });

  it('skill matters: careful play beats random play beats doing nothing', () => {
    expect(careful.winRate).toBeGreaterThan(naive.winRate + 0.2);
    expect(naive.winRate).toBeGreaterThanOrEqual(idle.winRate);
  });

  it('careful play wins about half the time, not always', () => {
    expect(careful.winRate).toBeGreaterThan(0.35);
    expect(careful.winRate).toBeLessThan(0.75);
  });

  it('a well-played game lasts about three days', () => {
    expect(careful.avgDays).toBeGreaterThan(2.5);
  });
});
