import { analyzeSamples } from "./analyze.ts";
import { encodeWav, renderDemoSong } from "./demoSong.ts";

export type WorkerRequest =
  | { id: number; kind: "analyze"; samples: Float32Array; sampleRate: number }
  | { id: number; kind: "demo"; sampleRate: number };

const scope = self as unknown as { onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null; postMessage: (msg: unknown, transfer?: Transferable[]) => void };

scope.onmessage = (e) => {
  const req = e.data;
  try {
    if (req.kind === "demo") {
      const samples = renderDemoSong(req.sampleRate);
      const wav = encodeWav(samples, req.sampleRate);
      scope.postMessage({ id: req.id, ok: true, wav }, [wav]);
      return;
    }
    const r = analyzeSamples(req.samples, req.sampleRate);
    scope.postMessage({ id: req.id, ok: true, result: r });
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
