// Web Audio API 程序化音效 + 8-bit 音乐编曲器（零外部音频素材）

type Wave = OscillatorType | 'pulse25' | 'pulse12';

interface ChannelDef {
  wave: Wave;
  vol: number;
  notes: string;
  release?: number;
  detune?: number;
}
interface TrackDef {
  bpm: number;
  chans: ChannelDef[];
  drums?: string;
  drumVol?: number;
}
interface NoteEv {
  freq: number;
  len: number;
}
interface CompiledChan {
  def: ChannelDef;
  events: (NoteEv | null)[];
}
interface CompiledTrack {
  bpm: number;
  len: number;
  chans: CompiledChan[];
  drums: string[];
  drumVol: number;
}

const NOTE_IDX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteFreq(n: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) return 0;
  let semi = NOTE_IDX[m[1]];
  if (m[2] === '#') semi++;
  if (m[2] === 'b') semi--;
  const midi = (parseInt(m[3]) + 1) * 12 + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function tokens(s: string) {
  return s.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
}

function compileTrack(t: TrackDef): CompiledTrack {
  let len = 0;
  const chans: CompiledChan[] = t.chans.map((def) => {
    const tk = tokens(def.notes);
    len = Math.max(len, tk.length);
    const events: (NoteEv | null)[] = new Array(tk.length).fill(null);
    let last: NoteEv | null = null;
    tk.forEach((tok, i) => {
      if (tok === '-') {
        if (last) last.len++;
      } else if (tok === '.') {
        last = null;
      } else {
        last = { freq: noteFreq(tok), len: 1 };
        events[i] = last;
      }
    });
    return { def, events };
  });
  const drums = t.drums ? tokens(t.drums) : [];
  len = Math.max(len, drums.length);
  return { bpm: t.bpm, len, chans, drums, drumVol: t.drumVol ?? 0.3 };
}

