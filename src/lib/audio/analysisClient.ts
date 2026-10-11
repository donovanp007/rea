"use client";
import { analyzeSamples, type AnalysisResult } from "./analyze.ts";
import { encodeWav, renderDemoSong } from "./demoSong.ts";

let worker: Worker | null | undefined;
let nextId = 1;
const waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
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
async function decodeToMono(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const bytes = await blob.arrayBuffer();
  // An OfflineAudioContext can decode without a user gesture.
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const buf = await ctx.decodeAudioData(bytes);
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
