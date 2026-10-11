"use client";
import { analyzeAudio, renderDemoWav } from "./audio/analysisClient.ts";
import { autoLabel, pickBoundaries, refineBoundaries, sectionsFromOrder } from "./audio/analyze.ts";
import { DEMO_LYRICS } from "./audio/demoSong.ts";
import { headingsOf } from "./music/lyrics.ts";
import { parseArrangement, resolveSections, sectionAt, type ResolvedSection } from "./music/sections.ts";
import { PlayerEngine } from "./player/engine.ts";
import { store } from "./store/appStore.ts";
import { LocalRepository, type Repository } from "./store/repository.ts";
import { DEFAULT_PREFS, type Prefs, type QueueItem, type SetItem, type SetList, type Song, type View } from "./store/types.ts";

const DAY = 86_400_000;
let repo: Repository;
let engine: PlayerEngine;

export const uid = () => Math.random().toString(36).slice(2, 10);
const status = (text: string, busy = false) => store.set({ status: { text, busy } });
export const clearStatus = () => store.set({ status: null });

/** The player engine. Only call from the browser after `init`. */
export const player = () => engine;

export function nextSunday(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

/** Loads saved data, or creates the demo song on first run. */
export async function init() {
  if (engine) return;
  repo = new LocalRepository();
  engine = new PlayerEngine(store, repo);
  // handle for automated browser tests and debugging from the console
  Object.assign(window, { __practiceLooper: { store, engine } });
  const [songs, sets, queue, prefs] = await Promise.all([repo.loadSongs(), repo.loadSets(), repo.loadQueue(), repo.loadPrefs()]);
  let view: View = "practice";
  try { view = (localStorage.getItem("pl-view") as View) || "practice"; } catch { /* storage unavailable */ }
  store.set({ songs, sets, queue, prefs: { ...DEFAULT_PREFS, ...(prefs ?? {}) }, view: ["practice", "sets", "songs", "queue"].includes(view) ? view : "practice", ready: true });
  if (songs[0]) { await engine.load(songs[0].id); return; }
  status("Preparing a demo song…", true);
  try {
    const song = await addSong(await renderDemoWav(), "Morning Light (demo)", { artist: "Generated example", key: "G", lyrics: DEMO_LYRICS });
    if (song) {
      const set: SetList = { id: uid(), name: "Sunday service (example)", date: nextSunday(), createdAt: Date.now(), items: [{ songId: song.id, key: "G", note: "Example", addedAt: Date.now(), seen: false }] };
      saveSets([set]);
      status("This is a generated demo song so you can try everything. Add your own songs with Add songs, or drop audio files on the page.");
    }
  } catch {
    status("Add a song to get started.");
  }
}

/* ---------- songs ---------- */

/** Analyses an audio file and adds it to the library. */
export async function addSong(blob: Blob, name: string, extra: Partial<Song> = {}): Promise<Song | null> {
  status(`Splitting “${name}” into sections…`, true);
  try {
    const r = await analyzeAudio(blob);
    const song: Song = {
      id: uid(), name, artist: "", key: "", lyrics: "", arrangement: "",
      bpm: r.tempo?.bpm ?? null, barOffset: r.tempo?.offset ?? 0, bpmSource: "detected",
      duration: r.duration, peaks: r.peaks, analysis: r.analysis, sections: r.sections, source: "auto", addedAt: Date.now(),
      ...extra,
    };
    engine.remember(song.id, blob);
    await repo.saveAudio(song.id, blob);
    await repo.saveSong(song);
    store.set((s) => ({ songs: [...s.songs, song] }));
    await engine.load(song.id);
    status(`Found ${song.sections.length} sections in “${name}”${song.bpm ? ` at about ${Math.round(song.bpm)} BPM` : ""}. If the split looks off, open Fix sections and paste the arrangement order.`);
    return song;
  } catch {
    status(`Couldn't read “${name}”. Use an MP3, M4A, WAV or another audio file your browser can play.`);
    return null;
  }
}

export async function addFiles(files: File[]) {
  const audio = files.filter((f) => f.type.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(f.name));
  if (!audio.length) { status("Those files aren't audio. Add MP3, M4A, WAV, AAC, OGG or FLAC files."); return; }
  setView("practice");
  for (const f of audio) await addSong(f, f.name.replace(/\.[^.]+$/, ""));
}

export function updateSong(id: string, patch: Partial<Song>) {
  let updated: Song | undefined;
  store.set((s) => ({ songs: s.songs.map((x) => (x.id === id ? (updated = { ...x, ...patch }) : x)) }));
  if (updated) void repo.saveSong(updated);
}

export async function removeSong(id: string) {
  if (store.state.player.songId === id) engine.unload();
  engine.forget(id);
  await repo.deleteSong(id);
  store.set((s) => ({ songs: s.songs.filter((x) => x.id !== id) }));
  saveQueue(store.state.queue.filter((q) => q.songId !== id));
  saveSets(store.state.sets.map((st) => ({ ...st, items: st.items.filter((it) => it.songId !== id) })));
}

export async function openSong(id: string) {
  store.setPlayer({ queueIndex: null });
  await engine.load(id);
  markSeen(id);
  setView("practice");
}

const tempoOf = (s: Song) => (s.bpm ? { bpm: s.bpm, offset: s.barOffset } : null);

export function splitByArrangement(id: string, text: string): boolean {
  const s = store.song(id);
  const labels = parseArrangement(text);
  if (!s || !labels.length) return false;
  updateSong(id, { sections: sectionsFromOrder(s.analysis, s.duration, labels, tempoOf(s)), source: "arrangement", arrangement: text });
  engine.setLoop(null);
  return true;
}

export function splitByLyricHeadings(id: string, lyrics: string): boolean {
  const heads = headingsOf(lyrics);
  return heads.length > 0 && splitByArrangement(id, heads.join(", "));
}

export function redetect(id: string) {
  const s = store.song(id);
  if (!s) return;
  const raw = pickBoundaries(s.analysis, s.duration, null);
  const t = tempoOf(s);
  updateSong(id, { sections: autoLabel(s.analysis, s.duration, t ? refineBoundaries(s.analysis, s.duration, raw, t) : raw, s.bpm), source: "auto" });
  engine.setLoop(null);
}

/* section edits */
const editSections = (id: string, fn: (secs: Song["sections"], song: Song) => Song["sections"]) => {
  const s = store.song(id);
  if (s) updateSong(id, { sections: fn(s.sections.map((x) => ({ ...x })), s), source: "edited" });
};
export const renameSection = (id: string, i: number, label: string) => editSections(id, (secs) => { secs[i]!.label = label.trim() || "Section"; return secs; });
export function moveSectionStart(id: string, i: number, t: number) {
  editSections(id, (secs, song) => {
    if (i <= 0) return secs;
    const lo = secs[i - 1]!.start + 0.5, hi = (secs[i + 1]?.start ?? song.duration) - 0.5;
    secs[i]!.start = +Math.min(hi, Math.max(lo, t)).toFixed(3);
    return secs;
  });
}
export const joinWithPrevious = (id: string, i: number) => { editSections(id, (secs) => (i > 0 ? secs.filter((_, k) => k !== i) : secs)); engine.setLoop(null); };
export function splitAt(id: string, t: number): boolean {
  const s = store.song(id);
  if (!s) return false;
  const cur = sectionAt(resolveSections(s.sections, s.duration), t);
  if (!cur || t - cur.start < 1 || cur.end - t < 1) return false;
  editSections(id, (secs) => { secs.splice(cur.idx + 1, 0, { start: +t.toFixed(3), label: "New section" }); return secs; });
  return true;
}

/* ---------- sets ---------- */
function saveSets(sets: SetList[]) { store.set({ sets }); void repo.saveSets(sets); }
const editSet = (id: string, fn: (s: SetList) => SetList) => saveSets(store.state.sets.map((s) => (s.id === id ? fn(s) : s)));

export const isNew = (it: SetItem) => !it.seen && Date.now() - it.addedAt < 7 * DAY;
export function newSet() {
  const set: SetList = { id: uid(), name: "Sunday service", date: nextSunday(), items: [], createdAt: Date.now() };
  saveSets([set, ...store.state.sets]);
  store.set({ openSetId: set.id });
}
export const renameSet = (id: string, name: string) => editSet(id, (s) => ({ ...s, name: name.trim() || "Set" }));
export const setDate = (id: string, date: string) => editSet(id, (s) => ({ ...s, date }));
export const deleteSet = (id: string) => { saveSets(store.state.sets.filter((s) => s.id !== id)); store.set({ openSetId: null }); };
export function addToSet(setId: string, songId: string) {
  const song = store.song(songId);
  editSet(setId, (s) => ({ ...s, items: [...s.items, { songId, key: song?.key ?? "", note: "", addedAt: Date.now(), seen: false }] }));
}
export const updateSetItem = (setId: string, i: number, patch: Partial<SetItem>) => editSet(setId, (s) => ({ ...s, items: s.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) }));
export const removeSetItem = (setId: string, i: number) => editSet(setId, (s) => ({ ...s, items: s.items.filter((_, k) => k !== i) }));
export const moveSetItem = (setId: string, i: number, d: number) => editSet(setId, (s) => ({ ...s, items: swap(s.items, i, i + d) }));
export function markSeen(songId: string) {
  if (!store.state.sets.some((s) => s.items.some((it) => it.songId === songId && !it.seen))) return;
  saveSets(store.state.sets.map((s) => ({ ...s, items: s.items.map((it) => (it.songId === songId ? { ...it, seen: true } : it)) })));
}

