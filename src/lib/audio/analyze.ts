/**
 * Song-structure analysis that runs in the browser (in a Web Worker), with no server or GPU.
 *
 * 1. Short-time spectra → per-frame chroma (harmony), band energies (timbre), loudness and
 *    spectral flux (note onsets).
 * 2. Frames are pooled into ~0.5 s blocks and compared with each other (self-similarity).
 *    A checkerboard kernel slid along the diagonal scores how much the music changes at
 *    each moment ("novelty"); peaks are section boundaries.
 * 3. Segments are grouped by similarity; the group that repeats most is the chorus, the
 *    other repeated group the verse, a one-off late section the bridge.
 * 4. Tempo comes from autocorrelating the onset envelope.
 */
import { numberRepeats, type Section } from "../music/sections.ts";

/** Everything kept from analysis so sections can be recomputed later without the audio. */
export interface Analysis {
  blockDur: number;
  frameDur: number;
  dims: number;
  novelty: Float32Array;
  feat: Float32Array;
  blockRms: Float32Array;
  onset: Float32Array;
  frameRms: Float32Array;
}

export interface Tempo {
  bpm: number;
  offset: number;
}

export interface AnalysisResult {
  duration: number;
  peaks: Float32Array;
  tempo: Tempo | null;
  analysis: Analysis;
  sections: Section[];
}

const PEAK_COUNT = 1800;
const FFT_SIZE = 2048;
const HOP = 512;
const TARGET_RATE = 22050;
const DIMS = 19; // 12 chroma + 6 bands + loudness

export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]!; re[i] = re[j]!; re[j] = t;
      t = im[i]!; im[i] = im[j]!; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b]! * cr - im[b]! * ci, xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr; im[b] = im[a]! - xi; re[a] = re[a]! + xr; im[a] = im[a]! + xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Downsamples a mono signal to about 22 kHz by averaging. */
function downsample(mono: Float32Array, sampleRate: number): { x: Float32Array; fs: number } {
  const dec = Math.max(1, Math.round(sampleRate / TARGET_RATE));
  const n = Math.floor(mono.length / dec);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < dec; k++) s += mono[i * dec + k]!;
    x[i] = s / dec;
  }
  return { x, fs: sampleRate / dec };
}

