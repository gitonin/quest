/**
 * Audio.
 *
 * No audio assets ship with the game, so music and SFX are synthesised with
 * WebAudio in a chiptune style (square leads, triangle bass, noise percussion).
 * The public API is asset-agnostic: `playMusic('forest')` / `playSfx('sword')`.
 * Dropping real files in later means implementing the same two methods with
 * buffers - nothing else in the game touches the audio layer.
 */

export type MusicTrack = 'forest' | 'castle' | 'space' | 'boss' | 'victory';
export type SfxName =
  | 'sword'
  | 'swordHeavy'
  | 'magic'
  | 'heal'
  | 'hit'
  | 'hurt'
  | 'chest'
  | 'pickup'
  | 'levelUp'
  | 'menu'
  | 'dodge'
  | 'bossRoar';

interface Pattern {
  bpm: number;
  /** Semitone offsets from A2, `null` is a rest. */
  lead: Array<number | null>;
  bass: Array<number | null>;
  /** 1 = kick, 2 = hat, 0 = silence. */
  drums: number[];
  wave: OscillatorType;
}

const A2 = 110;

const PATTERNS: Record<MusicTrack, Pattern> = {
  forest: {
    bpm: 108,
    wave: 'square',
    lead: [12, 16, 19, 16, 14, 16, 12, null, 9, 12, 16, 12, 11, 12, 9, null],
    bass: [0, null, 7, null, 5, null, 7, null, -3, null, 4, null, 5, null, 7, null],
    drums: [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 2, 2, 0],
  },
  castle: {
    bpm: 92,
    wave: 'sawtooth',
    lead: [12, null, 15, 17, 18, 17, 15, null, 12, null, 10, 12, 13, null, 12, null],
    bass: [0, 0, -5, null, -3, null, -5, null, 0, 0, -7, null, -5, null, -8, null],
    drums: [1, 0, 0, 2, 1, 0, 2, 0, 1, 0, 0, 2, 1, 2, 0, 2],
  },
  space: {
    bpm: 124,
    wave: 'triangle',
    lead: [19, 24, 23, 19, 21, 19, 16, 19, 14, 19, 21, 23, 24, 23, 21, 19],
    bass: [0, 0, 7, 7, 5, 5, 3, 3, -2, -2, 5, 5, 3, 3, 7, 7],
    drums: [1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 1, 2],
  },
  boss: {
    bpm: 148,
    wave: 'sawtooth',
    lead: [12, 13, 12, 8, 12, 13, 15, 13, 12, 13, 12, 8, 6, 8, 10, 11],
    bass: [0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 0, 1, -2, -2, -1, -1],
    drums: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 1, 2, 2],
  },
  victory: {
    bpm: 100,
    wave: 'square',
    lead: [12, 16, 19, 24, 23, 19, 16, 19, 21, 24, 26, 24, 19, 16, 12, null],
    bass: [0, null, 7, null, 5, null, 7, null, 0, null, 4, null, 7, null, 0, null],
    drums: [1, 0, 2, 0, 1, 0, 2, 2, 1, 0, 2, 0, 1, 2, 1, 0],
  },
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noiseBuffer: AudioBuffer | null = null;
  private track: MusicTrack | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private timer = 0;
  musicVolume = 0.6;
  sfxVolume = 0.8;
  private started = false;

  /** Must be called from a user gesture on mobile. */
  unlock(): void {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume * 0.22;
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume * 0.4;
      this.sfxGain.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise();
      this.started = true;
      if (this.track) this.restartSequencer();
    } catch (err) {
      console.warn('[audio] unavailable', err);
    }
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (!this.ctx) return;
    this.musicGain.gain.value = music * 0.22;
    this.sfxGain.gain.value = sfx * 0.4;
  }

  playMusic(track: MusicTrack | null): void {
    if (this.track === track) return;
    this.track = track;
    this.restartSequencer();
  }

  private restartSequencer(): void {
    this.step = 0;
    this.nextNoteTime = this.ctx ? this.ctx.currentTime + 0.05 : 0;
    this.timer = 0;
  }

  /** Called once per frame; schedules the next few sixteenth notes. */
  update(dt: number): void {
    if (!this.ctx || !this.track || this.musicVolume <= 0) return;
    this.timer += dt;
    const pattern = PATTERNS[this.track];
    const stepDuration = 60 / pattern.bpm / 2;
    const lookahead = this.ctx.currentTime + 0.2;
    let guard = 0;
    while (this.nextNoteTime < lookahead && guard++ < 16) {
      this.scheduleStep(pattern, this.step % pattern.lead.length, this.nextNoteTime, stepDuration);
      this.nextNoteTime += stepDuration;
      this.step++;
    }
  }

  private scheduleStep(pattern: Pattern, index: number, time: number, duration: number): void {
    const lead = pattern.lead[index];
    if (lead !== null && lead !== undefined) {
      this.tone(A2 * Math.pow(2, lead / 12), time, duration * 0.9, pattern.wave, 0.28, this.musicGain);
    }
    const bass = pattern.bass[index];
    if (bass !== null && bass !== undefined) {
      this.tone(A2 * 0.5 * Math.pow(2, bass / 12), time, duration * 1.1, 'triangle', 0.42, this.musicGain);
    }
    const drum = pattern.drums[index];
    if (drum === 1) this.noise(time, 0.09, 900, 0.5, this.musicGain);
    else if (drum === 2) this.noise(time, 0.035, 5200, 0.16, this.musicGain);
  }

  playSfx(name: SfxName): void {
    if (!this.ctx || this.sfxVolume <= 0) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'sword':
        this.noise(t, 0.09, 2600, 0.5, this.sfxGain);
        this.sweep(760, 320, t, 0.1, 'square', 0.2);
        break;
      case 'swordHeavy':
        this.noise(t, 0.16, 1500, 0.7, this.sfxGain);
        this.sweep(520, 130, t, 0.22, 'sawtooth', 0.28);
        break;
      case 'magic':
        this.sweep(420, 1250, t, 0.24, 'sine', 0.24);
        this.sweep(640, 1800, t + 0.03, 0.2, 'triangle', 0.14);
        break;
      case 'heal':
        this.tone(880, t, 0.12, 'sine', 0.22, this.sfxGain);
        this.tone(1320, t + 0.09, 0.18, 'sine', 0.2, this.sfxGain);
        break;
      case 'hit':
        this.noise(t, 0.07, 1800, 0.55, this.sfxGain);
        break;
      case 'hurt':
        this.sweep(340, 120, t, 0.22, 'square', 0.3);
        break;
      case 'chest':
        this.tone(660, t, 0.1, 'square', 0.22, this.sfxGain);
        this.tone(880, t + 0.1, 0.1, 'square', 0.22, this.sfxGain);
        this.tone(1320, t + 0.2, 0.22, 'square', 0.24, this.sfxGain);
        break;
      case 'pickup':
        this.tone(1046, t, 0.06, 'square', 0.18, this.sfxGain);
        this.tone(1568, t + 0.05, 0.08, 'square', 0.18, this.sfxGain);
        break;
      case 'levelUp':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.09, 0.14, 'square', 0.22, this.sfxGain));
        break;
      case 'menu':
        this.tone(700, t, 0.05, 'square', 0.16, this.sfxGain);
        break;
      case 'dodge':
        this.sweep(900, 400, t, 0.12, 'sine', 0.15);
        break;
      case 'bossRoar':
        this.sweep(160, 60, t, 0.7, 'sawtooth', 0.4);
        this.noise(t, 0.6, 400, 0.5, this.sfxGain);
        break;
    }
  }

  private tone(
    freq: number,
    time: number,
    duration: number,
    wave: OscillatorType,
    gain: number,
    dest: GainNode,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(env);
    env.connect(dest);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private sweep(from: number, to: number, time: number, duration: number, wave: OscillatorType, gain: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + duration);
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private noise(time: number, duration: number, cutoff: number, gain: number, dest: GainNode): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(dest);
    src.start(time);
    src.stop(time + duration + 0.02);
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
