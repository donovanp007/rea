"use client";
import { resolveSections, sectionAt } from "../music/sections.ts";
import type { PlayerEngine } from "../player/engine.ts";
import type { AppStore } from "../store/appStore.ts";
import type { Repository } from "../store/repository.ts";
import type { Song } from "../store/types.ts";
import { isCue, jumpTime, sortStems, stemGain, type Stem } from "../tracks/stems.ts";

interface Track {
  stem: Stem;
  el: HTMLAudioElement;
  url: string;
  gain: GainNode | null;
  pan: StereoPannerNode | null;
  src: MediaElementAudioSourceNode | null;
}

/** How far a stem may drift from the first track before it is pulled back, in seconds. */
const DRIFT = 0.035;

/** The tracks a song plays in Live mode: its stems, or the full mix when it has none. */
export const liveStems = (song: Song): Stem[] => (song.stems?.length ? sortStems(song.stems) : [{ id: song.id, name: "Full mix", group: "mix" }]);
export const stemKey = (song: Song, stem: Stem) => (stem.id === song.id ? song.id : `stem:${stem.id}`);

/**
 * Plays a song's stems together for running a set: one <audio> element per stem routed through
 * Web Audio for volume and panning, kept in sync with the first track. Section jumps wait for
 * the next bar (or the end of the section) so the band never loses the beat.
 */
export class LiveEngine {
  private ctx: AudioContext | null = null;
  private tracks: Track[] = [];
  private token = 0;
  private lastSync = 0;
  /** Songs to play, in order. */
  setlist: () => string[] = () => [];

  constructor(private store: AppStore, private repo: Repository, private practice: PlayerEngine) {
    practice.beforePlay = () => { if (this.l.playing) this.pause(); };
    requestAnimationFrame(this.tick);
  }

  private get l() { return this.store.state.live; }
  get song() { return this.store.song(this.l.songId); }
  get time() { return this.tracks[0]?.el.currentTime ?? 0; }
  get stems(): Stem[] { return this.tracks.map((t) => t.stem); }

  async load(songId: string): Promise<boolean> {
    const song = this.store.song(songId);
    if (!song) return false;
    if (this.l.songId === songId && this.tracks.length) return true;
    const token = ++this.token;
    const wasPlaying = this.l.playing;
    this.unloadTracks();
    this.store.setLive({ songId, loading: true, pending: null, playing: false });
    const stems = liveStems(song);
    const blobs = await Promise.all(stems.map((s) => this.repo.loadAudio(stemKey(song, s))));
    if (token !== this.token) return false;
    const tracks: Track[] = [];
    stems.forEach((stem, i) => {
      const blob = blobs[i];
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const el = new Audio();
      el.preload = "auto";
      el.src = url;
      tracks.push({ stem, el, url, gain: null, pan: null, src: null });
    });
    if (!tracks.length) {
      this.store.setLive({ loading: false });
      this.store.set({ status: { text: `“${song.name}” has no audio on this device. Add the file again in Songs.`, busy: false } });
      return false;
    }
    await Promise.all(tracks.map((t) => new Promise<void>((r) => {
      if (t.el.readyState >= 1) return r();
      t.el.addEventListener("loadedmetadata", () => r(), { once: true });
      t.el.addEventListener("error", () => r(), { once: true });
    })));
    if (token !== this.token) { tracks.forEach((t) => URL.revokeObjectURL(t.url)); return false; }
    this.tracks = tracks;
    tracks[0]!.el.addEventListener("ended", this.onEnded);
    if (this.ctx) this.connect();
    this.store.setLive({ loading: false });
    if (wasPlaying) await this.play();
    return true;
  }

  private unloadTracks() {
    for (const t of this.tracks) {
      t.el.pause();
      t.el.removeEventListener("ended", this.onEnded);
      t.src?.disconnect();
      t.el.removeAttribute("src");
      URL.revokeObjectURL(t.url);
    }
    this.tracks = [];
  }