// ======================== 曲目编排 ========================
const TRACKS: Record<string, TrackDef> = {
  // 晨风镇：舒缓温柔的 F 大调
  town: {
    bpm: 92,
    chans: [
      {
        wave: 'triangle', vol: 0.32, release: 0.25,
        notes: `F5 - A5 - C6 - A5 - | G5 - - - E5 - C5 - | D5 - F5 - A5 - G5 F5 | E5 - - - - - . . |
                F5 - A5 - C6 - D6 - | C6 - A5 - F5 - G5 - | A5 - G5 - E5 - D5 E5 | F5 - - - - - . . |
                A5 - - G5 F5 - E5 - | D5 - E5 - F5 - - - | G5 - - F5 E5 - D5 - | C5 - D5 - E5 - - - |
                F5 - A5 - C6 - A5 - | A#5 - A5 - G5 - F5 - | E5 - G5 - C6 - E5 - | F5 - - - - - . . |`,
      },
      {
        wave: 'pulse12', vol: 0.07, release: 0.1,
        notes: `F4 A4 C5 A4 F4 A4 C5 A4 | E4 G4 C5 G4 E4 G4 C5 G4 | D4 F4 A4 F4 D4 F4 A4 F4 | C4 E4 G4 E4 C4 E4 G4 E4 |
                F4 A4 C5 A4 F4 A4 C5 A4 | D4 F4 A#4 F4 D4 F4 A#4 F4 | C4 E4 G4 E4 C4 E4 G4 E4 | F4 A4 C5 F5 C5 A4 F4 . |
                D4 F4 A4 F4 D4 F4 A4 F4 | A#3 D4 F4 D4 A#3 D4 F4 D4 | C4 E4 G4 E4 C4 E4 G4 E4 | A3 C4 E4 C4 G3 C4 E4 C4 |
                F4 A4 C5 A4 F4 A4 C5 A4 | A#3 D4 F4 D4 A#3 D4 F4 D4 | C4 E4 G4 E4 C4 E4 A#4 E4 | F4 A4 C5 F5 C5 A4 F4 . |`,
      },
      {
        wave: 'triangle', vol: 0.3, release: 0.2,
        notes: `F3 . C4 . F3 . C4 . | C3 . G3 . C3 . G3 . | D3 . A3 . D3 . A3 . | C3 . G3 . C3 . E3 . |
                F3 . C4 . F3 . C4 . | A#2 . F3 . A#2 . F3 . | C3 . G3 . C3 . G3 . | F3 . C4 . F3 . . . |
                D3 . A3 . D3 . A3 . | A#2 . F3 . A#2 . F3 . | C3 . G3 . C3 . G3 . | A2 . E3 . C3 . E3 . |
                F3 . C4 . F3 . C4 . | A#2 . F3 . A#2 . F3 . | C3 . G3 . C3 . G3 . | F3 . C4 . F3 . . . |`,
      },
    ],
    drums: `. . h . . . h . `.repeat(16),
    drumVol: 0.12,
  },
  // 翠绿草原：轻快跳跃的 C 大调
  field: {
    bpm: 140,
    chans: [
      {
        wave: 'pulse25', vol: 0.16, release: 0.08,
        notes: `C5 E5 G5 E5 C6 - G5 - | A5 G5 E5 G5 A5 - . . | F5 A5 C6 A5 G5 - E5 - | D5 E5 F5 E5 D5 - . . |
                C5 E5 G5 E5 C6 - D6 - | E6 D6 C6 A5 G5 - E5 - | F5 E5 D5 E5 F5 G5 A5 B5 | C6 - G5 - C6 - . . |
                E5 - E5 F5 G5 - E5 - | F5 - F5 G5 A5 - F5 - | G5 A5 G5 F5 E5 - C5 - | D5 - E5 - D5 - G4 - |
                E5 - E5 F5 G5 - C6 - | A5 - G5 - F5 - E5 - | D5 E5 F5 G5 A5 G5 F5 D5 | C5 - - - C6 - . . |`,
      },
      {
        wave: 'triangle', vol: 0.34, release: 0.08,
        notes: `C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . |
                C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . G2 . D3 . | C3 . G2 . C3 . . . |
                C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | C3 . G3 . A2 . E3 . | G2 . D3 . G2 . B2 . |
                C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | C3 . G2 . C3 . . . |`,
      },
      {
        wave: 'pulse12', vol: 0.05, release: 0.05,
        notes: `E4 G4 E4 G4 E4 G4 E4 G4 | E4 A4 E4 A4 E4 A4 E4 A4 | F4 A4 F4 A4 F4 A4 F4 A4 | D4 G4 D4 G4 D4 G4 D4 G4 |`.repeat(4),
      },
    ],
    drums: `k . h . s . h . | k . h k s . h h |`.repeat(8),
    drumVol: 0.26,
  },
  // 萤火古林：神秘的 A 小调
  forest: {
    bpm: 108,
    chans: [
      {
        wave: 'triangle', vol: 0.3, release: 0.3,
        notes: `A4 - C5 - E5 - D5 C5 | B4 - - - G4 - - - | A4 - C5 - E5 - G5 - | F5 - E5 - D5 - - - |
                E5 - A5 - G5 - E5 - | F5 - E5 - D5 - C5 - | B4 - C5 - D5 - E5 - | A4 - - - - - . . |`,
      },
      {
        wave: 'sine', vol: 0.12, release: 0.4,
        notes: `A5 E5 C6 E5 A5 E5 C6 E5 | G5 D5 B5 D5 G5 D5 B5 D5 | F5 C5 A5 C5 F5 C5 A5 C5 | D5 A4 F5 A4 D5 A4 F5 A4 |
                C6 G5 E6 G5 C6 G5 E6 G5 | F5 C5 A5 C5 F5 C5 A5 C5 | E5 B4 G#5 B4 E5 B4 G#5 B4 | A5 E5 C6 E5 A5 . . . |`,
      },
      {
        wave: 'triangle', vol: 0.32, release: 0.3,
        notes: `A2 - - - E3 - - - | G2 - - - D3 - - - | F2 - - - C3 - - - | D3 - - - A2 - - - |
                C3 - - - G3 - - - | F2 - - - C3 - - - | E2 - - - B2 - - - | A2 - - - E3 - A2 - |`,
      },
    ],
    drums: `k . . h . . h . | k . . h . h h . |`.repeat(4),
    drumVol: 0.14,
  },
  // Boss 战：紧张激烈的 D 小调
  boss: {
    bpm: 168,
    chans: [
      {
        wave: 'sawtooth', vol: 0.09, release: 0.06,
        notes: `D5 . D5 F5 . D5 A5 . | G5 F5 E5 F5 D5 - . . | D5 . D5 F5 . D5 C6 . | A#5 A5 G5 A5 F5 - E5 - |
                F5 - E5 - D5 - C5 - | A#4 - C5 - D5 - E5 - | F5 E5 F5 G5 A5 - A#5 - | A5 - - - C#5 - E5 - |`,
      },
      {
        wave: 'pulse25', vol: 0.06, release: 0.05,
        notes: `A4 . A4 D5 . A4 F5 . | D5 C5 A#4 C5 A4 - . . | A4 . A4 D5 . A4 G5 . | F5 E5 D5 E5 C5 - A4 - |
                D5 - C5 - A#4 - A4 - | G4 - A4 - A#4 - C5 - | D5 C5 D5 E5 F5 - G5 - | E5 - - - A4 - C#5 - |`,
      },
      {
        wave: 'triangle', vol: 0.4, release: 0.05,
        notes: `D2 D3 D2 D3 D2 D3 D2 D3 | A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 | D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 |
                A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 | G1 G2 G1 G2 G1 G2 G1 G2 | A1 A2 A1 A2 A1 A2 A1 A2 | A1 A2 A1 A2 C#2 C#3 E2 E3 |`,
      },
    ],
    drums: `k h s h k k s h | k h s h k k s o |`.repeat(4),
    drumVol: 0.3,
  },
  // 胜利：明亮庄严
  victory: {
    bpm: 100,
    chans: [
      {
        wave: 'pulse25', vol: 0.14, release: 0.3,
        notes: `C5 - E5 - G5 - C6 - | B5 - G5 - E5 - G5 - | A5 - F5 - C6 - A5 - | G5 - - - - - . . |
                F5 - A5 - C6 - F6 - | E6 - C6 - G5 - E6 - | D6 - B5 - G5 - B5 - | C6 - - - - - . . |`,
      },
      {
        wave: 'triangle', vol: 0.32, release: 0.3,
        notes: `C3 - G3 - C4 - G3 - | E3 - B3 - E4 - B3 - | F3 - C4 - F4 - C4 - | G3 - D4 - G4 - D4 - |
                F3 - C4 - F4 - C4 - | C3 - G3 - C4 - G3 - | G2 - D3 - G3 - D3 - | C3 - G3 - C4 - . . |`,
      },
      {
        wave: 'sine', vol: 0.1, release: 0.4,
        notes: `E6 G6 C7 G6 E6 G6 C7 G6 | `.repeat(8),
      },
    ],
    drums: `k . h . s . h . | k . h . s . h h |`.repeat(4),
    drumVol: 0.16,
  },
};

