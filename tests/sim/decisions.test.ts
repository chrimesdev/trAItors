import { describe, expect, it } from 'vitest';
import { BALANCE, PLAYER_ID, legalCommands, roundTableSpeeches, validateCommand } from '../../src/sim';
import { newGame, pinSchedule, play, quietBalance, tweak } from './helpers';

describe('#5 the trust web starts with relationships from content', () => {
  it('Dalton and Priya are old friends; Theo distrusts the detectives', () => {
    const s = newGame();
    expect(s.npcs.dalton?.trusts.priya).toBeGreaterThan(0);
    expect(s.npcs.priya?.trusts.dalton).toBeGreaterThan(0);
    expect(s.npcs.theo?.trusts.marcus).toBeLessThan(0);
    expect(s.npcs.theo?.trusts.player).toBe(0);
  });
});

describe('#6 you can only claim to have seen someone where you were', () => {
  it('rejects a room you never visited today and offers lies only from rooms you did', () => {
    const s = tweak(newGame(), (d) => pinSchedule(d, 'priya', 'hall'));
    expect(
      validateCommand(s, { type: 'seedDoubt', npc: 'priya', target: 'theo', room: 'cellar', isLie: true }),
    ).toMatch(/never in cellar/);
    expect(
      validateCommand(s, { type: 'seedDoubt', npc: 'priya', target: 'theo', room: 'hall', isLie: true }),
    ).toBeNull();
    const lies = legalCommands(s).filter((c) => c.type === 'seedDoubt' && c.isLie);
    for (const c of lies) expect(c.type === 'seedDoubt' && c.room).toBe('hall');
  });
});

describe('#4 answering a caught lie at the table', () => {
  const caught = () => {
    let s = tweak(newGame(), (d) => {
      pinSchedule(d, 'marcus', ['library', 'hall', 'hall', 'hall', 'hall', 'hall']);
      pinSchedule(d, 'theo', 'hall');
    });
    // Marcus walks in on Theo in the hall at tick 1; claiming Theo was in the lounge is a lie he can disprove.
    s = play(
      s,
      { type: 'move', to: 'lounge', sneaking: false },
      { type: 'move', to: 'hall', sneaking: false },
    );
    s = play(
      s,
      { type: 'seedDoubt', npc: 'marcus', target: 'theo', room: 'lounge', isLie: true },
      { type: 'endDay' },
    );
    expect(roundTableSpeeches(s)).toContainEqual(expect.objectContaining({ kind: 'contradiction' }));
    return s;
  };

  it('standing by it costs the full penalty and keeps the rumour alive', () => {
    const s = caught();
    const before = s.npcs.marcus?.suspicion.player ?? 0;
    const after = play(s, { type: 'resolveRoundTable', playerVote: 'theo', answer: 'standBy' });
    expect((after.npcs.marcus?.suspicion.player ?? 0) - before).toBeGreaterThanOrEqual(
      BALANCE.lies.contradictionPenalty,
    );
    expect(after.rumours.some((r) => r.holder === 'marcus' && r.target === 'theo')).toBe(true);
    expect(after.lastTable?.answer).toBe('standBy');
    expect(after.lastTable?.reactions).toContainEqual(expect.objectContaining({ kind: 'lieStoodBy' }));
  });

  it('retracting halves the penalty, withdraws the rumour and costs trust', () => {
    const s = caught();
    const before = s.npcs.marcus?.suspicion.player ?? 0;
    const theoBefore = s.npcs.marcus?.suspicion.theo ?? 0;
    const after = play(s, { type: 'resolveRoundTable', playerVote: 'theo', answer: 'retract' });
    const delta = (after.npcs.marcus?.suspicion.player ?? 0) - before;
    expect(delta).toBeLessThan(BALANCE.lies.contradictionPenalty);
    expect(after.rumours.some((r) => r.target === 'theo')).toBe(false);
    expect(after.npcs.marcus?.suspicion.theo ?? 0).toBeLessThan(theoBefore);
    expect(after.npcs.marcus?.trusts.player ?? 0).toBeLessThan(0);
    expect(after.lastTable?.reactions).toContainEqual(expect.objectContaining({ kind: 'lieRetracted' }));
  });

  it('with nothing caught, no answer is recorded', () => {
    const s = play(newGame(), { type: 'endDay' });
    expect(play(s, { type: 'resolveRoundTable', playerVote: 'theo' }).lastTable?.answer).toBeUndefined();
  });
});

describe('#8 a gentler first day', () => {
  it('needs more suspicion to accuse the player on day 1 than on day 2', () => {
    const level = BALANCE.roundTable.accuseThreshold + 5;
    const s = tweak(play(newGame(), { type: 'endDay' }), (d) => {
      d.npcs.marcus!.suspicion[PLAYER_ID] = level;
    });
    expect(roundTableSpeeches(s)).not.toContainEqual(
      expect.objectContaining({ speaker: 'marcus', kind: 'accuse', target: PLAYER_ID }),
    );
    const day2 = tweak(s, (d) => {
      d.day = 2;
    });
    expect(roundTableSpeeches(day2)).toContainEqual(
      expect.objectContaining({ speaker: 'marcus', kind: 'accuse', target: PLAYER_ID }),
    );
  });

  it('a vague feeling is not enough to vote the player out on day 1', () => {
    const b = quietBalance({ pressure: { quietPenalty: 0, isolationPenalty: 0 } });
    const s = tweak(play(newGame(b), { type: 'endDay' }), (d) => {
      for (const n of Object.values(d.npcs)) n.suspicion[PLAYER_ID] = b.firstDay.playerVoteFloor - 5;
    });
    const day1 = play(s, { type: 'resolveRoundTable', playerVote: 'theo' });
    expect(Object.values(day1.lastTable?.votes ?? {}).filter((v) => v === PLAYER_ID)).toHaveLength(0);
    const day2 = play(
      tweak(s, (d) => {
        d.day = 2;
      }),
      { type: 'resolveRoundTable', playerVote: 'theo' },
    );
    expect(Object.values(day2.lastTable?.votes ?? {}).filter((v) => v === PLAYER_ID).length).toBeGreaterThan(
      0,
    );
  });

  it('being seen planting costs half on day 1', () => {
    const b = quietBalance();
    let s = tweak(newGame(b), (d) => {
      pinSchedule(d, 'priya', 'hall');
      d.player.inventory.push('gloves');
      d.evidence.gloves!.location = 'player';
    });
    const before = s.npcs.priya?.suspicion.player ?? 0;
    s = play(s, { type: 'plant', evidence: 'gloves', room: 'hall' });
    expect((s.npcs.priya?.suspicion.player ?? 0) - before).toBeCloseTo(
      b.evidence.witnessedPlantPenalty * b.firstDay.witnessFactor,
    );
  });
});
