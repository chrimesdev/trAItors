import { describe, expect, it } from 'vitest';
import { PLAYER_ID } from '../../src/sim';
import { newGame, pinSchedule, play, quietBalance, tweak } from './helpers';

const sawPlayer = (s: ReturnType<typeof newGame>, npc: string) =>
  s.npcs[npc]?.memory.filter((m) => m.subject === PLAYER_ID) ?? [];

function marcusAndPriyaInLibrary(balance = quietBalance()) {
  return tweak(newGame(balance), (s) => {
    pinSchedule(s, 'marcus', 'library');
    pinSchedule(s, 'priya', 'library');
  });
}

describe('sight cones (visibleTo)', () => {
  it('walking in: only NPCs whose cone covers the door see you', () => {
    const s = play(marcusAndPriyaInLibrary(), {
      type: 'move',
      to: 'library',
      sneaking: false,
      visibleTo: ['marcus'],
    });
    expect(sawPlayer(s, 'marcus')).toHaveLength(1);
    expect(sawPlayer(s, 'priya')).toHaveLength(0);
  });

  it('planting behind someone’s back is not witnessed', () => {
    let s = tweak(marcusAndPriyaInLibrary(), (d) => {
      d.player.room = 'library';
      d.player.inventory = ['gloves'];
      const g = d.evidence.gloves;
      if (g) g.location = PLAYER_ID;
    });
    s = play(s, { type: 'plant', evidence: 'gloves', room: 'library', visibleTo: [] });
    expect(s.evidence.gloves?.witnessed).toBeUndefined();
    expect(s.evidence.gloves?.location).toBe('library');
  });

  it('planting in someone’s cone is witnessed', () => {
    let s = tweak(marcusAndPriyaInLibrary(), (d) => {
      d.player.room = 'library';
      d.player.inventory = ['gloves'];
      const g = d.evidence.gloves;
      if (g) g.location = PLAYER_ID;
    });
    s = play(s, { type: 'plant', evidence: 'gloves', room: 'library', visibleTo: ['priya'] });
    expect(s.evidence.gloves?.witnessed).toBe(true);
    expect(s.evidence.gloves?.foundBy).toBe('priya');
  });
});

describe('spotted (free action)', () => {
  function inLibraryUnseen(balance = quietBalance()) {
    return play(marcusAndPriyaInLibrary(balance), {
      type: 'move',
      to: 'library',
      sneaking: true,
      visibleTo: [],
    });
  }

  it('walking into a cone records a sighting and costs no action', () => {
    const s = inLibraryUnseen();
    const after = play(s, { type: 'spotted', npc: 'marcus', sneaking: false });
    expect(sawPlayer(after, 'marcus')).toHaveLength(1);
    expect(after.tick).toBe(s.tick);
    expect(after.actionsLeft).toBe(s.actionsLeft);
  });

  it('sneaking into a cone is a detection roll, and only one roll per NPC per tick', () => {
    const blind = quietBalance({ detection: { sneakingDetect: { detective: 0 } } });
    let s = inLibraryUnseen(blind);
    s = play(s, { type: 'spotted', npc: 'marcus', sneaking: true });
    expect(sawPlayer(s, 'marcus')).toHaveLength(0);
    // Same tick, now walking: no second check until time moves on.
    s = play(s, { type: 'spotted', npc: 'marcus', sneaking: false });
    expect(sawPlayer(s, 'marcus')).toHaveLength(0);
  });

  it('is only valid for living NPCs in your room during the day', () => {
    const s = inLibraryUnseen();
    expect(() => play(s, { type: 'spotted', npc: 'theo', sneaking: false })).toThrow(/not in this room/);
  });
});
