/**
 * 100% In-App Procedural Calming Ambient Engine (Web Audio API)
 * Inspired by slow, pastoral major-key felt piano & warm harmonic pad atmospheres
 * (zero external network calls, zero YouTube embeds, zero sharp transients).
 *
 * Signal flow:
 *   Pad Choir Voices ─┐
 *   Felt Piano Notes ─┼─> Dry Bus ───────────────┐
 *   Warm Room Air ────┘    └─> Stereo Hall Reverb ┼─> Warm Lowpass ─> Soft Compressor ─> Master Gain ─> Destination
 */

interface ChordBar {
  name: string;
  /** Low & mid warm pad frequencies (Hz) */
  pad: number[];
  /** Melodic upper-register felt piano tones (Hz) */
  melody: number[];
  /** Gentle left-hand arpeggio / bass anchor tones (Hz) */
  anchor: number[];
}

// Peaceful F Major pastoral progression (~7.5s per bar, 8 bars = 60s evolving cycle)
const PASTORAL_PROGRESSION: ChordBar[] = [
  {
    name: 'Fmaj9',
    pad: [174.61, 261.63, 329.63, 392.0], // F3, C4, E4, G4
    anchor: [130.81, 174.61, 220.0], // C3, F3, A3
    melody: [440.0, 523.25, 587.33, 659.25, 698.46, 783.99], // A4, C5, D5, E5, F5, G5
  },
  {
    name: 'Dm9',
    pad: [146.83, 220.0, 261.63, 329.63], // D3, A3, C4, E4
    anchor: [146.83, 220.0, 261.63], // D3, A3, C4
    melody: [392.0, 440.0, 523.25, 587.33, 659.25, 698.46], // G4, A4, C5, D5, E5, F5
  },
  {
    name: 'Bbadd9',
    pad: [116.54, 174.61, 261.63, 293.66], // Bb2, F3, C4, D4
    anchor: [116.54, 174.61, 233.08], // Bb2, F3, Bb3
    melody: [349.23, 392.0, 440.0, 523.25, 587.33, 698.46], // F4, G4, A4, C5, D5, F5
  },
  {
    name: 'C6/9',
    pad: [130.81, 196.0, 220.0, 293.66], // C3, G3, A3, D4
    anchor: [130.81, 196.0, 261.63], // C3, G3, C4
    melody: [392.0, 440.0, 523.25, 587.33, 659.25, 783.99], // G4, A4, C5, D5, E5, G5
  },
  {
    name: 'Am7',
    pad: [110.0, 164.81, 196.0, 261.63], // A2, E3, G3, C4
    anchor: [110.0, 164.81, 220.0], // A2, E3, A3
    melody: [392.0, 440.0, 523.25, 587.33, 659.25, 783.99], // G4, A4, C5, D5, E5, G5
  },
  {
    name: 'Dm9_soft',
    pad: [146.83, 220.0, 261.63, 349.23], // D3, A3, C4, F4
    anchor: [146.83, 174.61, 220.0], // D3, F3, A3
    melody: [440.0, 523.25, 587.33, 659.25, 698.46, 880.0], // A4, C5, D5, E5, F5, A5
  },
  {
    name: 'Gm9',
    pad: [196.0, 233.08, 293.66, 349.23], // G3, Bb3, D4, F4
    anchor: [146.83, 196.0, 233.08], // D3, G3, Bb3
    melody: [349.23, 392.0, 440.0, 466.16, 587.33, 698.46], // F4, G4, A4, Bb4, D5, F5
  },
  {
    name: 'C9sus4',
    pad: [130.81, 174.61, 196.0, 293.66], // C3, F3, G3, D4
    anchor: [130.81, 174.61, 196.0], // C3, F3, G3
    melody: [349.23, 392.0, 440.0, 523.25, 587.33, 659.25], // F4, G4, A4, C5, D5, E5
  },
];

