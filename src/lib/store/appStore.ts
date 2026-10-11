"use client";
import { useSyncExternalStore } from "react";
import { DEFAULT_PREFS, type Prefs, type QueueItem, type SetList, type Song, type View } from "./types.ts";
import type { TeamState } from "../team/types.ts";
import type { StemGroup, Strip } from "../tracks/stems.ts";

export interface Loop {
  start: number;
  end: number;
  label: string;
  /** Index of the section being looped, or null for a custom drag-selected stretch. */
  idx: number | null;
}

export interface PlayerState {
  songId: string | null;
  playing: boolean;
  /** Paused between repeats (pause or count-in). */
  waiting: boolean;
  loop: Loop | null;
  reps: number;
  /** Repeats before moving on (queue mode); 0 = loop forever. */
  repTarget: number;
  /** Section queued to start when the current one ends (Ableton-style launch). */
  pending: (Loop & { from: number }) | null;
  speed: number;
  trainer: boolean;
  queueIndex: number | null;
  sectionIdx: number;
  /** Loop start marked with Set A while the song keeps playing; Set B closes the loop. */
  markA: number | null;
}

export type JumpMode = "bar" | "section" | "now";

/** Live mode: the multitrack player for running a set. */
export interface LiveState {
  songId: string | null;
  playing: boolean;
  /** Service whose setlist is playing; null plays the whole library. */
  serviceId: string | null;
  /** Mixer settings per stem group, kept from song to song. */
  mix: Partial<Record<StemGroup, Strip>>;
  /** Click and guide in the left channel, the band in the right (for in-ears + front of house). */
  split: boolean;
  /** Start the next song in the set when one ends. */
  autoNext: boolean;
  jump: JumpMode;
  /** A section jump waiting for the next bar or the end of the current section. */
  pending: { label: string; at: number; to: number } | null;
  loading: boolean;
}

export interface AppState {
  ready: boolean;
  songs: Song[];
  sets: SetList[];
  queue: QueueItem[];
  prefs: Prefs;
  view: View;
  openSetId: string | null;
  status: { text: string; busy: boolean } | null;
  player: PlayerState;
  team: TeamState | null;
  openServiceId: string | null;
  live: LiveState;
}

const initial: AppState = {
  ready: false,
  songs: [],
  sets: [],
  queue: [],
  prefs: DEFAULT_PREFS,
  view: "home",
  openSetId: null,
  openServiceId: null,
  team: null,
  live: { songId: null, playing: false, serviceId: null, mix: {}, split: false, autoNext: true, jump: "bar", pending: null, loading: false },
  status: null,
  player: { songId: null, playing: false, waiting: false, loop: null, reps: 0, repTarget: 0, pending: null, speed: 100, trainer: false, queueIndex: null, sectionIdx: -1, markA: null },
};

/** Minimal observable store; components subscribe to slices with `useApp`. */
export class AppStore {
  state: AppState = initial;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get = () => this.state;

  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
    const p = typeof patch === "function" ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    this.listeners.forEach((fn) => fn());
  }
  setPlayer(patch: Partial<PlayerState>) {
    const cur = this.state.player;
    if (Object.entries(patch).every(([k, v]) => cur[k as keyof PlayerState] === v)) return;
    this.set({ player: { ...cur, ...patch } });
  }
  setLive(patch: Partial<LiveState>) {
    const cur = this.state.live;
    if (Object.entries(patch).every(([k, v]) => cur[k as keyof LiveState] === v)) return;
    this.set({ live: { ...cur, ...patch } });
  }
  song(id: string | null | undefined): Song | undefined {
    return id ? this.state.songs.find((s) => s.id === id) : undefined;
  }
}

export const store = new AppStore();

/** Subscribe to part of the app state. Return primitives or existing objects from `select`. */
export function useApp<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(initial));
}