/** Full analysis of a mono signal. */
export function analyzeSamples(mono: Float32Array, sampleRate: number): AnalysisResult {
  const duration = mono.length / sampleRate;
  const { x, fs } = downsample(mono, sampleRate);
  const n = x.length;

  const peaks = new Float32Array(PEAK_COUNT);
  const per = Math.max(1, Math.floor(n / PEAK_COUNT));
  for (let p = 0; p < PEAK_COUNT; p++) {
    let m = 0;
    for (let i = 0, o = p * per; i < per && o + i < n; i++) m = Math.max(m, Math.abs(x[o + i]!));
    peaks[p] = m;
  }

  const N = FFT_SIZE;
  const F = Math.max(1, Math.floor((n - N) / HOP) + 1);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const pc = new Int8Array(N / 2).fill(-1);
  const band = new Int8Array(N / 2).fill(-1);
  const edges = [60, 150, 400, 1000, 2500, 6000, fs / 2];
  for (let k = 1; k < N / 2; k++) {
    const f = (k * fs) / N;
    if (f >= 60 && f <= 4200) pc[k] = (((Math.round(12 * Math.log2(f / 440)) + 69) % 12) + 12) % 12;
    for (let b = 0; b < 6; b++) if (f >= edges[b]! && f < edges[b + 1]!) band[k] = b;
  }

  const ff = new Float32Array(F * DIMS), rms = new Float32Array(F), onset = new Float32Array(F), flux = new Float32Array(F);
  const re = new Float64Array(N), im = new Float64Array(N), prev = new Float32Array(N / 2);
  for (let f = 0; f < F; f++) {
    const o = f * HOP;
    let e = 0;
    for (let i = 0; i < N; i++) {
      const v = o + i < n ? x[o + i]! : 0;
      e += v * v;
      re[i] = v * win[i]!;
      im[i] = 0;
    }
    rms[f] = Math.sqrt(e / N);
    fft(re, im);
    const base = f * DIMS;
    let fl = 0;
    for (let k = 1; k < N / 2; k++) {
      const mag = Math.hypot(re[k]!, im[k]!);
      const p = pc[k]!, b = band[k]!;
      if (p >= 0) ff[base + p]! += mag;
      if (b >= 0) ff[base + 12 + b]! += mag * mag;
      const lm = Math.log1p(10 * mag), d = lm - prev[k]!;
      if (d > 0) fl += d;
      prev[k] = lm;
    }
    flux[f] = f ? fl : 0;
  }
  const frameDur = HOP / fs;
  for (let f = 1; f < F; f++) onset[f] = Math.max(0, Math.log(1e-4 + rms[f]!) - Math.log(1e-4 + rms[f - 1]!));

  // pool frames into ~0.5 s blocks
  const bf = Math.max(1, Math.round(0.5 / frameDur));
  const B = Math.max(1, Math.floor(F / bf));
  const blockDur = bf * frameDur;
  const feat = new Float32Array(B * DIMS), blockRms = new Float32Array(B);
  for (let b = 0; b < B; b++) {
    for (let j = 0; j < bf; j++) {
      const f = b * bf + j;
      for (let d = 0; d < DIMS; d++) feat[b * DIMS + d]! += ff[f * DIMS + d]!;
      blockRms[b]! += rms[f]!;
    }
    blockRms[b] = blockRms[b]! / bf;
    let s = 0;
    for (let d = 0; d < 12; d++) s += feat[b * DIMS + d]! ** 2;
    s = Math.sqrt(s) || 1;
    for (let d = 0; d < 12; d++) feat[b * DIMS + d] = feat[b * DIMS + d]! / s;
    for (let d = 12; d < 18; d++) feat[b * DIMS + d] = Math.log(1e-6 + feat[b * DIMS + d]! / bf);
    feat[b * DIMS + 18] = Math.log(1e-4 + blockRms[b]!);
  }
  // standardise timbre/loudness dims, smooth, centre, weight, unit-normalise
  for (let d = 12; d < DIMS; d++) {
    let m = 0;
    for (let b = 0; b < B; b++) m += feat[b * DIMS + d]!;
    m /= B;
    let v = 0;
    for (let b = 0; b < B; b++) v += (feat[b * DIMS + d]! - m) ** 2;
    v = Math.sqrt(v / B) || 1;
    for (let b = 0; b < B; b++) feat[b * DIMS + d] = (feat[b * DIMS + d]! - m) / v;
  }
  const weight = (d: number) => (d < 12 ? 1 : d < 18 ? 0.45 : 0.7);
  const sm = new Float32Array(B * DIMS), mean = new Float32Array(DIMS);
  for (let b = 0; b < B; b++)
    for (let d = 0; d < DIMS; d++) {
      let s = 0, c = 0;
      for (let k = -1; k <= 1; k++) {
        const q = b + k;
        if (q >= 0 && q < B) { s += feat[q * DIMS + d]!; c++; }
      }
      sm[b * DIMS + d] = s / c;
      mean[d]! += s / c / B;
    }
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let d = 0; d < DIMS; d++) {
      const v = (sm[b * DIMS + d]! - mean[d]!) * weight(d);
      sm[b * DIMS + d] = v;
      s += v * v;
    }
    s = Math.sqrt(s) || 1;
    for (let d = 0; d < DIMS; d++) sm[b * DIMS + d] = sm[b * DIMS + d]! / s;
  }

  // self-similarity + checkerboard novelty
  const S = new Float32Array(B * B);
  for (let i = 0; i < B; i++)
    for (let j = i; j < B; j++) {
      let s = 0;
      for (let d = 0; d < DIMS; d++) s += sm[i * DIMS + d]! * sm[j * DIMS + d]!;
      S[i * B + j] = s;
      S[j * B + i] = s;
    }
  const L = Math.max(2, Math.min(12, Math.floor(B / 4)));
  const nov = new Float32Array(B);
  for (let i = 0; i < B; i++) {
    let s = 0;
    for (let a = -L; a < L; a++)
      for (let c = -L; c < L; c++) {
        const p = i + a, q = i + c;
        if (p < 0 || q < 0 || p >= B || q >= B) continue;
        const g = Math.exp(-(((a + 0.5) / L) ** 2 + ((c + 0.5) / L) ** 2) * 2);
        s += ((a < 0) === (c < 0) ? 1 : -1) * g * S[p * B + q]!;
      }
    nov[i] = Math.max(0, s);
  }
  const en = new Float32Array(B);
  const lr = Array.from(blockRms, (v) => Math.log(1e-4 + v));
  for (let i = 4; i < B - 4; i++) {
    let a = 0, c = 0;
    for (let k = 1; k <= 4; k++) { a += lr[i - k]!; c += lr[i + k - 1]!; }
    en[i] = Math.abs(c - a) / 4;
  }
  const n1 = normalise(nov), n2 = normalise(en);
  const novelty = new Float32Array(B);
  for (let i = 0; i < B; i++) novelty[i] = n1[i]! + 0.4 * n2[i]!;

  const analysis: Analysis = { blockDur, frameDur, dims: DIMS, novelty, feat: sm, blockRms, onset, frameRms: rms };
  const beat = estimateTempo(flux, frameDur);
  const raw = pickBoundaries(analysis, duration, null);
  // sections start on bar lines: find where the bars fall, then move each edge onto one
  const tempo = beat ? { bpm: beat.bpm, offset: snapToBars(raw, beat).barOffset } : null;
  const times = tempo ? snapToBars(raw, tempo).times : raw;
  const sections = autoLabel(analysis, duration, times);
  return { duration, peaks, tempo, analysis, sections };
}

