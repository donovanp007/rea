"use client";
import { resolveSections, sectionAt, type ResolvedSection } from "../music/sections.ts";
import type { AppStore, Loop } from "../store/appStore.ts";
import type { Repository } from "../store/repository.ts";

interface WakeLockLike { release(): Promise<void> }

/**
 * Owns the <audio> element and all timing: looping, gaps and count-ins between repeats,
 * the speed trainer, section launches that wait for the end of the current section,
 * and stepping through the practice queue.
 *
 * Speed changes keep the key (the browser's `preservesPitch`).
 */
export class PlayerEngine {
  readonly audio: HTMLAudioElement;
  private url: string | null = null;
  private gapTimer: ReturnType<typeof setTimeout> | undefined;
  private ctx: AudioContext | null = null;
  private wake: WakeLockLike | null = null;
  private audioCache = new Map<string, Blob>();
  private loadToken = 0;

  constructor(private store: AppStore, private repo: Repository) {
    const a = new Audio();
    a.preload = "auto";
    a.preservesPitch = true;
    this.audio = a;
    a.addEventListener("play", () => this.store.setPlayer({ playing: true }));
    a.addEventListener("pause", () => this.store.setPlayer({ playing: false }));
    a.addEventListener("ended", () => this.onEnded());
    requestAnimationFrame(this.tick);
  }

  /** Keeps a just-added file in memory so it plays even when device storage is unavailable. */
  remember(songId: string, blob: Blob) { this.audioCache.set(songId, blob); }
  forget(songId: string) { this.audioCache.delete(songId); }

  private get p() { return this.store.state.player; }
  get song() { return this.store.song(this.p.songId); }
  sections(): ResolvedSection[] {
    const s = this.song;
    return s ? resolveSections(s.sections, s.duration) : [];
  }
  get time() { return this.audio.currentTime; }

