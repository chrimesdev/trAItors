import { describe, expect, it } from 'vitest';
import { PLAYER_ID, playerSawToday, roomsPlayerVisitedToday } from '../../src/sim';
import { newGame, pinSchedule, play, tweak } from './helpers';

describe('what the player knows', () => {
  it('playerSawToday lists rooms where you and the target were together', () => {
    let s = tweak(newGame(), (d) => {
      pinSchedule(d, 'theo', ['hall', 'library', 'library', 'study', 'study', 'study']);
    });
    s = play(s, { type: 'move', to: 'library', sneaking: false }); // tick 0 → you in library; Theo in hall
    s = play(s, { type: 'chat', npc: 'theo' }); // tick 1: Theo arrives in the library
    expect(playerSawToday(s, 'theo')).toEqual(['library']);
  });

  it('does not reveal where the target will be later today', () => {
    const s = tweak(newGame(), (d) =>
      pinSchedule(d, 'theo', ['kitchen', 'hall', 'hall', 'hall', 'hall', 'hall']),
    );
    expect(playerSawToday(s, 'theo')).toEqual([]);
  });

  it('roomsPlayerVisitedToday follows your trail', () => {
    let s = newGame();
    s = play(
      s,
      { type: 'move', to: 'library', sneaking: false },
      { type: 'move', to: 'study', sneaking: false },
    );
    expect(roomsPlayerVisitedToday(s)).toEqual(['hall', 'library', 'study']);
  });
});

describe('Round Table record', () => {
  it('records speeches, statement, votes and banishment for the UI to replay', () => {
    const s = play(newGame(), { type: 'endDay' });
    const after = play(s, {
      type: 'resolveRoundTable',
      playerVote: 'theo',
      statement: { kind: 'accuse', target: 'theo', isLie: false },
    });
    const t = after.lastTable;
    expect(t?.day).toBe(1);
    expect(t?.statement).toEqual({ kind: 'accuse', target: 'theo', isLie: false });
    expect(t?.votes.player).toBe('theo');
    expect(t?.banished).toBe(after.lastVote?.banished);
  });

  it('a false alibi that a Detective can disprove becomes a reaction speech', () => {
    // Marcus keeps coming back to the hall where you wait, so he knows you never went to the cellar.
    let s = tweak(newGame(), (d) =>
      pinSchedule(d, 'marcus', ['library', 'hall', 'library', 'hall', 'library', 'hall']),
    );
    s = play(s, { type: 'endDay' });
    const before = s.npcs.marcus?.suspicion.player ?? 0;
    const after = play(s, {
      type: 'resolveRoundTable',
      playerVote: 'theo',
      statement: { kind: 'alibi', room: 'cellar', isLie: true },
    });
    expect(after.lastTable?.reactions).toContainEqual(
      expect.objectContaining({
        speaker: 'marcus',
        kind: 'alibiDisproved',
        target: PLAYER_ID,
        room: 'cellar',
      }),
    );
    expect(after.player.lies[0]?.contradictedBy).toBe('marcus');
    expect(after.npcs.marcus?.suspicion.player ?? 0).toBeGreaterThan(before);
  });

  it('a true alibi a Detective witnessed is confirmed', () => {
    let s = tweak(newGame(), (d) =>
      pinSchedule(d, 'marcus', ['library', 'hall', 'hall', 'hall', 'hall', 'hall']),
    );
    s = play(s, { type: 'endDay' });
    const after = play(s, {
      type: 'resolveRoundTable',
      playerVote: 'theo',
      statement: { kind: 'alibi', room: 'hall', isLie: false },
    });
    expect(after.lastTable?.reactions).toContainEqual(
      expect.objectContaining({ speaker: 'marcus', kind: 'alibiConfirmed' }),
    );
  });
});
