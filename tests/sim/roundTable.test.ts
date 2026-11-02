import { describe, expect, it } from 'vitest';
import { PLAYER_ID, castVotes, type GameState } from '../../src/sim';
import { chooseBanished } from '../../src/sim/roundTable';
import { newGame, play, tweak } from './helpers';

function atTable(setup: (d: GameState) => void = () => {}): GameState {
  return tweak(play(newGame(), { type: 'endDay' }), setup);
}

function setTop(d: GameState, npc: string, target: string, score = 60): void {
  const n = d.npcs[npc];
  if (n) n.suspicion[target] = score;
}

describe('votes', () => {
  it('a Loyalist allied to the player votes with the player', () => {
    const s = atTable((d) => {
      const dalton = d.npcs.dalton;
      if (dalton) dalton.allyOf = PLAYER_ID;
      setTop(d, 'dalton', 'priya', 90);
    });
    expect(castVotes(s, 'theo').dalton).toBe('theo');
  });

  it('a Sheep follows the majority', () => {
    const s = atTable((d) => {
      setTop(d, 'marcus', 'imogen');
      setTop(d, 'rosa', 'imogen');
      setTop(d, 'priya', 'theo', 90); // Priya personally suspects Theo...
    });
    expect(castVotes(s, 'imogen').priya).toBe('imogen'); // ...but goes with the crowd.
  });

  it('a Grudge votes for whoever accused them last', () => {
    const s = atTable((d) => {
      const imogen = d.npcs.imogen;
      if (imogen) imogen.lastAccusedBy = 'rosa';
      setTop(d, 'imogen', 'theo', 90);
    });
    expect(castVotes(s, 'theo').imogen).toBe('rosa');
  });

  it('a bribed NPC will not vote for the player today', () => {
    const s = atTable((d) => {
      setTop(d, 'marcus', PLAYER_ID, 95);
      const m = d.npcs.marcus;
      if (m) m.bribedDay = d.day;
    });
    expect(castVotes(s, 'theo').marcus).not.toBe(PLAYER_ID);
  });

  it('nobody votes for themselves', () => {
    const s = atTable();
    const votes = castVotes(s, 'theo');
    for (const [voter, target] of Object.entries(votes)) expect(target).not.toBe(voter);
  });
});

describe('banishment', () => {
  it('ties go against the player', () => {
    const s = atTable();
    const votes = { marcus: PLAYER_ID, priya: PLAYER_ID, dalton: 'theo', imogen: 'theo', player: 'rosa' };
    expect(chooseBanished(s, votes)).toBe(PLAYER_ID);
  });

  it('the player loses when banished', () => {
    const s = atTable((d) => {
      for (const n of Object.values(d.npcs)) n.suspicion[PLAYER_ID] = 95;
    });
    const after = play(s, { type: 'resolveRoundTable', playerVote: 'theo' });
    expect(after.outcome).toBe('lose');
    expect(after.phase).toBe('ended');
  });

  it('a banished Faithful dies and the game moves to night', () => {
    const s = atTable((d) => {
      for (const n of Object.values(d.npcs)) if (n.id !== 'theo') n.suspicion.theo = 95;
    });
    const after = play(s, { type: 'resolveRoundTable', playerVote: 'theo' });
    expect(after.lastVote?.banished).toBe('theo');
    expect(after.npcs.theo?.alive).toBe(false);
    expect(after.phase).toBe('night');
  });

  it('voting together builds trust; voting against someone costs it', () => {
    const s = atTable((d) => {
      for (const n of Object.values(d.npcs)) if (n.id !== 'theo') n.suspicion.theo = 95;
    });
    const after = play(s, { type: 'resolveRoundTable', playerVote: 'theo' });
    expect(after.npcs.marcus?.trusts.rosa ?? 0).toBeGreaterThan(0);
    expect(after.npcs.marcus?.trusts[PLAYER_ID] ?? 0).toBeGreaterThan(0);
  });
});

describe('player statements', () => {
  it('accusing someone makes them hold a grudge against you', () => {
    const s = atTable();
    const after = play(s, {
      type: 'resolveRoundTable',
      playerVote: 'theo',
      statement: { kind: 'accuse', target: 'imogen', isLie: false },
    });
    expect(after.npcs.imogen?.lastAccusedBy).toBe(PLAYER_ID);
  });

  it('a lie is logged against the player', () => {
    const s = atTable();
    const after = play(s, {
      type: 'resolveRoundTable',
      playerVote: 'theo',
      statement: { kind: 'accuse', target: 'imogen', isLie: true },
    });
    expect(after.player.lies).toHaveLength(1);
  });
});
