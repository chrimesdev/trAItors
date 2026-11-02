import { describe, expect, it } from 'vitest';
import { PLAYER_ID, type Archetype, type Speech, type SpeechKind } from '../../src/sim';
import { fill, greet, speak } from '../../src/sim/dialogue';
import { newGame, tweak } from './helpers';

const KINDS: SpeechKind[] = [
  'evidence',
  'caughtPlanting',
  'contradiction',
  'bribeExposed',
  'accuse',
  'defend',
  'grudge',
  'alibiConfirmed',
  'alibiDisproved',
  'quietNoted',
];
const SPEAKERS: Record<Archetype, string> = {
  detective: 'marcus',
  sheep: 'priya',
  loyalist: 'dalton',
  grudge: 'imogen',
  paranoid: 'theo',
};

/** A state with a rumour so contradiction lines have something to refer to. */
function withRumour() {
  return tweak(newGame(), (s) => {
    s.rumours.push({
      id: 99,
      origin: PLAYER_ID,
      teller: PLAYER_ID,
      holder: 'marcus',
      target: 'theo',
      claim: 'seenNear',
      room: 'library',
      strength: 15,
      day: 1,
      isLie: true,
    });
  });
}

describe('dialogue', () => {
  it('fill replaces slots and capitalises {Target}', () => {
    expect(fill('{Target} saw {target} in the {room}.', { target: 'you', room: 'Library' })).toBe(
      'You saw you in the Library.',
    );
  });

  it('every speech kind renders for every archetype with no leftover slots', () => {
    const s = withRumour();
    for (const kind of KINDS) {
      for (const speaker of Object.values(SPEAKERS)) {
        for (const target of [PLAYER_ID, 'rosa']) {
          const sp: Speech = { speaker, kind, target, room: 'library', evidence: 'gloves', rumourId: 99 };
          const line = speak(s, sp);
          expect(line, `${kind}/${speaker}`).not.toMatch(/[{}]/);
          expect(line.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it('evidence with no target, and evidence raised by the player, have their own lines', () => {
    const s = newGame();
    expect(speak(s, { speaker: 'priya', kind: 'evidence', evidence: 'gloves', room: 'dining' })).toMatch(
      /gloves/,
    );
    expect(
      speak(s, { speaker: PLAYER_ID, kind: 'evidence', evidence: 'gloves', room: 'dining', target: 'priya' }),
    ).toMatch(/^You /);
  });

  it('the player is addressed as "you"', () => {
    const line = speak(newGame(), {
      speaker: 'marcus',
      kind: 'caughtPlanting',
      target: PLAYER_ID,
      evidence: 'gloves',
      room: 'hall',
    });
    expect(line.toLowerCase()).toContain('you');
    expect(line).not.toContain('player');
  });

  it('is deterministic and does not touch the RNG', () => {
    const s = newGame();
    const sp: Speech = { speaker: 'marcus', kind: 'accuse', target: 'theo' };
    const rngBefore = s.rng.state;
    expect(speak(s, sp)).toBe(speak(s, sp));
    expect(s.rng.state).toBe(rngBefore);
  });

  it('greetings change with how the NPC feels about you', () => {
    const warm = tweak(newGame(), (d) => {
      const m = d.npcs.marcus;
      if (m) m.suspicion[PLAYER_ID] = 0;
    });
    const cold = tweak(newGame(), (d) => {
      const m = d.npcs.marcus;
      if (m) m.suspicion[PLAYER_ID] = 90;
    });
    expect(greet(warm, 'marcus')).not.toBe(greet(cold, 'marcus'));
  });
});
