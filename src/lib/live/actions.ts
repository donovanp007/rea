"use client";
import { mixdownStems, renderDemoStems } from "../audio/analysisClient.ts";
import { DEMO_ARRANGEMENT, DEMO_LYRICS } from "../audio/demoSong.ts";
import { store, type JumpMode, type LiveState } from "../store/appStore.ts";
import type { Repository } from "../store/repository.ts";
import type { Song } from "../store/types.ts";
import type { PlayerEngine } from "../player/engine.ts";
import { addSetSong } from "../team/actions.ts";
import { classifyBatch, classifyStem, DEFAULT_STRIP, isCue, type Stem, type StemGroup, type Strip } from "../tracks/stems.ts";
import { LiveEngine } from "./liveEngine.ts";

let live: LiveEngine;
let repo: Repository;
let deps: { addSong: (blob: Blob, name: string, extra?: Partial<Song>) => Promise<Song | null>; updateSong: (id: string, patch: Partial<Song>) => void; uid: () => string };

const PREFS_KEY = "wf-live";
const DEMO_KEY = "wf-demo-stems";
const status = (text: string, busy = false) => store.set({ status: { text, busy } });

/** The Live engine. Only call from the browser after `initLive`. */
export const liveEngine = () => live;

export function initLive(r: Repository, practice: PlayerEngine, d: typeof deps) {
  repo = r;
  deps = d;
  live = new LiveEngine(store, repo, practice);
  live.setlist = () => liveSetlist(store.state.live.serviceId).map((x) => x.songId);
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<LiveState> | null;
    if (saved) store.setLive({ mix: saved.mix ?? {}, split: !!saved.split, autoNext: saved.autoNext ?? true, jump: saved.jump ?? "bar" });
  } catch { /* storage unavailable */ }
  Object.assign(window, { __live: live });
}

function savePrefs() {
  const { mix, split, autoNext, jump } = store.state.live;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ mix, split, autoNext, jump })); } catch { /* storage unavailable */ }
}

export interface LiveItem { songId: string; title: string; key: string; song: Song }

/** The songs Live plays: the service's setlist songs that have audio, or the whole library. */
export function liveSetlist(serviceId: string | null): LiveItem[] {
  const { songs, team } = store.state;
  const svc = serviceId ? team?.services.find((s) => s.id === serviceId) : undefined;
  if (svc) {
    return svc.setlist.flatMap((it) => {
      const song = it.songId ? songs.find((s) => s.id === it.songId) : undefined;
      return song ? [{ songId: song.id, title: it.title || song.name, key: it.key || song.key, song }] : [];
    });
  }
  return songs.map((song) => ({ songId: song.id, title: song.name, key: song.key, song }));
}

/** Opens a set in Live mode and loads its first song (or `songId`). */
export async function openLive(serviceId: string | null, songId?: string) {
  if (store.state.live.serviceId !== serviceId) live.pause();
  store.setLive({ serviceId });
  const list = liveSetlist(serviceId);
  const target = songId ?? (list.some((x) => x.songId === store.state.live.songId) ? store.state.live.songId : list[0]?.songId);
  if (target) await live.load(target);
}

export async function playSong(songId: string) {
  const playing = store.state.live.playing;
  live.pause();
  if (await live.load(songId)) { live.seek(0); if (playing) await live.play(); }
}

export function setStrip(group: StemGroup, patch: Partial<Strip>) {
  const mix = store.state.live.mix;
  store.setLive({ mix: { ...mix, [group]: { ...DEFAULT_STRIP, ...mix[group], ...patch } } });
  live.applyMix();
  savePrefs();
}
export function resetMix() { store.setLive({ mix: {} }); live.applyMix(); savePrefs(); }
export function setSplit(split: boolean) { store.setLive({ split }); live.applyMix(); savePrefs(); }
export function setAutoNext(autoNext: boolean) { store.setLive({ autoNext }); savePrefs(); }
export function setJump(jump: JumpMode) { store.setLive({ jump }); savePrefs(); }

const AUDIO = (f: File) => f.type.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg|flac|aif|aiff)$/i.test(f.name);

/** Stores stem files and returns their stem records. */
async function saveStems(files: File[]): Promise<Stem[]> {
  const stems: Stem[] = [];
  const labels = classifyBatch(files.map((f) => f.name));
  for (const [i, f] of files.entries()) {
    const stem: Stem = { id: deps.uid(), name: labels[i]!.name, group: labels[i]!.group };
    await repo.saveAudio(`stem:${stem.id}`, f);
    stems.push(stem);
  }
  return stems;
}