function normalise(arr: Float32Array): Float32Array {
  let m = 0;
  for (const v of arr) m = Math.max(m, v);
  return m ? arr.map((v) => v / m) : arr;
}

/** Tempo from the autocorrelation of the spectral-flux onset envelope, plus the beat phase. */
export function estimateTempo(flux: Float32Array, frameDur: number): Tempo | null {
  const n = flux.length;
  if (n < 200) return null;
  const w = Math.round(0.4 / frameDur);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i]! + flux[i]!;
  const env = new Float32Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - w), b = Math.min(n, i + w + 1);
    env[i] = Math.max(0, flux[i]! - (pre[b]! - pre[a]!) / (b - a));
    total += env[i]!;
  }
  if (!total) return null;
  const lo = Math.floor(60 / 200 / frameDur), hi = Math.ceil(60 / 50 / frameDur);
  const ac = new Float64Array(hi + 2);
  for (let lag = lo; lag <= hi + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += env[i]! * env[i + lag]!;
    ac[lag] = s / (n - lag);
  }
  let best = -1, bl = lo + 1;
  for (let lag = lo + 1; lag <= hi; lag++) {
    const bpm = 60 / (lag * frameDur);
    // prefer the tempo range most songs sit in, so we don't report half- or double-time
    const v = ac[lag]! * Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.75) ** 2);
    if (ac[lag]! >= ac[lag - 1]! && ac[lag]! >= ac[lag + 1]! && v > best) { best = v; bl = lag; }
  }
  const y0 = ac[bl - 1]!, y1 = ac[bl]!, y2 = ac[bl + 1]!, den = y0 - 2 * y1 + y2;
  let bpm = 60 / ((bl + (den ? (0.5 * (y0 - y2)) / den : 0)) * frameDur);
  if (Math.abs(bpm - Math.round(bpm)) < 0.6) bpm = Math.round(bpm);
  const period = 60 / bpm / frameDur;
  let bestPhase = 0, bestScore = -1;
  for (let ph = 0; ph < period; ph += 0.5) {
    let s = 0;
    for (let t = ph; t < n; t += period) s += env[Math.round(t)] ?? 0;
    if (s > bestScore) { bestScore = s; bestPhase = ph; }
  }
  return { bpm: +bpm.toFixed(1), offset: +(bestPhase * frameDur).toFixed(3) };
}

/**
 * Moves a boundary to where the music actually changes: the frame within ±0.75 s with the
 * biggest jump in loudness level between the half-second before and after, nudged towards
 * strong onsets (downbeats). Harmony-only changes with no level change fall back to onsets.
 */
function snap(an: Analysis, t: number): number {
  const fd = an.frameDur, f0 = Math.round(t / fd), r = Math.round(0.75 / fd), w = Math.max(2, Math.round(0.5 / fd));
  const rms = an.frameRms, F = rms.length;
  const pre = new Float64Array(F + 1);
  for (let i = 0; i < F; i++) pre[i + 1] = pre[i]! + rms[i]!;
  const mean = (a: number, b: number) => (pre[Math.min(F, b)]! - pre[Math.max(0, a)]!) / Math.max(1, Math.min(F, b) - Math.max(0, a));
  let best = f0, bv = 0;
  for (let f = Math.max(w, f0 - r); f <= Math.min(F - w, f0 + r); f++) {
    const contrast = Math.abs(Math.log(1e-4 + mean(f, f + w)) - Math.log(1e-4 + mean(f - w, f)));
    const v = contrast + 0.5 * (an.onset[f] ?? 0) - (0.15 * Math.abs(f - f0)) / r;
    if (v > bv) { bv = v; best = f; }
  }
  return bv > 0.08 ? best * fd : t;
}

