"use client";
import { analyzeSamples, type AnalysisResult } from "./analyze.ts";
import { DEMO_PARTS, encodeWav, renderDemoParts, renderDemoSong } from "./demoSong.ts";

let worker: Worker | null | undefined;
let nextId = 1;
const waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    // the single-file build inlines the worker's code; the Next.js app loads it as a module
    const inline = (globalThis as { __PL_WORKER_SRC__?: string }).__PL_WORKER_SRC__;
    worker = inline
      ? new Worker(URL.createObjectURL(new Blob([inline], { type: "text/javascript" })))
      : new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; error?: string }>) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.ok) w.resolve(e.data);
      else w.reject(new Error(e.data.error ?? "Analysis failed"));
    };
    worker.onerror = () => {
      waiting.forEach((w) => w.reject(new Error("Analysis worker stopped")));
      waiting.clear();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

function call<T>(msg: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> | null {
  const w = getWorker();
  if (!w) return null;
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    waiting.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ id, ...msg }, transfer);
  });
}

/** Decodes any browser-playable audio file to mono samples. */
async function decodeToMono(blob: Blob, rate = 44100): Promise<{ samples: Float32Array; sampleRate: number }> {
  const bytes = await blob.arrayBuffer();
  // An OfflineAudioContext can decode without a user gesture.
  const ctx = new OfflineAudioContext(1, 1, rate);
  // callback form as well: older iPhone Safari never resolves the promise form
  const buf = await new Promise<AudioBuffer>((resolve, reject) => {
    const p = ctx.decodeAudioData(bytes, resolve, reject);
    if (p && typeof p.then === "function") p.then(resolve, reject);
  });
  const n = buf.length, chs = buf.numberOfChannels, samples = new Float32Array(n);
  for (let c = 0; c < chs; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) samples[i]! += d[i]! / chs;
  }
  return { samples, sampleRate: buf.sampleRate };
}

/** Splits a song into sections and finds its tempo, off the main thread when possible. */
export async function analyzeAudio(blob: Blob): Promise<AnalysisResult> {
  const { samples, sampleRate } = await decodeToMono(blob);
  const viaWorker = call<{ result: AnalysisResult }>({ kind: "analyze", samples, sampleRate }, [samples.buffer]);
  if (viaWorker) return (await viaWorker).result;
  return analyzeSamples(samples, sampleRate);
}

/** Renders the generated demo song as a WAV file. */
export async function renderDemoWav(): Promise<Blob> {
  const sampleRate = 22050;
  const viaWorker = call<{ wav: ArrayBuffer }>({ kind: "demo", sampleRate });
  const wav = viaWorker ? (await viaWorker).wav : encodeWav(renderDemoSong(sampleRate), sampleRate);
  return new Blob([wav], { type: "audio/wav" });
}

/** Renders the demo as a mix plus one WAV per part (click, drums, bass, keys, pad). */
export async function renderDemoStems(): Promise<{ mix: Blob; stems: { name: string; blob: Blob }[] }> {
  const sampleRate = 22050;
  const viaWorker = call<{ wavs: ArrayBuffer[] }>({ kind: "demoStems", sampleRate });
  let wavs: ArrayBuffer[];
  if (viaWorker) wavs = (await viaWorker).wavs;
  else {
    const parts = renderDemoParts(sampleRate);
    wavs = [parts.mix, ...DEMO_PARTS.map((p) => parts[p.part])].map((d) => encodeWav(d, sampleRate));
  }
  const wav = (b: ArrayBuffer) => new Blob([b], { type: "audio/wav" });
  return { mix: wav(wavs[0]!), stems: DEMO_PARTS.map((p, i) => ({ name: p.name, blob: wav(wavs[i + 1]!) })) };
}

/**
 * Sums stems into one mono reference mix for finding sections and tempo, and for Practice.
 * Decodes one file at a time at a low rate so a dozen stems fit in a phone's memory.
 */
export async function mixdownStems(files: { blob: Blob; cue: boolean }[]): Promise<Blob> {
  const rate = 22050;
  let mix = new Float32Array(0);
  for (const f of files) {
    if (f.cue) continue;
    const { samples } = await decodeToMono(f.blob, rate);
    if (samples.length > mix.length) { const grown = new Float32Array(samples.length); grown.set(mix); mix = grown; }
    for (let i = 0; i < samples.length; i++) mix[i]! += samples[i]!;
  }
  let peak = 0;
  for (const v of mix) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.98) for (let i = 0; i < mix.length; i++) mix[i] = (mix[i]! / peak) * 0.95;
  return new Blob([encodeWav(mix, rate)], { type: "audio/wav" });
}
