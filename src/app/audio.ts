/**
 * Sound (M6): every effect and the ambient track are synthesised with WebAudio, so
 * the build ships no audio files and runs fully offline. Audio starts on the first
 * key press or click (browsers require a gesture). Settings persist in localStorage.
 */
export type Sfx = 'step' | 'sneakStep' | 'sting' | 'bell' | 'drumroll' | 'tick' | 'banish' | 'murder' | 'win';

export const AUDIO_KEY = 'traitors.audio.v1';

interface Settings {
  music: boolean;
  sfx: boolean;
}

// Chords for the ambient loop, as frequencies (A minor, F, D minor, E).
const CHORDS: number[][] = [
  [110, 165, 220, 261.6],
  [87.3, 130.8, 174.6, 220],
  [73.4, 110, 146.8, 174.6],
  [82.4, 123.5, 164.8, 207.7],
];
const CHORD_MS = 9000;

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private chord = 0;
  private settings: Settings = { music: true, sfx: true };
  private unlocked = false;

  constructor() {
    try {
      const raw = localStorage.getItem(AUDIO_KEY);
      if (raw) this.settings = { ...this.settings, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      // Storage blocked: defaults.
    }
    const unlock = (): void => this.unlock();
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
  }

  get music(): boolean {
    return this.settings.music;
  }

  get sfx(): boolean {
    return this.settings.sfx;
  }

  setMusic(on: boolean): void {
    this.settings.music = on;
    this.save();
    if (on) this.startMusic();
    else this.stopMusic();
  }

  setSfx(on: boolean): void {
    this.settings.sfx = on;
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(AUDIO_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
  }

  /** Creates the context on the first gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.unlocked) {
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    this.unlocked = true;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);

    const seconds = 1;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;

    void ctx.resume();
    if (this.settings.music) this.startMusic();
  }

  // ---------------------------------------------------------------- effects

  play(name: Sfx): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || !this.settings.sfx) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'step':
        this.noise(t, 0.06, 0.18, 'bandpass', 320);
        break;
      case 'sneakStep':
        this.noise(t, 0.08, 0.07, 'lowpass', 180);
        break;
      case 'tick':
        this.tone(t, 'square', 880, 0.04, 0.05);
        break;
      case 'bell':
        this.tone(t, 'sine', 660, 1.4, 0.18);
        this.tone(t, 'sine', 1320, 0.9, 0.06);
        this.tone(t + 0.5, 'sine', 660, 1.4, 0.14);
        break;
      case 'sting':
        this.tone(t, 'sawtooth', 293.7, 0.4, 0.12, 900);
        this.tone(t + 0.12, 'sawtooth', 415.3, 0.5, 0.12, 900);
        break;
      case 'drumroll':
        for (let i = 0; i < 18; i++) this.noise(t + i * 0.055, 0.04, 0.05 + i * 0.012, 'lowpass', 600);
        this.noise(t + 1.0, 0.18, 0.4, 'lowpass', 300);
        break;
      case 'banish':
        this.tone(t, 'sine', 110, 1.1, 0.35, undefined, 50);
        this.noise(t, 0.2, 0.3, 'lowpass', 200);
        break;
      case 'murder':
        this.tone(t, 'sawtooth', 110, 0.7, 0.16, 500);
        this.tone(t, 'sawtooth', 116.5, 0.7, 0.16, 500);
        this.tone(t, 'sawtooth', 164.8, 0.7, 0.12, 500);
        this.tone(t + 0.05, 'sine', 55, 0.9, 0.5, undefined, 30);
        this.noise(t, 0.25, 0.35, 'lowpass', 160);
        break;
      case 'win':
        for (const [i, f] of [261.6, 329.6, 392, 523.3].entries())
          this.tone(t + i * 0.12, 'triangle', f, 0.8, 0.14);
        break;
    }
  }

  private tone(
    at: number,
    type: OscillatorType,
    freq: number,
    seconds: number,
    gain: number,
    lowpass?: number,
    glideTo?: number,
  ): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(glideTo, at + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    let node: AudioNode = osc;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(lowpass * 3, at);
      f.frequency.exponentialRampToValueAtTime(lowpass, at + seconds);
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(bus);
    osc.start(at);
    osc.stop(at + seconds + 0.05);
  }

  private noise(at: number, seconds: number, gain: number, filter: BiquadFilterType, freq: number): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(at);
    src.stop(at + seconds + 0.02);
  }

  // ---------------------------------------------------------------- music

  private startMusic(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus || this.musicTimer !== null) return;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setTargetAtTime(0.11, ctx.currentTime, 1.5);
    const next = (): void => {
      this.pad(CHORDS[this.chord % CHORDS.length] ?? []);
      this.chord++;
      this.musicTimer = window.setTimeout(next, CHORD_MS);
    };
    next();
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (ctx && bus) bus.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
  }

  /** One slow chord: detuned triangles under a gently moving low-pass filter. */
  private pad(freqs: number[]): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    const seconds = CHORD_MS / 1000 + 2.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, t);
    filter.frequency.linearRampToValueAtTime(520, t + seconds / 2);
    filter.frequency.linearRampToValueAtTime(260, t + seconds);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 2.5);
    env.gain.setValueAtTime(1, t + seconds - 2.5);
    env.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    filter.connect(env);
    env.connect(bus);
    for (const f of freqs) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.25 / freqs.length;
        osc.connect(g);
        g.connect(filter);
        osc.start(t);
        osc.stop(t + seconds + 0.1);
      }
    }
    // A sparse high note now and then, like a clock somewhere in the house.
    if (Math.random() < 0.5) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = (freqs[3] ?? 261.6) * 2;
      const g = ctx.createGain();
      const at = t + 2 + Math.random() * 4;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 3);
      osc.connect(g);
      g.connect(bus);
      osc.start(at);
      osc.stop(at + 3.1);
    }
  }
}

export const audio = new Audio();