/* ---------- queue ---------- */
function saveQueue(queue: QueueItem[]) { store.set({ queue }); void repo.saveQueue(queue); }
export function addToQueue(songId: string, sec: ResolvedSection | null, reps?: number) {
  const song = store.song(songId);
  if (!song) return;
  saveQueue([...store.state.queue, { id: uid(), songId, label: sec?.label ?? "Whole song", start: sec?.start ?? 0, end: sec?.end ?? song.duration, speed: store.state.player.speed, reps: reps ?? (sec ? 4 : 1) }]);
}
export function queueSet(setId: string) {
  const set = store.state.sets.find((s) => s.id === setId);
  set?.items.forEach((it) => addToQueue(it.songId, null, 1));
  setView("queue");
}
export const updateQueueItem = (id: string, patch: Partial<QueueItem>) => {
  saveQueue(store.state.queue.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const i = store.state.player.queueIndex;
  if (i !== null && store.state.queue[i]?.id === id) {
    if (patch.speed) engine.setSpeed(patch.speed);
    if (patch.reps) store.setPlayer({ repTarget: patch.reps });
  }
};
export const moveQueueItem = (i: number, d: number) => { store.setPlayer({ queueIndex: null }); saveQueue(swap(store.state.queue, i, i + d)); };
export const removeQueueItem = (id: string) => { store.setPlayer({ queueIndex: null }); saveQueue(store.state.queue.filter((q) => q.id !== id)); };
export const clearQueue = () => { engine.stopQueue(); saveQueue([]); };
export async function playQueue(from = 0) { setView("practice"); await engine.playQueueItem(from); }

/* ---------- prefs & navigation ---------- */
export function setPrefs(patch: Partial<Prefs>) {
  const prefs = { ...store.state.prefs, ...patch };
  store.set({ prefs });
  void repo.savePrefs(prefs);
}
export function setView(view: View) {
  store.set({ view });
  try { localStorage.setItem("pl-view", view); } catch { /* storage unavailable */ }
  if (typeof window !== "undefined") window.scrollTo(0, 0);
}
export const openSet = (id: string | null) => store.set({ openSetId: id });

function swap<T>(arr: T[], i: number, j: number): T[] {
  if (j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