  /** Loads a song into the player. Keeps the current loop state when `keepLoop` is set. */
  async load(songId: string, keepLoop = false): Promise<boolean> {
    if (this.p.songId === songId && this.audio.src) return true;
    const token = ++this.loadToken;
    this.audio.pause();
    this.clearGap();
    const blob = this.audioCache.get(songId) ?? (await this.repo.loadAudio(songId));
    if (token !== this.loadToken) return false;
    if (!blob) {
      this.store.set({ status: { text: "This song's audio isn't on this device any more. Remove it and add the file again.", busy: false } });
      return false;
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(blob);
    this.audio.src = this.url;
    this.audio.playbackRate = this.p.speed / 100;
    await new Promise<void>((r) => {
      if (this.audio.readyState >= 1) return r();
      this.audio.addEventListener("loadedmetadata", () => r(), { once: true });
      this.audio.addEventListener("error", () => r(), { once: true });
    });
    this.store.setPlayer({ songId, sectionIdx: -1, ...(keepLoop ? {} : { loop: null, reps: 0, repTarget: 0, pending: null, queueIndex: null }) });
    return true;
  }

  unload() {
    this.audio.pause();
    this.audio.removeAttribute("src");
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.store.setPlayer({ songId: null, loop: null, pending: null, queueIndex: null, sectionIdx: -1 });
  }

  async play() {
    if (!this.p.songId) return;
    try {
      if (this.ctx?.state === "suspended") await this.ctx.resume();
      await this.audio.play();
      this.keepAwake(true);
    } catch {
      this.store.set({ status: { text: "Tap Play to start the audio.", busy: false } });
    }
  }
  pause() {
    this.audio.pause();
    this.clearGap();
    this.store.setPlayer({ waiting: false });
    this.keepAwake(false);
  }
  toggle() {
    if (this.p.waiting || !this.audio.paused) this.pause();
    else void this.play();
  }
  seek(t: number) {
    this.audio.currentTime = Math.max(0, Math.min(t, this.song?.duration ?? t));
    const loop = this.p.loop;
    if (loop && (t < loop.start || t > loop.end)) this.setLoop(null);
    this.updateSection(true);
  }

  setSpeed(pct: number) {
    const v = Math.max(50, Math.min(110, Math.round(pct)));
    this.audio.playbackRate = v / 100;
    this.store.setPlayer({ speed: v });
  }

  setTrainer(on: boolean) {
    this.store.setPlayer({ trainer: on, reps: 0 });
    if (on) this.setSpeed(this.store.state.prefs.trainerStart);
  }

  setLoop(loop: Loop | null, repTarget = 0) {
    this.clearGap();
    this.store.setPlayer({ loop, reps: 0, repTarget, pending: null, waiting: false });
    if (loop) {
      this.audio.currentTime = loop.start;
      if (this.p.trainer && this.p.queueIndex === null) this.setSpeed(this.store.state.prefs.trainerStart);
    }
    this.updateSection(true);
  }

  /** Tapping a section pad: loop it now, or queue it for the end of the current section. */
  launch(sec: ResolvedSection) {
    const loop = this.p.loop;
    if (loop && loop.idx === sec.idx) { this.setLoop(null); return; }
    const target: Loop = { start: sec.start, end: sec.end, label: sec.label, idx: sec.idx };
    if (this.store.state.prefs.launch === "end" && !this.audio.paused && !this.p.waiting) {
      const from = loop?.idx ?? sectionAt(this.sections(), this.time)?.idx ?? -1;
      this.store.setPlayer({ pending: { ...target, from } });
      return;
    }
    this.setLoop(target);
    void this.play();
  }

  loopCurrent() {
    if (this.p.loop) { this.setLoop(null); return; }
    const s = sectionAt(this.sections(), this.time);
    if (s) this.setLoop({ start: s.start, end: s.end, label: s.label, idx: s.idx });
  }

  step(d: number) {
    const ss = this.sections();
    if (!ss.length) return;
    const cur = this.p.loop?.idx ?? sectionAt(ss, this.time)?.idx ?? 0;
    const s = ss[Math.max(0, Math.min(ss.length - 1, cur + d))]!;
    if (this.p.loop) this.setLoop({ start: s.start, end: s.end, label: s.label, idx: s.idx });
    else this.seek(s.start);
  }

  /** Plays queue item `i`; past the end, stops and reports the queue finished. */
  async playQueueItem(i: number): Promise<void> {
    const item = this.store.state.queue[i];
    if (!item) {
      this.store.setPlayer({ queueIndex: null });
      this.setLoop(null);
      this.pause();
      if (i > 0) this.store.set({ status: { text: "Queue finished. Nice work.", busy: false } });
      return;
    }
    if (!this.store.song(item.songId)) return this.playQueueItem(i + 1);
    this.store.setPlayer({ queueIndex: i });
    if (!(await this.load(item.songId, true))) return;
    this.store.setPlayer({ queueIndex: i });
    this.setSpeed(item.speed);
    const idx = this.song?.sections.findIndex((x) => x.label === item.label && Math.abs(x.start - item.start) < 0.01) ?? -1;
    this.setLoop({ start: item.start, end: item.end, label: item.label, idx: idx >= 0 ? idx : null }, item.reps);
    await this.play();
  }
  stopQueue() {
    this.store.setPlayer({ queueIndex: null });
    this.setLoop(null);
    this.pause();
  }

  private onLoopEnd() {
    const p = this.p;
    const loop = p.loop!;
    const reps = p.reps + 1;
    this.store.setPlayer({ reps });
    if (p.queueIndex !== null && p.repTarget && reps >= p.repTarget) { void this.playQueueItem(p.queueIndex + 1); return; }
    if (p.trainer && p.queueIndex === null) {
      const { trainerStep, trainerTarget } = this.store.state.prefs;
      this.setSpeed(Math.min(trainerTarget, p.speed + trainerStep));
    }
    if (p.pending) { const { from: _from, ...next } = p.pending; this.setLoop(next); return; }
    const gap = this.store.state.prefs.gap;
    let wait = gap === "p1" ? 1 : gap === "p2" ? 2 : 0;
    if (gap === "c1" || gap === "c2") wait = this.countIn(gap === "c1" ? 4 : 8) || 2;
    this.audio.currentTime = loop.start;
    if (wait > 0) {
      this.audio.pause();
      this.store.setPlayer({ waiting: true });
      this.gapTimer = setTimeout(() => { this.store.setPlayer({ waiting: false }); void this.play(); }, wait * 1000);
    } else if (this.audio.paused) {
      // a loop that ends at the very end of the song stops the audio; start it again
      void this.play();
    }
  }

  private onEnded() {
    if (this.p.loop) { this.onLoopEnd(); return; }
    if (this.p.queueIndex !== null) void this.playQueueItem(this.p.queueIndex + 1);
    else this.keepAwake(false);
  }

  /** Clicks a count-in at the song's tempo (scaled by the current speed). Returns its length in seconds. */
  private countIn(beats: number): number {
    const bpm = (this.song?.bpm ?? 0) * (this.p.speed / 100);
    if (!bpm) return 0;
    this.ctx ??= new AudioContext();
    const c = this.ctx, spb = 60 / bpm, t0 = c.currentTime + 0.05;
    for (let i = 0; i < beats; i++) {
      const o = c.createOscillator(), g = c.createGain(), t = t0 + i * spb;
      o.frequency.value = i % 4 === 0 ? 1650 : 1100;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.08);
    }
    return beats * spb + 0.05;
  }

  private clearGap() {
    if (this.gapTimer !== undefined) clearTimeout(this.gapTimer);
    this.gapTimer = undefined;
  }

  private updateSection(force = false) {
    const s = sectionAt(this.sections(), this.time);
    const idx = s?.idx ?? -1;
    if (force || idx !== this.p.sectionIdx) this.store.setPlayer({ sectionIdx: idx });
  }

  private tick = () => {
    const p = this.p;
    if (p.songId && !this.audio.paused && !p.waiting) {
      const t = this.time;
      if (p.loop && t >= p.loop.end - 0.03) this.onLoopEnd();
      else if (!p.loop && p.pending) {
        const cur = sectionAt(this.sections(), t);
        if (cur && cur.idx !== p.pending.from) { const { from: _from, ...next } = p.pending; this.setLoop(next); }
      }
      this.updateSection();
    }
    requestAnimationFrame(this.tick);
  };

  private async keepAwake(on: boolean) {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLockLike> } };
      if (on && nav.wakeLock && !this.wake) this.wake = await nav.wakeLock.request("screen");
      else if (!on && this.wake) { await this.wake.release(); this.wake = null; }
    } catch {
      this.wake = null;
    }
  }
}