const COMPILED: Record<string, CompiledTrack> = {};
for (const k in TRACKS) COMPILED[k] = compileTrack(TRACKS[k]);

// ======================== 音频引擎 ========================
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private waves: Record<string, PeriodicWave> = {};
  muted = false;
  private current: string | null = null;
  private wanted: string | null = null;
  private nextTime = 0;
  private step = 0;
  private lastPlayed: Record<string, number> = {};

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);
    // 白噪声
    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 脉冲波（8-bit 风味）
    this.waves.pulse25 = this.makePulse(0.25);
    this.waves.pulse12 = this.makePulse(0.125);
    window.setInterval(() => this.schedule(), 25);
    if (this.wanted) {
      const w = this.wanted;
      this.current = null;
      this.playMusic(w);
    }
  }

  private makePulse(duty: number) {
    const ctx = this.ctx!;
    const n = 48;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 1; i < n; i++) real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    return ctx.createPeriodicWave(real, imag);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  playMusic(name: string) {
    this.wanted = name;
    if (!this.ctx || this.current === name) return;
    this.current = name;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.12;
    // 淡入
    const g = this.musicBus.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(0.0, this.ctx.currentTime);
    g.linearRampToValueAtTime(0.55, this.ctx.currentTime + 0.8);
  }

  stopMusic() {
    this.current = null;
    this.wanted = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.current) return;
    const tr = COMPILED[this.current];
    if (!tr) return;
    const stepDur = 60 / tr.bpm / 2;
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const s = this.step % tr.len;
      for (const ch of tr.chans) {
        const ev = ch.events[s % ch.events.length];
        if (ev && ev.freq > 0) this.musicNote(ch.def, ev.freq, this.nextTime, ev.len * stepDur);
      }
      if (tr.drums.length) {
        const d = tr.drums[s % tr.drums.length];
        if (d !== '.') this.drum(d, this.nextTime, tr.drumVol);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private osc(wave: Wave, freq: number, t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    if (wave === 'pulse25' || wave === 'pulse12') o.setPeriodicWave(this.waves[wave]);
    else o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    return o;
  }

  private musicNote(def: ChannelDef, freq: number, t: number, dur: number) {
    const ctx = this.ctx!;
    const o = this.osc(def.wave, freq, t);
    const g = ctx.createGain();
    const rel = def.release ?? 0.1;
    const v = def.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(v * 0.7, t + Math.min(0.12, dur * 0.5));
    g.gain.setValueAtTime(v * 0.7, t + dur * 0.92);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.92 + rel);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + rel + 0.05);
  }

  private drum(kind: string, t: number, vol: number) {
    const ctx = this.ctx!;
    if (kind === 'k') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 2.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.2);
    } else {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      let dur = 0.04;
      if (kind === 's') {
        f.type = 'bandpass';
        f.frequency.value = 1800;
        dur = 0.14;
        g.gain.setValueAtTime(vol * 1.4, t);
      } else if (kind === 'o') {
        f.type = 'highpass';
        f.frequency.value = 6000;
        dur = 0.2;
        g.gain.setValueAtTime(vol * 0.7, t);
      } else {
        f.type = 'highpass';
        f.frequency.value = 7000;
        g.gain.setValueAtTime(vol * 0.6, t);
      }
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      src.start(t, Math.random() * 1);
      src.stop(t + dur + 0.02);
    }
  }

  // ---------- 音效基础合成 ----------
  private tone(freq: number, dur: number, o: { type?: Wave; vol?: number; slide?: number; delay?: number; attack?: number } = {}) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = this.osc(o.type ?? 'square', freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    const g = ctx.createGain();
    const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, o: { vol?: number; freq?: number; slide?: number; type?: BiquadFilterType; q?: number; delay?: number } = {}) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'lowpass';
    f.frequency.setValueAtTime(o.freq ?? 2000, t);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** 播放命名音效（带同名限频防爆音） */
  sfx(name: string) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    const minGap = name === 'coin' ? 0.05 : name === 'hit' || name === 'crit' ? 0.035 : 0.02;
    if (this.lastPlayed[name] && now - this.lastPlayed[name] < minGap) return;
    this.lastPlayed[name] = now;
    switch (name) {
      case 'swing':
        this.noise(0.12, { vol: 0.25, freq: 900, slide: 4000, type: 'bandpass', q: 1.5 });
        break;
      case 'swing3':
        this.noise(0.2, { vol: 0.35, freq: 600, slide: 5000, type: 'bandpass', q: 1.2 });
        this.tone(220, 0.15, { type: 'sawtooth', vol: 0.06, slide: 110 });
        break;
      case 'hit':
        this.tone(320, 0.08, { type: 'square', vol: 0.12, slide: 120 });
        this.noise(0.07, { vol: 0.2, freq: 3000, type: 'lowpass' });
        break;
      case 'crit':
        this.tone(880, 0.1, { type: 'square', vol: 0.12, slide: 220 });
        this.noise(0.12, { vol: 0.3, freq: 5000, slide: 800 });
        this.tone(1320, 0.12, { type: 'triangle', vol: 0.1, delay: 0.02 });
        break;
      case 'magic':
        this.tone(660, 0.18, { type: 'triangle', vol: 0.12, slide: 1320 });
        this.tone(990, 0.12, { type: 'sine', vol: 0.08, delay: 0.04, slide: 1980 });
        break;
      case 'arrow':
        this.noise(0.08, { vol: 0.18, freq: 3000, slide: 7000, type: 'highpass' });
        this.tone(1200, 0.05, { type: 'triangle', vol: 0.05, slide: 600 });
        break;
      case 'explode':
        this.noise(0.6, { vol: 0.55, freq: 1600, slide: 80, type: 'lowpass' });
        this.tone(110, 0.5, { type: 'sine', vol: 0.4, slide: 30 });
        break;
      case 'meteor':
        this.noise(0.5, { vol: 0.2, freq: 400, slide: 3000, type: 'bandpass' });
        break;
      case 'jump':
        this.tone(300, 0.1, { type: 'square', vol: 0.06, slide: 600 });
        break;
      case 'flash':
        this.noise(0.18, { vol: 0.2, freq: 1500, slide: 6000, type: 'bandpass' });
        this.tone(500, 0.12, { type: 'triangle', vol: 0.08, slide: 1200 });
        break;
      case 'coin':
        this.tone(988, 0.06, { type: 'square', vol: 0.07 });
        this.tone(1319, 0.18, { type: 'square', vol: 0.07, delay: 0.055 });
        break;
      case 'pickup':
        this.tone(660, 0.07, { type: 'triangle', vol: 0.15 });
        this.tone(880, 0.07, { type: 'triangle', vol: 0.15, delay: 0.06 });
        this.tone(1320, 0.14, { type: 'triangle', vol: 0.15, delay: 0.12 });
        break;
      case 'rare':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.13, delay: i * 0.06 }));
        break;
      case 'levelup':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.35, { type: 'square', vol: 0.07, delay: i * 0.07 }));
        [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.6, { type: 'triangle', vol: 0.1, delay: 0.45 + i * 0.03 }));
        this.noise(1.2, { vol: 0.12, freq: 4000, slide: 12000, type: 'highpass', delay: 0.4 });
        break;
      case 'potion':
        [400, 600, 500, 800].forEach((f, i) => this.tone(f, 0.08, { type: 'sine', vol: 0.15, delay: i * 0.05, slide: f * 1.5 }));
        break;
      case 'hurt':
        this.tone(220, 0.2, { type: 'sawtooth', vol: 0.15, slide: 80 });
        this.noise(0.1, { vol: 0.2, freq: 1200 });
        break;
      case 'die':
        this.tone(500, 0.18, { type: 'square', vol: 0.08, slide: 1200 });
        this.noise(0.15, { vol: 0.15, freq: 2500, slide: 400 });
        break;
      case 'portal':
        this.tone(300, 0.5, { type: 'sine', vol: 0.15, slide: 1200 });
        this.noise(0.5, { vol: 0.15, freq: 500, slide: 5000, type: 'bandpass' });
        break;
      case 'click':
        this.tone(800, 0.04, { type: 'square', vol: 0.06 });
        break;
      case 'select':
        this.tone(600, 0.05, { type: 'square', vol: 0.05 });
        this.tone(900, 0.07, { type: 'square', vol: 0.05, delay: 0.04 });
        break;
      case 'error':
        this.tone(160, 0.18, { type: 'square', vol: 0.1 });
        break;
      case 'buy':
        this.tone(1047, 0.06, { type: 'square', vol: 0.07 });
        this.tone(1568, 0.16, { type: 'square', vol: 0.07, delay: 0.06 });
        break;
      case 'anvil':
        this.tone(1800, 0.3, { type: 'triangle', vol: 0.15 });
        this.tone(2400, 0.25, { type: 'sine', vol: 0.1 });
        this.noise(0.1, { vol: 0.3, freq: 5000, type: 'highpass' });
        break;
      case 'quest':
        [659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, { type: 'pulse25', vol: 0.1, delay: i * 0.08 }));
        break;
      case 'chest':
        this.noise(0.2, { vol: 0.2, freq: 800 });
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.12, delay: 0.1 + i * 0.07 }));
        break;
      case 'spin':
        this.noise(0.12, { vol: 0.2, freq: 1200, slide: 3000, type: 'bandpass', q: 2 });
        break;
      case 'charge':
        this.tone(200, 0.3, { type: 'sawtooth', vol: 0.1, slide: 900 });
        this.noise(0.3, { vol: 0.25, freq: 800, slide: 6000, type: 'bandpass' });
        break;
      case 'blink':
        this.tone(1500, 0.15, { type: 'sine', vol: 0.1, slide: 300 });
        this.tone(2200, 0.2, { type: 'triangle', vol: 0.06, delay: 0.05, slide: 3000 });
        break;
      case 'job':
        [523, 784, 1047].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.12, delay: i * 0.05 }));
        break;
      case 'thunder':
        this.noise(0.5, { vol: 0.5, freq: 6000, slide: 200 });
        this.tone(80, 0.4, { type: 'sawtooth', vol: 0.2, slide: 30 });
        break;
      case 'warn':
        this.tone(440, 0.12, { type: 'square', vol: 0.06 });
        this.tone(440, 0.12, { type: 'square', vol: 0.06, delay: 0.18 });
        break;
      case 'roar':
        this.tone(90, 0.9, { type: 'sawtooth', vol: 0.25, slide: 45 });
        this.tone(130, 0.9, { type: 'square', vol: 0.12, slide: 60 });
        this.noise(0.9, { vol: 0.3, freq: 600, slide: 150 });
        break;
      case 'summon':
        this.tone(200, 0.5, { type: 'sine', vol: 0.15, slide: 600 });
        this.tone(150, 0.5, { type: 'triangle', vol: 0.1, slide: 75, delay: 0.1 });
        break;
      case 'enemyShot':
        this.tone(500, 0.15, { type: 'sine', vol: 0.08, slide: 200 });
        break;
      case 'dash':
        this.noise(0.3, { vol: 0.35, freq: 400, slide: 3000, type: 'bandpass' });
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.3, { type: 'pulse25', vol: 0.1, delay: i * 0.12 }));
        break;
      case 'break':
        this.noise(0.4, { vol: 0.4, freq: 3000, slide: 300 });
        [1200, 900, 1500].forEach((f, i) => this.tone(f, 0.1, { type: 'square', vol: 0.06, delay: i * 0.05 }));
        break;
    }
  }
}

export const audio = new AudioEngine();
