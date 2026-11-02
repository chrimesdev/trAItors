/** Placeholder colours shared by the Phaser scene and the DOM UI until M6 art. */
import type { Archetype } from '../sim';

export const ARCHETYPE_COLOUR: Record<Archetype, number> = {
  detective: 0x6ec1f5,
  sheep: 0xe8e2d0,
  loyalist: 0x7fd18b,
  grudge: 0xc58cf5,
  paranoid: 0xf5a46e,
};

export const PLAYER_COLOUR = 0xff4d6d;

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  detective: 'Detective',
  sheep: 'Follower',
  loyalist: 'Loyalist',
  grudge: 'Grudge-holder',
  paranoid: 'Paranoid',
};

export function cssColour(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}
