import type { Archetype, Content } from '../sim/types';
import rooms from './rooms.json';
import npcs from './npcs.json';
import evidence from './evidence.json';

/** The shipped game content. Tests may build their own Content instead. */
export const defaultContent: Content = {
  startRoom: 'hall',
  rooms,
  npcs: npcs.map((n) => ({ ...n, archetype: n.archetype as Archetype })),
  evidence,
};
