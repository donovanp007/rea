import type { SnapMode } from "../store/types.ts";

/** The beat grid of a song: tempo and the time of its first downbeat (4/4). */
export interface Grid {
  bpm: number | null;
  barOffset: number;
}

export const beatLength = (g: Grid) => (g.bpm ? 60 / g.bpm : null);

/** Snaps a time to the nearest beat or bar line. Without a tempo, times are left as they are. */
export function snapTime(t: number, g: Grid, mode: SnapMode): number {
  const beat = beatLength(g);
  if (!beat || mode === "off") return t;
  const step = mode === "bar" ? beat * 4 : beat;
  const k = Math.round((t - g.barOffset) / step);
  return Math.max(0, +(g.barOffset + k * step).toFixed(3));
}

/** Musical position as bar and beat, both counted from 1. */
export function barBeatAt(t: number, g: Grid): { bar: number; beat: number } | null {
  const beat = beatLength(g);
  if (!beat) return null;
  const beats = Math.floor((t - g.barOffset) / beat + 1e-6);
  return { bar: Math.floor(beats / 4) + 1, beat: (((beats % 4) + 4) % 4) + 1 };
}

/** Length of a stretch in bars and beats, e.g. "2 bars" or "1 bar 2 beats". */
export function describeLength(seconds: number, g: Grid): string {
  const beat = beatLength(g);
  if (!beat) return `${seconds.toFixed(1)}s`;
  const beats = Math.round(seconds / beat);
  const bars = Math.floor(beats / 4), rest = beats % 4;
  const parts = [bars ? `${bars} ${bars === 1 ? "bar" : "bars"}` : "", rest ? `${rest} ${rest === 1 ? "beat" : "beats"}` : ""].filter(Boolean);
  return parts.join(" ") || "under a beat";
}
