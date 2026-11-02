import { describe, expect, it } from 'vitest';
import { newGame, pinSchedule, play, tweak } from './helpers';

/** Player in the kitchen at tick 0; Marcus spends the whole day in the cellar. */
function marcusInCellar() {
  return tweak(newGame(), (s) => {
    pinSchedule(s, 'marcus', 'cellar');
    pinSchedule(s, 'priya', ['kitchen', 'cellar', 'kitchen', 'kitchen', 'kitchen', 'kitchen']);
    s.player.room = 'kitchen';
  });
}

/** Skip the vote for night-only tests (fixture setup, not a rule). */
function toNight(s: ReturnType<typeof newGame>) {
  return tweak(play(s, { type: 'endDay' }), (d) => {
    d.phase = 'night';
  });
}

describe('night', () => {
  it('seen walking into the cellar by Marcus, then a murder in the cellar: Marcus suspects you by +30', () => {
    let s = play(marcusInCellar(), { type: 'move', to: 'cellar', sneaking: false });
    s = toNight(s);
    const before = s.npcs.marcus?.suspicion.player ?? 0;
    s = play(s, { type: 'murder', victim: 'priya', room: 'cellar' });
    expect(s.npcs.priya?.alive).toBe(false);
    expect(s.npcs.marcus?.suspicion.player).toBe(before + 30);
  });

  it('a murder somewhere you were not seen does not point at you', () => {
    let s = toNight(marcusInCellar());
    const before = s.npcs.marcus?.suspicion.player ?? 0;
    s = play(s, { type: 'murder', victim: 'priya', room: 'cellar' });
    expect(s.npcs.marcus?.suspicion.player).toBe(before);
  });

  it('NPCs seen in the body room are suspected by +15', () => {
    // Theo walks into the cellar at tick 1, where Marcus sees him.
    let s = tweak(marcusInCellar(), (d) =>
      pinSchedule(d, 'theo', ['kitchen', 'cellar', 'cellar', 'cellar', 'cellar', 'cellar']),
    );
    s = toNight(s);
    const before = s.npcs.marcus?.suspicion.theo ?? 0;
    s = play(s, { type: 'murder', victim: 'priya', room: 'cellar' });
    expect(s.npcs.marcus?.suspicion.theo).toBe(before + 15);
  });

  it('only rooms on the victim’s schedule are valid murder scenes', () => {
    const s = toNight(marcusInCellar());
    expect(() => play(s, { type: 'murder', victim: 'priya', room: 'library' })).toThrow(/never in library/);
  });

  it('morning: day advances, everyone is back in the hall, and suspicion is capped at 80', () => {
    let s = toNight(marcusInCellar());
    s = tweak(s, (d) => {
      const m = d.npcs.marcus;
      if (m) m.suspicion.theo = 100;
    });
    s = play(s, { type: 'murder', victim: 'priya', room: 'cellar' });
    expect(s.day).toBe(2);
    expect(s.phase).toBe('day');
    expect(s.player.room).toBe('hall');
    expect(Math.max(...Object.values(s.npcs.marcus?.suspicion ?? {}))).toBeLessThanOrEqual(80);
  });
});