/** Adds stem files to an existing song. */
export async function addStems(songId: string, files: File[]) {
  const song = store.song(songId);
  const audio = files.filter(AUDIO);
  if (!song || !audio.length) { status("Choose the stem files (WAV, MP3, M4A…) for this song."); return; }
  status(`Adding ${audio.length} stems to “${song.name}”…`, true);
  const stems = await saveStems(audio);
  deps.updateSong(songId, { stems: [...(song.stems ?? []), ...stems] });
  await reloadIfOpen(songId);
  const unknown = stems.filter((s) => s.group === "other").length;
  status(`Added ${stems.length} stems to “${song.name}”.${unknown ? ` ${unknown} weren't recognised from their names; they're under Other.` : ""}`);
}

/** Creates a song from a folder of stems: mixes them down, finds sections and tempo, keeps the stems. */
export async function newMultitrackSong(files: File[]) {
  const audio = files.filter(AUDIO);
  if (!audio.length) { status("Choose the stem files for one song (Click.wav, Drums.wav, Bass.wav…)."); return; }
  const name = songNameFrom(audio);
  status(`Mixing ${audio.length} stems of “${name}” to find its sections…`, true);
  try {
    const groups = classifyBatch(audio.map((f) => f.name));
    const mix = await mixdownStems(audio.map((f, i) => ({ blob: f, cue: isCue(groups[i]!.group) })));
    const song = await deps.addSong(mix, name);
    if (!song) return;
    const stems = await saveStems(audio);
    deps.updateSong(song.id, { stems });
    await openLive(store.state.live.serviceId && liveSetlist(store.state.live.serviceId).some((x) => x.songId === song.id) ? store.state.live.serviceId : null, song.id);
    status(`“${name}” is ready with ${stems.length} stems and ${song.sections.length} sections.`);
  } catch {
    status("Couldn't read those stems. Use WAV, MP3, M4A or another format your browser plays.");
  }
}

export async function removeStem(songId: string, stemId: string) {
  const song = store.song(songId);
  if (!song) return;
  deps.updateSong(songId, { stems: (song.stems ?? []).filter((s) => s.id !== stemId) });
  await repo.deleteAudio(`stem:${stemId}`);
  await reloadIfOpen(songId);
}
export async function setStemGroup(songId: string, stemId: string, group: StemGroup) {
  const song = store.song(songId);
  if (!song) return;
  deps.updateSong(songId, { stems: (song.stems ?? []).map((s) => (s.id === stemId ? { ...s, group } : s)) });
  await reloadIfOpen(songId);
}

async function reloadIfOpen(songId: string) {
  if (store.state.live.songId !== songId) return;
  const playing = store.state.live.playing, t = live.time;
  live.pause();
  store.setLive({ songId: null });
  if (await live.load(songId)) { live.seek(t); if (playing) await live.play(); }
}

/** A song name from stem files: their folder, or the part of the file names they share. */
export function songNameFrom(files: { name: string; webkitRelativePath?: string }[]): string {
  const folder = files[0]?.webkitRelativePath?.split("/").slice(-2, -1)[0];
  if (folder) return folder;
  const names = files.map((f) => f.name.replace(/\.[^.]+$/, ""));
  let prefix = names[0] ?? "";
  for (const n of names) while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1);
  const clean = prefix.replace(/[\s_\-.]+$/, "").replace(/_/g, " ").trim();
  return clean.length >= 3 && names.length > 1 ? clean : "New multitrack song";
}

/** First run: a generated song with separate click, drums, bass, keys and pad tracks. */
export async function ensureDemoMultitrack() {
  if (store.state.songs.some((s) => s.stems?.length)) return;
  try { if (localStorage.getItem(DEMO_KEY)) return; } catch { /* storage unavailable */ }
  status("Preparing a multitrack demo for Live mode…", true);
  try {
    const { mix, stems: files } = await renderDemoStems();
    const song = await deps.addSong(mix, "Morning Light (multitrack demo)", { artist: "Generated example", key: "G", lyrics: DEMO_LYRICS, arrangement: DEMO_ARRANGEMENT });
    if (!song) return;
    const stems: Stem[] = [];
    for (const f of files) {
      const stem: Stem = { id: deps.uid(), name: f.name, group: classifyStem(f.name) };
      await repo.saveAudio(`stem:${stem.id}`, f.blob);
      stems.push(stem);
    }
    deps.updateSong(song.id, { stems });
    const next = store.state.team?.services.find((s) => s.date >= new Date().toISOString().slice(0, 10));
    if (next && !next.setlist.some((x) => x.songId === song.id)) addSetSong(next.id, { title: "Morning Light", key: "G", minutes: 2, songId: song.id });
    try { localStorage.setItem(DEMO_KEY, "1"); } catch { /* storage unavailable */ }
    status("Added a multitrack demo song. Open Live to run it with click, drums, bass, keys and pad.");
  } catch {
    status("Couldn't prepare the multitrack demo. Add your own stems in Live.");
  }
}
