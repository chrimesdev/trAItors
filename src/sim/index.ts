/**
 * Public surface of the simulation. Presentation code (src/phaser, src/ui)
 * imports from here only.
 *
 * M1 adds: createGame(seed, content) and applyCommand(state, command).
 */
export * from './types';
export * from './rng';
export { BALANCE } from './balance';
