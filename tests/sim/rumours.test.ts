import { describe, expect, it } from 'vitest';
import { PLAYER_ID, roundTableSpeeches } from '../../src/sim';
import { newGame, pinSchedule, play, quietBalance, tweak } from './helpers';

/** Marcus in the hall with you all day; Theo spends the day in the kitchen where Marcus... */
function setup(balance = quietBalance()) {
  return tweak(newGame(balance), (s) => {
    pinSchedule(s, 'marcus', ['hall', 'hall', 'kitchen', 'hall', 'hall', 'hall']);
    pinSchedule(s, 'theo', 'kitchen');
    pinSchedule(s, 'priya', 'hall');
  });
}

describe('rumours and lies', () => {
  it('seeding doubt raises the listener’s suspicion of the target', () => {
    const s = setup();
    const before = s.npcs.priya?.suspicion.theo ?? 0;
    const after = play(s, { type: 'seedDoubt', npc: 'priya', target: 'theo', isLie: false });
    expect(after.npcs.priya?.suspicion.theo).toBeGreaterThan(before);
    expect(after.rumours).toContainEqual(expect.objectContaining({ holder: 'priya', target: 'theo' }));
  });

  it('a lie the Detective can disprove is called out at the Round Table (M3 done-when)', () => {
    let s = setup();
    // Lie to Marcus: "Theo was in the library." Theo never leaves the kitchen, and Marcus sees him there at tick 2.
    s = play(s, { type: 'seedDoubt', npc: 'marcus', target: 'theo', room: 'library', isLie: true });
    s = play(s, { type: 'endDay' });
    expect(s.player.lies).toHaveLength(1);
    expect(roundTableSpeeches(s)).toContainEqual(
      expect.objectContaining({ speaker: 'marcus', kind: 'contradiction', target: PLAYER_ID }),
    );
    const before = s.npcs.marcus?.suspicion.player ?? 0;
    s = play(s, { type: 'resolveRoundTable', playerVote: 'theo' });
    expect(s.player.lies[0]?.contradictedBy).toBe('marcus');
    expect(s.npcs.marcus?.suspicion.player ?? 0).toBeGreaterThanOrEqual(before + 30 - 0.001);
  });

  it('a true claim is not called out', () => {
    let s = setup();
    s = play(s, { type: 'seedDoubt', npc: 'marcus', target: 'theo', room: 'kitchen', isLie: false });
    s = play(s, { type: 'endDay' });
    expect(roundTableSpeeches(s).filter((sp) => sp.kind === 'contradiction')).toHaveLength(0);
  });

  it('rumours spread between NPCs who share a room, weakening as they go', () => {
    let s = setup(quietBalance({ rumours: { exchangeChance: 1 } }));
    s = play(s, { type: 'seedDoubt', npc: 'priya', target: 'theo', isLie: false });
    const relayed = s.rumours.find((r) => r.holder === 'marcus' && r.target === 'theo');
    expect(relayed?.teller).toBe('priya');
    expect(relayed?.origin).toBe(PLAYER_ID);
    expect(relayed?.strength).toBeCloseTo(15 * 0.6);
  });
});