/**
 * Assumes 4/4. Picks which beat is the downbeat (the bar phase that the detected edges sit
 * closest to), then moves each edge onto its nearest bar line when it is within a third of a
 * bar. Edges further off are left alone (pickups, tempo changes, rubato).
 * `tempo.offset` is any beat; the returned `barOffset` is the first downbeat.
 */
export function snapToBars(times: number[], tempo: Tempo): { times: number[]; barOffset: number } {
  const beat = 60 / tempo.bpm, bar = 4 * beat;
  const first = ((tempo.offset % beat) + beat) % beat;
  const dist = (t: number, origin: number) => { const d = (((t - origin) % bar) + bar) % bar; return Math.min(d, bar - d); };
  let barOffset = first, bestCost = Infinity;
  for (let p = 0; p < 4; p++) {
    const origin = first + p * beat;
    const cost = times.reduce((a, t) => a + Math.min(dist(t, origin), bar / 2), 0);
    if (cost < bestCost - 1e-9) { bestCost = cost; barOffset = origin; }
  }
  const snapped = times.map((t) => {
    const k = Math.round((t - barOffset) / bar), line = barOffset + k * bar;
    return Math.abs(t - line) < bar / 3 && line > 0 ? +line.toFixed(3) : t;
  });
  const unique = [...new Set(snapped)].sort((a, b) => a - b);
  return { times: unique, barOffset: +(barOffset % bar).toFixed(3) };
}

function localMaxima(an: Analysis, radius: number): { i: number; v: number }[] {
  const nv = an.novelty, out: { i: number; v: number }[] = [];
  for (let i = 2; i < nv.length - 2; i++) {
    let ok = nv[i]! > 0;
    for (let k = -radius; k <= radius && ok; k++) if (k && (nv[i + k] ?? -1) > nv[i]!) ok = false;
    if (ok) out.push({ i, v: nv[i]! });
  }
  return out;
}

/**
 * Boundary times in seconds. With `count` it returns exactly that many (used when the
 * arrangement order is known); without, it keeps every clearly strong change.
 */
export function pickBoundaries(an: Analysis, duration: number, count: number | null, tempo: Tempo | null = null): number[] {
  const minGap = count ? Math.max(3, Math.min(6, duration / (count + 1) / 2)) : 6;
  const gapBlocks = Math.round(minGap / an.blockDur);
  const candidates = localMaxima(an, count ? 2 : 6).sort((a, b) => b.v - a.v);
  let threshold = 0;
  if (!count) {
    const v = Array.from(an.novelty);
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
    threshold = m + 0.35 * sd;
  }
  const chosen: number[] = [];
  for (const c of candidates) {
    if (count && chosen.length >= count) break;
    if (!count && c.v < threshold) break;
    const t = c.i * an.blockDur;
    if (t < minGap * 0.6 || duration - t < minGap * 0.6) continue;
    if (chosen.some((x) => Math.abs(x - c.i) < gapBlocks)) continue;
    chosen.push(c.i);
  }
  let times = chosen.map((i) => snap(an, i * an.blockDur)).sort((a, b) => a - b);
  if (tempo) times = snapToBars(times, tempo).times;
  // not enough clear changes: split the longest stretches evenly
  while (count && times.length < count) {
    const pts = [0, ...times, duration];
    let bi = 0, bl = 0;
    for (let k = 0; k < pts.length - 1; k++) if (pts[k + 1]! - pts[k]! > bl) { bl = pts[k + 1]! - pts[k]!; bi = k; }
    times.push(pts[bi]! + bl / 2);
    times.sort((a, b) => a - b);
  }
  return times;
}

interface Seg { start: number; end: number; v: Float32Array; energy: number; g: number }

function segmentVector(an: Analysis, a: number, b: number): { v: Float32Array; energy: number } {
  const D = an.dims, v = new Float32Array(D);
  let i0 = Math.floor(a / an.blockDur), i1 = Math.floor(b / an.blockDur);
  if (i1 - i0 > 3) { i0++; i1--; }
  i1 = Math.min(i1, an.novelty.length);
  let e = 0, ec = 0;
  for (let i = i0; i < i1; i++) {
    for (let d = 0; d < D; d++) v[d]! += an.feat[i * D + d]!;
    e += an.blockRms[i]!;
    ec++;
  }
  let s = 0;
  for (let d = 0; d < D; d++) s += v[d]! * v[d]!;
  s = Math.sqrt(s) || 1;
  for (let d = 0; d < D; d++) v[d] = v[d]! / s;
  return { v, energy: ec ? e / ec : 0 };
}

