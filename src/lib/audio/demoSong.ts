/**
 * A short generated worship-style song with a known structure, so the app opens in a working
 * state and the analysis can be tested against ground truth. Pure math: runs in Node or a browser.
 */

export const DEMO_BPM = 120;

/** Ground truth for the demo: section label and start in seconds. */
export const DEMO_STRUCTURE = [
  { label: "Intro", start: 0 },
  { label: "Verse 1", start: 8 },
  { label: "Chorus", start: 24 },
  { label: "Verse 2", start: 40 },
  { label: "Chorus 2", start: 56 },
  { label: "Bridge", start: 72 },
  { label: "Chorus 3", start: 84 },
  { label: "Outro", start: 100 },
] as const;

export const DEMO_ARRANGEMENT = "I, V1, C, V2, C, B, C, O";

export const DEMO_LYRICS = `Intro

Verse 1
Morning light breaks over the hills
Every shadow running from Your face

Chorus
You are faithful, You are near
Singing over every fear

Verse 2
When the night was long You stayed
Holding on, You made a way

Bridge
I will lift my eyes, I will lift my eyes
To the One who never fails

Outro
(Repeat chorus softly)`;

type Kind = "pad" | "verse" | "chorus" | "bridge";
const PLAN: [Kind, number, string[]][] = [
  ["pad", 4, ["G"]],
  ["verse", 8, ["G", "D", "Em", "C"]],
  ["chorus", 8, ["C", "G", "D", "Em"]],
  ["verse", 8, ["G", "D", "Em", "C"]],
  ["chorus", 8, ["C", "G", "D", "Em"]],
  ["bridge", 6, ["Am", "F", "C", "G"]],
  ["chorus", 8, ["C", "G", "D", "Em"]],
  ["pad", 4, ["G"]],
];
const CHORDS: Record<string, number[]> = { G: [55, 59, 62], D: [50, 54, 57], Em: [52, 55, 59], C: [48, 52, 55], Am: [57, 60, 64], F: [53, 57, 60] };
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Small deterministic PRNG so the noise (and tests) are repeatable. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

/** Renders the demo song as mono samples. */
export function renderDemoSong(sampleRate = 22050): Float32Array {
  const bar = 240 / DEMO_BPM, beat = bar / 4;
  const bars = PLAN.reduce((a, p) => a + p[1], 0);
  const out = new Float32Array(Math.ceil((bars * bar + 1) * sampleRate));
  const noise = rng(7);
  const sr = sampleRate;

  const tone = (wave: "sine" | "tri" | "saw" | "square", f: number, t0: number, len: number, vol: number, bright = 1) => {
    const a = Math.floor(t0 * sr), n = Math.floor(len * sr);
    let lp = 0;
    const k = Math.min(1, bright); // one-pole low-pass amount for harsh waves
    for (let i = 0; i < n && a + i < out.length; i++) {
      const t = i / sr, ph = (f * t) % 1;
      let v = wave === "sine" ? Math.sin(2 * Math.PI * ph) : wave === "tri" ? 1 - 4 * Math.abs(ph - 0.5) : wave === "saw" ? 2 * ph - 1 : ph < 0.5 ? 1 : -1;
      lp += k * (v - lp);
      v = lp;
      const env = Math.min(1, t / 0.04, (len - t) / 0.15);
      out[a + i]! += v * vol * Math.max(0, env);
    }
  };
  const kick = (t0: number, vol: number) => {
    const a = Math.floor(t0 * sr), n = Math.floor(0.3 * sr);
    let ph = 0;
    for (let i = 0; i < n && a + i < out.length; i++) {
      const t = i / sr, f = 45 + 75 * Math.exp(-t / 0.05);
      ph += f / sr;
      out[a + i]! += Math.sin(2 * Math.PI * ph) * vol * Math.exp(-t / 0.08);
    }
  };
  const hiss = (t0: number, len: number, vol: number, bright: number) => {
    const a = Math.floor(t0 * sr), n = Math.floor(len * sr);
    let prev = 0;
    for (let i = 0; i < n && a + i < out.length; i++) {
      const w = noise(), hp = w - prev * (1 - bright);
      prev = w;
      out[a + i]! += hp * vol * Math.exp((-i / sr / len) * 5);
    }
  };

  let t = 0;
  for (const [kind, count, prog] of PLAN) {
    for (let b = 0; b < count; b++, t += bar) {
      const ch = CHORDS[prog[b % prog.length]!]!;
      if (kind === "pad") {
        ch.forEach((m) => tone("sine", hz(m), t, bar, 0.07));
        for (let k = 0; k < 4; k++) hiss(t + k * beat, 0.04, 0.04, 0.9);
      } else if (kind === "verse") {
        ch.forEach((m) => tone("tri", hz(m), t, bar, 0.06));
        tone("sine", hz(ch[0]! - 12), t, bar, 0.16);
        kick(t, 0.5); kick(t + 2 * beat, 0.5);
        for (let k = 0; k < 4; k++) hiss(t + k * beat, 0.04, 0.07, 0.9);
      } else if (kind === "chorus") {
        ch.forEach((m) => tone("saw", hz(m + 12), t, bar, 0.045, 0.5));
        tone("saw", hz(ch[0]! - 12), t, bar, 0.12, 0.1);
        for (let k = 0; k < 4; k++) kick(t + k * beat, 0.8);
        hiss(t + beat, 0.18, 0.3, 0.5); hiss(t + 3 * beat, 0.18, 0.3, 0.5);
        for (let k = 0; k < 8; k++) hiss(t + (k * beat) / 2, 0.05, 0.1, 0.95);
      } else {
        ch.forEach((m) => tone("square", hz(m), t, bar, 0.04, 0.25));
        tone("sine", hz(ch[0]! - 24), t, bar, 0.14);
        kick(t, 0.4);
        for (let k = 0; k < 4; k++) hiss(t + k * beat, 0.04, 0.06, 0.9);
      }
    }
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.95) for (let i = 0; i < out.length; i++) out[i] = (out[i]! / peak) * 0.95;
  return out;
}

/** 16-bit PCM WAV bytes for mono samples. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const n = samples.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i]!)) * 0x7fff, true);
  return ab;
}
