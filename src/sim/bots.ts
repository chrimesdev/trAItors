/**
 * Scripted players for tests, the headless CLI and the M5 balancing sweep.
 * Bots use their own RNG so they never disturb the game's random stream.
 */
import { legalCommands } from './game';
import { pick, type RngState } from './rng';
import type { Command, GameState } from './types';

export type Bot = (s: GameState, rng: RngState) => [Command, RngState];

/** Picks uniformly among legal commands, but avoids ending the day early. */
export const naiveBot: Bot = (s, rng) => {
  const legal = legalCommands(s);
  const preferred = s.phase === 'day' ? legal.filter((c) => c.type !== 'endDay') : legal;
  return pick(rng, preferred.length > 0 ? preferred : legal);
};