  /** Routes every track through its own gain and pan. Needs a user gesture the first time. */
  private connect() {
    this.ctx ??= new AudioContext();
    const c = this.ctx;
    for (const t of this.tracks) {
      if (t.src) continue;
      t.src = c.createMediaElementSource(t.el);
      t.gain = c.createGain();
      t.pan = c.createStereoPanner();
      t.src.connect(t.gain).connect(t.pan).connect(c.destination);
    }
    this.applyMix();
  }

  /** Applies mute, solo, volume and the cue split to every track. */
  applyMix() {
    const { mix, split } = this.l;
    const now = this.ctx?.currentTime ?? 0;
    for (const t of this.tracks) {
      const g = stemGain(t.stem.group, mix);
      if (t.gain) t.gain.gain.setTargetAtTime(g, now, 0.015);
      else t.el.volume = Math.min(1, g);
      if (t.pan) t.pan.pan.setTargetAtTime(split ? (isCue(t.stem.group) ? -1 : 1) : 0, now, 0.015);
    }
  }

  async play() {
    if (!this.tracks.length) {
      const first = this.l.songId ?? this.setlist()[0];
      if (!first || !(await this.load(first))) return;
    }
    this.practice.pause();
    this.connect();
    try {
      if (this.ctx!.state === "suspended") await this.ctx!.resume();
      const t = this.time;
      this.tracks.forEach((x) => { x.el.currentTime = t; });
      await Promise.all(this.tracks.map((x) => x.el.play()));
      this.store.setLive({ playing: true });
    } catch {
      this.tracks.forEach((x) => x.el.pause());
      this.store.set({ status: { text: "Tap Play to start the audio.", busy: false } });
    }
  }

  pause() {
    this.tracks.forEach((x) => x.el.pause());
    this.store.setLive({ playing: false, pending: null });
  }
  toggle() { if (this.l.playing) this.pause(); else void this.play(); }

  /** Stops and goes back to the start of the song. */
  stop() { this.pause(); this.seek(0); }

  seek(t: number) {
    const d = this.song?.duration ?? t;
    const at = Math.max(0, Math.min(t, d));
    this.tracks.forEach((x) => { x.el.currentTime = at; });
  }

  /** Jumps to a section: straight away when stopped, else on the next bar or section end. */
  jumpTo(label: string, to: number) {
    const song = this.song;
    if (!song) return;
    if (!this.l.playing) { this.seek(to); this.store.setLive({ pending: null }); return; }
    const now = this.time;
    const cur = sectionAt(resolveSections(song.sections, song.duration), now);
    const at = jumpTime(now, this.l.jump, { bpm: song.bpm, barOffset: song.barOffset }, cur?.end ?? null);
    if (at - now < 0.03) { this.seek(to); return; }
    this.store.setLive({ pending: { label, at, to } });
  }
  cancelJump() { this.store.setLive({ pending: null }); }

  /** Moves to the next or previous song in the set. */
  async skip(d: number) {
    const list = this.setlist();
    const i = list.indexOf(this.l.songId ?? "");
    const next = list[i + d];
    if (!next) return;
    const playing = this.l.playing;
    this.pause();
    if (await this.load(next)) { this.seek(0); if (playing) await this.play(); }
  }

  private onEnded = () => {
    this.store.setLive({ playing: false, pending: null });
    const list = this.setlist();
    const i = list.indexOf(this.l.songId ?? "");
    if (this.l.autoNext && i >= 0 && list[i + 1]) {
      void this.load(list[i + 1]!).then((ok) => { if (ok) { this.seek(0); void this.play(); } });
    }
  };

  private tick = () => {
    if (this.l.playing && this.tracks.length) {
      const t = this.time;
      const p = this.l.pending;
      if (p && t >= p.at - 0.012) {
        this.seek(p.to);
        this.store.setLive({ pending: null });
      } else if (performance.now() - this.lastSync > 400) {
        this.lastSync = performance.now();
        for (let i = 1; i < this.tracks.length; i++) {
          const el = this.tracks[i]!.el;
          if (!el.ended && Math.abs(el.currentTime - t) > DRIFT) el.currentTime = t;
          if (el.paused && !el.ended) void el.play().catch(() => {});
        }
      }
    }
    requestAnimationFrame(this.tick);
  };
}
