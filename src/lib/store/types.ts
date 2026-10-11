import type { Analysis } from "../audio/analyze.ts";
import type { Section } from "../music/sections.ts";
import type { Stem } from "../tracks/stems.ts";

export type SectionSource = "auto" | "arrangement" | "edited";
export type BpmSource = "detected" | "tapped" | "manual";

/** A song in the library. Audio bytes are stored separately, keyed by `id`. */
export interface Song {
  id: string;
  name: string;
  artist: string;
  key: string;
  bpm: number | null;
  /** Time of the first downbeat, for drawing bar lines and counting bars. */
  barOffset: number;
  bpmSource: BpmSource;
  duration: number;
  peaks: Float32Array;
  analysis: Analysis;
  sections: Section[];
  source: SectionSource;
  arrangement: string;
  lyrics: string;
  addedAt: number;
  /** Loops the player saved for this song: a fill, a groove, a tricky bar. */
  loops?: SavedLoop[];
  /** Multitrack stems (click, guide, drums…). Audio bytes are stored under `stem:<id>`. */
  stems?: Stem[];
}

export interface SavedLoop {
  id: string;
  name: string;
  start: number;
  end: number;
  speed: number;
}

export interface SetItem {
  songId: string;
  key: string;
  note: string;
  addedAt: number;
  seen: boolean;
}

/** A service or rehearsal set list. */
export interface SetList {
  id: string;
  name: string;
  date: string;
  items: SetItem[];
  createdAt: number;
}

/** One entry in the practice queue: a section (or whole song) with its own speed and repeats. */
export interface QueueItem {
  id: string;
  songId: string;
  label: string;
  start: number;
  end: number;
  speed: number;
  reps: number;
}

export type GapMode = "none" | "p1" | "p2" | "c1" | "c2";
export type LaunchMode = "now" | "end";
export type SnapMode = "bar" | "beat" | "off";

export interface Prefs {
  gap: GapMode;
  launch: LaunchMode;
  trainerStart: number;
  trainerStep: number;
  trainerTarget: number;
  snap: SnapMode;
}

export const DEFAULT_PREFS: Prefs = { gap: "p2", launch: "now", trainerStart: 70, trainerStep: 5, trainerTarget: 100, snap: "beat" };

export type View = "home" | "calendar" | "services" | "live" | "practice" | "songs" | "queue";