/** Names segments Intro / Verse / Pre-Chorus / Chorus / Bridge / Outro from how they repeat. */
export function autoLabel(an: Analysis, duration: number, times: number[]): Section[] {
  const starts = [0, ...times];
  const segs: Seg[] = starts.map((s, k) => ({ start: s, end: starts[k + 1] ?? duration, ...segmentVector(an, s, starts[k + 1] ?? duration), g: -1 }));
  const groups: { v: Float32Array; members: Seg[] }[] = [];
  for (const s of segs) {
    let best = -1, bs = 0.55;
    groups.forEach((g, gi) => {
      let d = 0;
      for (let k = 0; k < an.dims; k++) d += g.v[k]! * s.v[k]!;
      if (d > bs) { bs = d; best = gi; }
    });
    if (best < 0) { groups.push({ v: s.v, members: [s] }); s.g = groups.length - 1; }
    else { groups[best]!.members.push(s); s.g = best; }
  }
  const energies = segs.map((s) => s.energy).sort((a, b) => a - b);
  const med = energies[Math.floor(energies.length / 2)] ?? 0;
  const name: (string | null)[] = new Array(segs.length).fill(null);
  const first = segs[0]!, last = segs[segs.length - 1]!;
  if (segs.length > 2 && first.end - first.start < 24 && first.energy < med * 0.9) name[0] = "Intro";
  if (segs.length > 3 && last.end - last.start < 30 && last.energy < med * 0.95) name[segs.length - 1] = "Outro";
  const gEnergy = (g: { members: Seg[] }) => g.members.reduce((a, m) => a + m.energy, 0) / g.members.length;
  const live = (g: { members: Seg[] }) => g.members.filter((m) => name[segs.indexOf(m)] === null);
  const repeated = groups.map((g, gi) => ({ g, gi, n: live(g).length })).filter((x) => x.n >= 2);
  let chorusG = -1, verseG = -1;
  if (repeated.length) {
    const maxE = Math.max(...repeated.map((x) => gEnergy(x.g))) || 1;
    // the chorus repeats most; on a tie it usually comes after the verse and is louder
    const score = (x: (typeof repeated)[number]) => x.n * 10 + segs.indexOf(live(x.g)[0]!) * 0.1 + (gEnergy(x.g) / maxE) * 0.5;
    chorusG = repeated.slice().sort((a, b) => score(b) - score(a))[0]!.gi;
    const others = repeated.filter((x) => x.gi !== chorusG).sort((a, b) => segs.indexOf(a.g.members[0]!) - segs.indexOf(b.g.members[0]!));
    if (others[0]) verseG = others[0].gi;
  }
  const firstChorus = segs.findIndex((s) => s.g === chorusG);
  let verseN = 0, letter = 0;
  const letters: Record<number, string> = {};
  segs.forEach((s, k) => {
    if (name[k]) return;
    const next = segs[k + 1];
    if (s.g === chorusG) name[k] = "Chorus";
    else if (s.g === verseG) name[k] = `Verse ${++verseN}`;
    else if (firstChorus >= 0 && k > firstChorus && s.start > duration * 0.45 && groups[s.g]!.members.length === 1) name[k] = "Bridge";
    else if (chorusG >= 0 && next && next.g === chorusG && s.end - s.start < 20 && k > 0 && groups[s.g]!.members.length >= 2) name[k] = "Pre-Chorus";
    else {
      letters[s.g] ??= String.fromCharCode(65 + letter++);
      name[k] = `Part ${letters[s.g]}`;
    }
  });
  return numberRepeats(segs.map((s, k) => ({ start: +s.start.toFixed(3), label: name[k]! })));
}

/** Cuts the song into exactly the sections of a known arrangement order. */
export function sectionsFromOrder(an: Analysis, duration: number, labels: string[], tempo: Tempo | null = null): Section[] {
  const times = pickBoundaries(an, duration, labels.length - 1, tempo);
  return numberRepeats(labels.map((label, i) => ({ start: i === 0 ? 0 : +times[i - 1]!.toFixed(3), label })));
}