// Gentle, lyrical rhythmic offset patterns (in seconds within a 7.6s bar)
// Leaves generous silence for nervous-system settling
const MELODY_PATTERNS: Array<Array<{ offset: number; idx: number; vel: number; dur: number }>> = [
  [
    { offset: 0.4, idx: 1, vel: 0.65, dur: 4.2 },
    { offset: 2.1, idx: 3, vel: 0.58, dur: 3.8 },
    { offset: 3.7, idx: 4, vel: 0.52, dur: 4.6 },
    { offset: 5.8, idx: 2, vel: 0.45, dur: 3.6 },
  ],
  [
    { offset: 0.7, idx: 3, vel: 0.62, dur: 4.4 },
    { offset: 2.7, idx: 2, vel: 0.54, dur: 3.9 },
    { offset: 4.6, idx: 0, vel: 0.5, dur: 4.8 },
  ],
  [
    { offset: 0.5, idx: 2, vel: 0.58, dur: 4.0 },
    { offset: 1.9, idx: 4, vel: 0.56, dur: 4.4 },
    { offset: 3.9, idx: 5, vel: 0.46, dur: 4.6 },
    { offset: 5.9, idx: 3, vel: 0.48, dur: 3.8 },
  ],
  [
    { offset: 1.1, idx: 4, vel: 0.55, dur: 4.6 },
    { offset: 3.4, idx: 1, vel: 0.52, dur: 4.4 },
    { offset: 5.6, idx: 2, vel: 0.46, dur: 4.2 },
  ],
];

const BAR_DURATION_SEC = 7.6;
const SCHEDULE_AHEAD_SEC = 1.6;
const SCHEDULER_TICK_MS = 280;
const FADE_IN_SEC = 0.65;
const FADE_OUT_SEC = 0.55;
const DISPOSE_FADE_SEC = 0.45;
const MAX_MASTER_GAIN = 0.42;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? win.webkitAudioContext ?? null;
}

/** Synthesize a lush, smoothly damped stereo hall reverb impulse response */
function createWarmHallImpulse(ctx: AudioContext, durationSec = 3.5): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const preDelaySamples = Math.floor(sampleRate * 0.045);

  for (let ch = 0; ch < 2; ch += 1) {
    const channelData = impulse.getChannelData(ch);
    let lpState = 0;
    for (let i = 0; i < length; i += 1) {
      if (i < preDelaySamples) {
        channelData[i] = 0;
        continue;
      }
      const t = (i - preDelaySamples) / (length - preDelaySamples);
      // Soft bloom attack + warm exponential tail
      const bloom = Math.min(1, t * 14);
      const decay = Math.pow(1 - t, 2.75);
      const white = Math.random() * 2 - 1;
      // Progressive low-pass damping so higher frequencies decay softly first
      const dampCoeff = 0.14 + 0.12 * (1 - t);
      lpState += dampCoeff * (white - lpState);
      channelData[i] = lpState * bloom * decay * 0.65;
    }
  }
  return impulse;
}

/** Synthesize a looping ultra-gentle pink-weighted room air buffer */
function createRoomAirBuffer(ctx: AudioContext, durationSec = 4): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      const pink = (b0 + b1 + b2 + white * 0.1848) * 0.045;
      // Seamless cosine crossfade at buffer edges to prevent any loop click
      const edgeSamples = Math.floor(sampleRate * 0.25);
      let env = 1;
      if (i < edgeSamples) {
        env = 0.5 - 0.5 * Math.cos((Math.PI * i) / edgeSamples);
      } else if (i > length - edgeSamples) {
        env = 0.5 - 0.5 * Math.cos((Math.PI * (length - i)) / edgeSamples);
      }
      data[i] = pink * env;
    }
  }
  return buffer;
}

function perceptualGain(volume01: number, muted: boolean): number {
  if (muted) return 0.0001;
  const clamped = Math.max(0, Math.min(1, volume01));
  if (clamped <= 0.001) return 0.0001;
  return Math.max(0.0001, Math.pow(clamped, 1.55) * MAX_MASTER_GAIN);
}

export class SoothingAmbientEngine {
  private ctx: AudioContext | null = null;
  private dryBus: GainNode | null = null;
  private reverbBus: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private airSource: AudioBufferSourceNode | null = null;

  private schedulerTimer: number | null = null;
  private pauseTimer: number | null = null;
  private disposeTimer: number | null = null;

