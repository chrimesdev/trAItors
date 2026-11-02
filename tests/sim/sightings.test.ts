import { describe, expect, it } from 'vitest';
import { PLAYER_ID } from '../../src/sim';
import { newGame, pinSchedule, play, quietBalance, tweak } from './helpers';

function marcusInLibrary(balance = quietBalance()) {
  return tweak(newGame(balance), (s) => pinSchedule(s, 'marcus', 'library'));
}

describe('sightings', () => {
  it('walking into a room records a sighting by everyone in it', () => {
    const s = play(marcusInLibrary(), { type: 'move', to: 'library', sneaking: false });
    expect(s.npcs.marcus?.memory).toContainEqual(
      expect.objectContaining({ subject: PLAYER_ID, room: 'library', day: 1, tick: 0, confidence: 1 }),
    );
  });

  it('sneaking past someone with no chance to detect leaves no sighting', () => {
    const blind = quietBalance({ detection: { sneakingDetect: { detective: 0 } } });
    const s = play(marcusInLibrary(blind), { type: 'move', to: 'library', sneaking: true });
    expect(s.npcs.marcus?.memory.filter((m) => m.subject === PLAYER_ID)).toHaveLength(0);
  });

  it('a weak detective (Rosa) uses the weaker detection chance', () => {
    const b = quietBalance({
      detection: { sneakingDetect: { detective: 1 }, weakDetectiveSneakingDetect: 0 },
    });
    let s = tweak(newGame(b), (d) => pinSchedule(d, 'rosa', 'library'));
    s = play(s, { type: 'move', to: 'library', sneaking: true });
    expect(s.npcs.rosa?.memory.filter((m) => m.subject === PLAYER_ID)).toHaveLength(0);
  });

  it('a sheep can misremember which room it saw you in', () => {
    const muddled = quietBalance({ memory: { noise: { sheep: 1 } } });
    let s = tweak(newGame(muddled), (d) => pinSchedule(d, 'priya', 'library'));
    s = play(s, { type: 'move', to: 'library', sneaking: false });
    const seen = s.npcs.priya?.memory.find((m) => m.subject === PLAYER_ID);
    expect(seen?.room).not.toBe('library');
    expect(s.rooms.library?.adjacent).toContain(seen?.room);
  });

  it('NPCs who arrive in your room see you', () => {
    let s = tweak(newGame(), (d) =>
      pinSchedule(d, 'marcus', ['study', 'hall', 'hall', 'hall', 'hall', 'hall']),
    );
    s = play(s, { type: 'chat', npc: 'dalton' }); // Dalton starts in the hall; Marcus arrives at tick 1
    expect(s.npcs.marcus?.memory).toContainEqual(
      expect.objectContaining({ subject: PLAYER_ID, room: 'hall', tick: 1 }),
    );
  });
});
