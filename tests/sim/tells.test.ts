import { describe, expect, it } from 'vitest';
import { PLAYER_ID, rumourText, watchingYou, whispersSince } from '../../src/sim';
import { newGame, pinSchedule, play, quietBalance, tweak } from './helpers';

const logText = (s: ReturnType<typeof newGame>): string => s.log.map((e) => e.text).join('\n');

describe('glances', () => {
  it('lists the wary NPCs in your room, and only them', () => {
    const s = tweak(newGame(), (d) => {
      pinSchedule(d, 'marcus', 'hall');
      pinSchedule(d, 'priya', 'hall');
      pinSchedule(d, 'theo', 'cellar');
      d.npcs.marcus!.suspicion[PLAYER_ID] = 50;
      d.npcs.theo!.suspicion[PLAYER_ID] = 90;
      d.npcs.priya!.suspicion[PLAYER_ID] = 10;
    });
    expect(watchingYou(s)).toEqual(['marcus']);
  });

  it('a wary NPC who sees you walk in keeps looking, and the log says so', () => {
    const base = tweak(newGame(), (d) => pinSchedule(d, 'marcus', 'lounge'));
    const wary = tweak(base, (d) => {
      d.npcs.marcus!.suspicion[PLAYER_ID] = 50;
    });
    expect(logText(play(wary, { type: 'move', to: 'lounge', sneaking: false }))).toContain(
      "Marcus's eyes follow you",
    );
    expect(logText(play(base, { type: 'move', to: 'lounge', sneaking: false }))).not.toContain(
      'eyes follow you',
    );
  });

  it('nobody glances at a sneak they did not notice', () => {
    const s = tweak(newGame(quietBalance({ detection: { sneakingDetect: { detective: 0 } } })), (d) => {
      pinSchedule(d, 'marcus', 'lounge');
      d.npcs.marcus!.suspicion[PLAYER_ID] = 50;
    });
    expect(logText(play(s, { type: 'move', to: 'lounge', sneaking: true }))).not.toContain('eyes follow');
  });

  it('a wary NPC walking in on you makes it obvious', () => {
    const s = tweak(newGame(), (d) => {
      pinSchedule(d, 'marcus', ['library', 'lounge', 'lounge', 'lounge', 'lounge', 'lounge']);
      d.npcs.marcus!.suspicion[PLAYER_ID] = 50;
    });
    const after = play(s, { type: 'move', to: 'lounge', sneaking: false });
    expect(logText(after)).toContain("Marcus comes in and doesn't take their eyes off you");
  });
});

describe('whispers', () => {
  const gossip = quietBalance({ rumours: { exchangeChance: 1 } });

  it('reads a rumour as a clause, in the second person when it is about you', () => {
    const s = newGame();
    expect(rumourText(s, { target: 'theo', claim: 'seenNear', room: 'cellar' })).toBe(
      'Theo was near the Wine Cellar',
    );
    expect(rumourText(s, { target: 'theo', claim: 'actedShifty' })).toBe('Theo has been acting shifty');
    expect(rumourText(s, { target: PLAYER_ID, claim: 'seenNear', room: 'hall' })).toBe(
      'you were near the Great Hall',
    );
  });

  it('you overhear rumours passed on in your room, and the scene can show them', () => {
    const s = tweak(newGame(gossip), (d) => {
      pinSchedule(d, 'priya', 'hall');
      pinSchedule(d, 'dalton', 'hall');
    });
    const after = play(s, { type: 'seedDoubt', npc: 'priya', target: 'theo', isLie: false });
    expect(logText(after)).toContain('You overhear Priya whisper to Dalton that Theo has been acting shifty');
    const whispers = whispersSince(after, s.nextRumourId);
    expect(whispers).toHaveLength(1);
    expect(whispers[0]).toMatchObject({ teller: 'priya', holder: 'dalton', target: 'theo' });
  });

  it('whispers in another room are shown but not overheard', () => {
    let s = tweak(newGame(), (d) => {
      pinSchedule(d, 'priya', 'lounge');
      pinSchedule(d, 'dalton', 'lounge');
    });
    s = play(
      s,
      { type: 'move', to: 'lounge', sneaking: false },
      { type: 'seedDoubt', npc: 'priya', target: 'theo', isLie: false },
    );
    s = tweak(s, (d) => {
      d.balance.rumours.exchangeChance = 1;
    });
    const after = play(s, { type: 'move', to: 'hall', sneaking: false });
    expect(whispersSince(after, s.nextRumourId)).toHaveLength(1);
    expect(logText(after)).not.toContain('overhear');
  });
});