  private isPlaying = false;
  private isDisposed = false;
  private nextBarTime = 0;
  private barIndex = 0;
  private volume01 = 0.45;
  private muted = false;

  /** Lazily initialize the Web Audio graph inside a user-gesture or playback call */
  private ensureGraph(): AudioContext | null {
    if (this.isDisposed) return null;
    if (this.ctx) return this.ctx;

    const AudioCtx = getAudioContextConstructor();
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();

    const dryBus = ctx.createGain();
    dryBus.gain.value = 0.78;

    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.52;

    const convolver = ctx.createConvolver();
    convolver.buffer = createWarmHallImpulse(ctx, 3.5);

    const warmFilter = ctx.createBiquadFilter();
    warmFilter.type = 'lowpass';
    warmFilter.frequency.value = 2750;
    warmFilter.Q.value = 0.55;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.03;
    compressor.release.value = 0.35;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    // Subtle warm acoustic room air bed (adds organic calm without hiss)
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'lowpass';
    airFilter.frequency.value = 380;
    airFilter.Q.value = 0.4;

    const airGain = ctx.createGain();
    airGain.gain.value = 0.038;

    const airSource = ctx.createBufferSource();
    airSource.buffer = createRoomAirBuffer(ctx, 4.2);
    airSource.loop = true;
    airSource.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(dryBus);
    airSource.start();

    dryBus.connect(warmFilter);
    reverbSend.connect(convolver);
    convolver.connect(warmFilter);

    warmFilter.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    this.ctx = ctx;
    this.dryBus = dryBus;
    this.reverbBus = reverbSend;
    this.masterGain = masterGain;
    this.airSource = airSource;

    return ctx;
  }

  /** Schedule one lush, slowly breathing pad chord voice */
  private schedulePadVoice(freq: number, startTime: number, duration: number, pan: number, gainPeak: number) {
    const ctx = this.ctx;
    const dry = this.dryBus;
    const wet = this.reverbBus;
    if (!ctx || !dry || !wet) return;

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = 'sine';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(freq, startTime);
    // Gentle choral detune (+3.2 cents) for warm cinematic shimmer
    oscB.frequency.setValueAtTime(freq * 1.00185, startTime);

    const mixA = ctx.createGain();
    const mixB = ctx.createGain();
    mixA.gain.value = 0.78;
    mixB.gain.value = 0.16;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(540, startTime);
    filter.frequency.linearRampToValueAtTime(860, startTime + duration * 0.45);
    filter.frequency.linearRampToValueAtTime(480, startTime + duration);
    filter.Q.value = 0.6;

    const env = ctx.createGain();
    const attack = Math.min(2.3, duration * 0.3);
    const release = Math.min(3.1, duration * 0.4);
    const sustainEnd = Math.max(startTime + attack + 0.2, startTime + duration - release);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(gainPeak, startTime + attack);
    env.gain.setValueAtTime(gainPeak * 0.92, sustainEnd);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(pan, startTime);
    }

    oscA.connect(mixA);
    oscB.connect(mixB);
    mixA.connect(filter);
    mixB.connect(filter);
    filter.connect(env);

    if (panner) {
      env.connect(panner);
      panner.connect(dry);
      panner.connect(wet);
    } else {
      env.connect(dry);
      env.connect(wet);
    }

