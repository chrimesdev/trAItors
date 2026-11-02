import { describe, expect, it } from 'vitest';
import { PLAYER_ID, roundTableSpeeches } from '../../src/sim';
import { newGame, pinSchedule, play, quietBalance, tweak } from './helpers';

const alwaysFound = quietBalance({
  evidence: { discoverChancePerTick: 1, detectiveDiscoverChancePerTick: 1 },
});

/** Player holding the Cellar key, alone in the library at tick 1 while Marcus is in the study. */
function keyInLibrary() {
  return tweak(newGame(alwaysFound), (s) => {
    pinSchedule(s, 'marcus', ['library', 'study', 'library', 'hall', 'dining', 'lounge']);
    for (const id of ['priya', 'dalton', 'imogen', 'theo', 'rosa']) pinSchedule(s, id, 'cellar');
    s.tick = 1;
    s.actionsLeft = 5;
    s.player.room = 'library';
    s.player.inventory = ['cellarKey'];
    const key = s.evidence.cellarKey;
    if (key) key.location = PLAYER_ID;
  });
}

describe('evidence', () => {
  it('planting the Cellar key in the library and Marcus walking through raises his suspicion of Theo by 25', () => {
    let s = keyInLibrary();
    const before = s.npcs.marcus?.suspicion.theo ?? 0;

    // Plant, then leave before Marcus arrives at tick 2.
    s = play(s, { type: 'plant', evidence: 'cellarKey', room: 'library' });
    s = play(s, { type: 'move', to: 'hall', sneaking: false });

    expect(s.evidence.cellarKey?.foundBy).toBe('marcus');
    expect(s.npcs.marcus?.suspicion.theo).toBe(before + 25);
  });

  it('provenance: if the finder saw you in that room today, you are suspected too', () => {
    let s = keyInLibrary();
    s = play(s, { type: 'plant', evidence: 'cellarKey', room: 'library' });
    // Linger: Marcus arrives at tick 2 and sees you, then finds the key.
    const beforePlayer = s.npcs.marcus?.suspicion.player ?? 0;
    s = play(s, { type: 'chat', npc: 'marcus' });
    expect(s.evidence.cellarKey?.foundBy).toBe('marcus');
    expect(s.npcs.marcus?.suspicion.player).toBe(beforePlayer + 20);
  });

  it('planting in front of someone gets you caught, and they tell the table', () => {
    let s = tweak(keyInLibrary(), (d) => pinSchedule(d, 'priya', 'library'));
    const before = s.npcs.priya?.suspicion.player ?? 0;
    s = play(s, { type: 'plant', evidence: 'cellarKey', room: 'library' });
    expect(s.evidence.cellarKey?.witnessed).toBe(true);
    // Day 1 is gentler (open-questions #8): half the usual penalty.
    expect(s.npcs.priya?.suspicion.player).toBe(
      before + s.balance.evidence.witnessedPlantPenalty * s.balance.firstDay.witnessFactor,
    );

    s = play(s, { type: 'endDay' });
    expect(roundTableSpeeches(s)).toContainEqual(
      expect.objectContaining({ speaker: 'priya', kind: 'caughtPlanting', target: PLAYER_ID }),
    );
  });

  it('untouched evidence is never discovered by NPCs', () => {
    let s = tweak(newGame(alwaysFound), (d) => pinSchedule(d, 'theo', 'cellar'));
    s = play(s, { type: 'endDay' });
    expect(s.evidence.cellarKey?.foundBy).toBeUndefined();
    expect(s.evidence.cellarKey?.location).toBe('cellar');
  });

  it('evidence found today is announced at the Round Table and moves the other listeners', () => {
    let s = keyInLibrary();
    s = play(s, { type: 'plant', evidence: 'cellarKey', room: 'library' });
    s = play(s, { type: 'move', to: 'hall', sneaking: false }, { type: 'endDay' });

    expect(roundTableSpeeches(s)).toContainEqual(
      expect.objectContaining({ speaker: 'marcus', kind: 'evidence', target: 'theo', evidence: 'cellarKey' }),
    );
    const before = s.npcs.dalton?.suspicion.theo ?? 0;
    s = play(s, { type: 'resolveRoundTable', playerVote: 'theo' });
    expect(s.npcs.dalton?.suspicion.theo ?? 0).toBeGreaterThan(before);
  });
});
