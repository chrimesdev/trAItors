import { describe, expect, it } from 'vitest';
import { BALANCE, PLAYER_ID } from '../../src/sim';
import { newGame, pinSchedule, play, quietBalance, tweak } from './helpers';

describe('pressure on a passive Traitor', () => {
  it('staying quiet at the table raises everyone’s suspicion and someone says so', () => {
    const s = play(newGame(), { type: 'endDay' });
    const before = Object.fromEntries(Object.values(s.npcs).map((n) => [n.id, n.suspicion[PLAYER_ID] ?? 0]));
    const after = play(s, { type: 'resolveRoundTable', playerVote: 'theo', statement: { kind: 'quiet' } });
    expect(after.lastTable?.reactions).toContainEqual(expect.objectContaining({ kind: 'quietNoted' }));
    for (const n of Object.values(after.npcs).filter((x) => x.alive)) {
      expect(n.suspicion[PLAYER_ID] ?? 0, n.id).toBeGreaterThan(before[n.id] ?? 0);
    }
  });

  it('Faithfuls you spoke to today are spared the isolation penalty', () => {
    const b = quietBalance({ pressure: { quietPenalty: 0, pushedInnocentPenalty: 0, wrongVotePenalty: 0 } });
    let s = tweak(newGame(b), (d) => pinSchedule(d, 'dalton', 'hall'));
    s = play(s, { type: 'chat', npc: 'dalton' }, { type: 'endDay' });
    expect(s.player.contactsToday).toEqual(['dalton']);
    const dBefore = s.npcs.dalton?.suspicion.player ?? 0;
    const mBefore = s.npcs.marcus?.suspicion.player ?? 0;
    const after = play(s, {
      type: 'resolveRoundTable',
      playerVote: 'theo',
      statement: { kind: 'accuse', target: 'priya', isLie: false },
    });
    expect((after.npcs.dalton?.suspicion.player ?? 0) - dBefore).toBeLessThan(
      (after.npcs.marcus?.suspicion.player ?? 0) - mBefore,
    );
  });

  it('contacts reset each morning', () => {
    let s = tweak(newGame(), (d) => pinSchedule(d, 'dalton', 'hall'));
    s = play(s, { type: 'chat', npc: 'dalton' }, { type: 'endDay' });
    s = play(s, { type: 'resolveRoundTable', playerVote: 'theo' });
    if (s.phase === 'night') {
      s = play(s, {
        type: 'murder',
        victim: 'priya',
        room: Object.values(s.npcs.priya?.schedule ?? {})[0] as string,
      });
      expect(s.player.contactsToday).toEqual([]);
    }
  });
});

describe('the dead remember', () => {
  it('murdering someone who suspected you points the survivors at you', () => {
    let s = play(newGame(), { type: 'endDay' });
    s = tweak(s, (d) => {
      d.phase = 'night';
      const m = d.npcs.marcus;
      if (m) m.suspicion[PLAYER_ID] = 70;
    });
    const before = s.npcs.priya?.suspicion.player ?? 0;
    const room = Object.values(s.npcs.marcus?.schedule ?? {})[0] as string;
    const after = play(s, { type: 'murder', victim: 'marcus', room });
    expect(after.lastMurder?.lead).toBe(PLAYER_ID);
    expect(after.npcs.priya?.suspicion.player ?? 0).toBeGreaterThan(before);
  });

  it('a victim who suspected nobody in particular leaves no lead', () => {
    let s = play(newGame(), { type: 'endDay' });
    s = tweak(s, (d) => {
      d.phase = 'night';
    });
    const room = Object.values(s.npcs.marcus?.schedule ?? {})[0] as string;
    expect(play(s, { type: 'murder', victim: 'marcus', room }).lastMurder?.lead).toBeUndefined();
  });
});

describe('pushing an innocent', () => {
  it('accusing someone who is banished as a Faithful costs you credibility', () => {
    const b = quietBalance({ pressure: { quietPenalty: 0, isolationPenalty: 0 } });
    let s = play(newGame(b), { type: 'endDay' });
    s = tweak(s, (d) => {
      for (const n of Object.values(d.npcs)) if (n.id !== 'theo') n.suspicion.theo = 90;
    });
    const before = s.npcs.marcus?.suspicion.player ?? 0;
    const after = play(s, {
      type: 'resolveRoundTable',
      playerVote: 'theo',
      statement: { kind: 'accuse', target: 'theo', isLie: false },
    });
    expect(after.lastTable?.banished).toBe('theo');
    expect(after.npcs.marcus?.suspicion.player ?? 0).toBeGreaterThanOrEqual(
      before + BALANCE.pressure.pushedInnocentPenalty,
    );
  });
});