    oscA.start(startTime);
    oscB.start(startTime);
    oscA.stop(startTime + duration + 0.15);
    oscB.stop(startTime + duration + 0.15);
  }

  /** Schedule one gentle felt-piano note with soft hammer attack & natural exponential decay */
  private scheduleFeltPianoNote(freq: number, startTime: number, velocity: number, duration: number) {
    const ctx = this.ctx;
    const dry = this.dryBus;
    const wet = this.reverbBus;
    if (!ctx || !dry || !wet) return;

    const fundamental = ctx.createOscillator();
    const overtone2 = ctx.createOscillator();
    const overtone3 = ctx.createOscillator();

    fundamental.type = 'sine';
    overtone2.type = 'sine';
    overtone3.type = 'triangle';

    fundamental.frequency.setValueAtTime(freq, startTime);
    overtone2.frequency.setValueAtTime(freq * 2, startTime);
    overtone3.frequency.setValueAtTime(freq * 3.001, startTime);

    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    const g3 = ctx.createGain();
    g1.gain.value = 0.82;
    g2.gain.value = 0.14;
    g3.gain.value = 0.045;

    // Felt damper low-pass sweeps warmly downward as note rings out
    const damper = ctx.createBiquadFilter();
    damper.type = 'lowpass';
    const brightStart = Math.min(2200, Math.max(900, freq * 2.6 + velocity * 500));
    damper.frequency.setValueAtTime(brightStart, startTime);
    damper.frequency.exponentialRampToValueAtTime(
      Math.max(420, freq * 1.15),
      startTime + Math.min(1.8, duration * 0.55)
    );
    damper.Q.value = 0.7;

    const env = ctx.createGain();
    const peak = Math.max(0.01, Math.min(0.22, velocity * 0.19));
    // Soft 22ms attack eliminates any sharp transient or startle click
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peak, startTime + 0.022);
    env.gain.exponentialRampToValueAtTime(peak * 0.42, startTime + 0.65);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    const drySend = ctx.createGain();
    const wetSend = ctx.createGain();
    drySend.gain.value = 0.68;
    wetSend.gain.value = 0.92;

    // Subtle stereo placement by pitch (lower notes gently left, higher notes gently right)
    const panVal = Math.max(-0.32, Math.min(0.32, ((freq - 380) / 500) * 0.28));
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(panVal, startTime);
    }

    fundamental.connect(g1);
    overtone2.connect(g2);
    overtone3.connect(g3);
    g1.connect(damper);
    g2.connect(damper);
    g3.connect(damper);
    damper.connect(env);

    if (panner) {
      env.connect(panner);
      panner.connect(drySend);
      panner.connect(wetSend);
    } else {
      env.connect(drySend);
      env.connect(wetSend);
    }
    drySend.connect(dry);
    wetSend.connect(wet);

    fundamental.start(startTime);
    overtone2.start(startTime);
    overtone3.start(startTime);

    const stopTime = startTime + duration + 0.12;
    fundamental.stop(stopTime);
    overtone2.stop(stopTime);
    overtone3.stop(stopTime);
  }

  /** Schedule one complete harmonic bar (warm pad + gentle left-hand anchor + melodic motif) */
  private scheduleBar(barStartTime: number, barIdx: number) {
    const chord = PASTORAL_PROGRESSION[barIdx % PASTORAL_PROGRESSION.length];
    // Overlap pad slightly into next bar for seamless harmonic breathing
    const padDur = BAR_DURATION_SEC + 1.8;

    chord.pad.forEach((freq, i) => {
      const pan = i % 2 === 0 ? -0.24 - i * 0.05 : 0.24 + i * 0.05;
      const gain = i === 0 ? 0.095 : 0.068;
      this.schedulePadVoice(freq, barStartTime + i * 0.06, padDur, pan, gain);
    });

    // Gentle left-hand felt piano anchor arpeggio (slow rolling 3-note chord)
    chord.anchor.forEach((freq, i) => {
      const jitter = (Math.random() - 0.5) * 0.03;
      const offset = 0.08 + i * 0.42 + jitter;
      this.scheduleFeltPianoNote(freq, barStartTime + Math.max(0.02, offset), 0.52 - i * 0.05, 5.2);
    });

    // Lyrical, unhurried upper-register motif (varies naturally across bars)
    const pattern = MELODY_PATTERNS[(barIdx + Math.floor(barIdx / 4)) % MELODY_PATTERNS.length];
    pattern.forEach((step) => {
      // Gently breathe by occasionally omitting the final ornament note for serene openness
      if (step.offset > 5.2 && barIdx % 3 === 1) return;
      const noteFreq = chord.melody[step.idx % chord.melody.length];
      const humanOffset = step.offset + (Math.random() - 0.5) * 0.045;
      const velJitter = step.vel * (0.9 + Math.random() * 0.18);
      this.scheduleFeltPianoNote(noteFreq, barStartTime + Math.max(0.1, humanOffset), velJitter, step.dur);
    });
  }

  private runScheduler = () => {
    if (!this.isPlaying || !this.ctx || this.ctx.state !== 'running') return;
    while (this.nextBarTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this.scheduleBar(this.nextBarTime, this.barIndex);
      this.nextBarTime += BAR_DURATION_SEC;
      this.barIndex += 1;
    }
  };

  /** Start or resume playback with a smooth, non-startling gain fade-in (~650ms) */
  public async start(volume01: number, muted: boolean): Promise<boolean> {
    if (this.isDisposed) return false;
    this.volume01 = volume01;
    this.muted = muted;

    if (this.pauseTimer !== null) {
      window.clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }

    const ctx = this.ensureGraph();
    if (!ctx || !this.masterGain) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }

    if ((ctx.state as string) !== 'running') {
      return false;
    }

    const now = ctx.currentTime;
    const targetGain = perceptualGain(this.volume01, this.muted);

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.nextBarTime = now + 0.05;
      this.runScheduler();
      if (this.schedulerTimer !== null) window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = window.setInterval(this.runScheduler, SCHEDULER_TICK_MS);
    }

    this.masterGain.gain.cancelScheduledValues(now);
    const currentVal = Math.max(0.0001, this.masterGain.gain.value);
    this.masterGain.gain.setValueAtTime(currentVal, now);
    this.masterGain.gain.linearRampToValueAtTime(targetGain, now + FADE_IN_SEC);

    return true;
  }

  /** Smoothly adjust volume or mute state without pops or restarts */
  public setVolume(volume01: number, muted: boolean): void {
    this.volume01 = volume01;
    this.muted = muted;
    if (!this.ctx || !this.masterGain || !this.isPlaying) return;

    const now = this.ctx.currentTime;
    const target = perceptualGain(volume01, muted);
    this.masterGain.gain.cancelScheduledValues(now);
    const currentVal = Math.max(0.0001, this.masterGain.gain.value);
    this.masterGain.gain.setValueAtTime(currentVal, now);
    this.masterGain.gain.linearRampToValueAtTime(target, now + 0.22);
  }

  /** Gently fade out (~550ms) and suspend AudioContext to conserve CPU/battery */
  public pause(): void {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    const currentVal = Math.max(0.0001, this.masterGain.gain.value);
    this.masterGain.gain.setValueAtTime(currentVal, now);
    this.masterGain.gain.linearRampToValueAtTime(0.0001, now + FADE_OUT_SEC);

    if (this.pauseTimer !== null) window.clearTimeout(this.pauseTimer);
    this.pauseTimer = window.setTimeout(() => {
      this.pauseTimer = null;
      if (!this.isPlaying && this.ctx && this.ctx.state === 'running') {
        void this.ctx.suspend().catch(() => {});
      }
    }, Math.round((FADE_OUT_SEC + 0.08) * 1000));
  }

  /** Fade out gently (~450ms) and cleanly release all audio resources on exit/unmount */
  public stopAndDispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.isPlaying = false;

    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.pauseTimer !== null) {
      window.clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }

    const ctx = this.ctx;
    const masterGain = this.masterGain;
    const airSource = this.airSource;

    this.ctx = null;
    this.dryBus = null;
    this.reverbBus = null;
    this.masterGain = null;
    this.airSource = null;

    if (!ctx) return;

    const finalizeClose = () => {
      try {
        airSource?.stop();
      } catch {
        // Already stopped
      }
      if (ctx.state !== 'closed') {
        void ctx.close().catch(() => {});
      }
    };

    if (masterGain && ctx.state === 'running') {
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      const currentVal = Math.max(0.0001, masterGain.gain.value);
      masterGain.gain.setValueAtTime(currentVal, now);
      masterGain.gain.linearRampToValueAtTime(0.0001, now + DISPOSE_FADE_SEC);

      if (this.disposeTimer !== null) window.clearTimeout(this.disposeTimer);
      this.disposeTimer = window.setTimeout(() => {
        this.disposeTimer = null;
        finalizeClose();
      }, Math.round((DISPOSE_FADE_SEC + 0.08) * 1000));
    } else {
      finalizeClose();
    }
  }
}
