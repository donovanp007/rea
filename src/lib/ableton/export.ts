"use client";
import { store } from "../store/appStore.ts";
import type { Repository } from "../store/repository.ts";
import type { Song } from "../store/types.ts";
import type { Service, SetSong } from "../team/types.ts";
import { liveStems, stemKey } from "../live/liveEngine.ts";
import { inspectTemplate, renderAls, type TemplateInfo } from "./als.ts";
import { buildSession, cueSheet, type Session, type SessionOptions, type SessionSongInput } from "./session.ts";
import { wavSampleRate, zipParts } from "./zip.ts";

const TEMPLATE_KEY = "ableton-template";
let repo: Repository;
export const initAbleton = (r: Repository) => { repo = r; };

export const METERS = ["4/4", "3/4", "6/8", "2/4", "5/4", "6/4", "7/8", "12/8"] as const;
export const parseMeter = (m: string | undefined) => {
  const [n, d] = (m ?? "4/4").split("/").map(Number);
  return n && d ? { num: n, den: d } : { num: 4, den: 4 };
};

/** Detected tempos land a hair off (119.96); a value this close to a whole number is that number. */
export const cleanBpm = (bpm: number | null | undefined) => (!bpm ? null : Math.abs(bpm - Math.round(bpm)) < 0.08 ? Math.round(bpm) : Math.round(bpm * 100) / 100);

/* ---------- template ---------- */

async function gunzipText(blob: Blob): Promise<string> {
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  if (head[0] === 0x1f && head[1] === 0x8b) {
    const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  }
  return blob.text();
}
async function gzip(text: string): Promise<Blob> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

export interface StoredTemplate { name: string; info: TemplateInfo }

export async function loadTemplate(): Promise<{ xml: string; name: string } | null> {
  const blob = await repo.loadAudio(TEMPLATE_KEY);
  if (!blob) return null;
  return { xml: await gunzipText(blob), name: (blob as File).name || "Template.als" };
}

/** Checks and stores the user's template set. Returns what was found in it. */
export async function saveTemplate(file: File): Promise<TemplateInfo> {
  let xml: string;
  try { xml = await gunzipText(file); } catch { return { ok: false, creator: "", major: 0, problems: ["Couldn't open that file. Choose the .als file Ableton saved."], audioTracks: [], otherTracks: 0, hasClip: false, hasLocator: false }; }
  const info = inspectTemplate(xml);
  if (info.ok) await repo.saveAudio(TEMPLATE_KEY, file);
  return info;
}
export async function templateInfo(): Promise<StoredTemplate | null> {
  const t = await loadTemplate();
  return t ? { name: t.name, info: inspectTemplate(t.xml) } : null;
}
export const removeTemplate = () => repo.deleteAudio(TEMPLATE_KEY);

/* ---------- export ---------- */

export interface ExportRow { item: SetSong; song: Song | undefined; bpm: number | null; meter: string; stems: number }

/** What the export will contain for each setlist song. Songs without audio are skipped. */
export function exportRows(svc: Service): ExportRow[] {
  return svc.setlist.map((item) => {
    const song = item.songId ? store.song(item.songId) : undefined;
    return { item, song, bpm: item.bpm ?? cleanBpm(song?.bpm), meter: item.meter ?? "4/4", stems: song ? liveStems(song).length : 0 };
  });
}

const EXT: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/aiff": "aif", "audio/x-aiff": "aif", "audio/flac": "flac", "audio/ogg": "ogg" };
const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Untitled";

function inputs(rows: ExportRow[]): SessionSongInput[] {
  return rows.filter((r) => r.song).map((r, i) => {
    const song = r.song!;
    const n = String(i + 1).padStart(2, "0");
    return {
      title: r.item.title || song.name,
      bpm: r.bpm ?? 120,
      sig: parseMeter(r.meter),
      duration: song.duration,
      barOffset: song.barOffset,
      sections: song.sections,
      stems: liveStems(song).map((st) => ({ name: st.name, group: st.group, file: `${n} ${safe(r.item.title || song.name)} - ${safe(st.name)}` })),
    };
  });
}

/** The session the export would build, for the preview. */
export const previewSession = (svc: Service, opts: SessionOptions): Session => buildSession(inputs(exportRows(svc)), opts);
export const previewCues = (svc: Service, opts: SessionOptions) => cueSheet(previewSession(svc, opts));

export const projectName = (svc: Service) => safe(`${svc.date} ${svc.title}`);

/**
 * Builds a ready-to-open Ableton project for a service: "<name> Project/<name>.als" with the
 * stems in Samples/Imported, plus a cue sheet. Returns it as one .zip.
 */
export async function buildAbletonProject(svc: Service, opts: SessionOptions, onProgress?: (text: string) => void): Promise<{ blob: Blob; name: string; session: Session }> {
  const template = await loadTemplate();
  if (!template) throw new Error("Add your Ableton template set first.");
  const rows = exportRows(svc).filter((r) => r.song);
  if (!rows.length) throw new Error("None of this service's songs have audio yet. Add songs or stems first.");
  const songInputs = inputs(rows);
  const name = projectName(svc);
  const folder = `${name} Project`;
  const files: { name: string; data: Uint8Array }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const song = rows[i]!.song!, input = songInputs[i]!;
    onProgress?.(`Collecting stems for “${input.title}” (${i + 1} of ${rows.length})…`);
    const stems = liveStems(song);
    for (let k = 0; k < stems.length; k++) {
      const blob = await repo.loadAudio(stemKey(song, stems[k]!));
      if (!blob) throw new Error(`“${input.title}” is missing its ${stems[k]!.name} audio on this device.`);
      const data = new Uint8Array(await blob.arrayBuffer());
      const ext = EXT[blob.type] ?? (blob as File).name?.split(".").pop()?.toLowerCase() ?? "wav";
      const st = input.stems[k]!;
      st.file = `${st.file}.${ext}`;
      st.sampleRate = wavSampleRate(data.subarray(0, 512));
      files.push({ name: `${folder}/Samples/Imported/${st.file}`, data });
    }
  }
  onProgress?.("Writing the Ableton set…");
  const session = buildSession(songInputs, opts);
  const xml = renderAls(template.xml, session);
  const als = new Uint8Array(await (await gzip(xml)).arrayBuffer());
  const enc = new TextEncoder();
  const readme = `${name}\n\nOpen "${name}.als" in Ableton Live. Keep the Samples folder next to it.\n\n${cueSheet(session)}`;
  const parts = zipParts([{ name: `${folder}/${name}.als`, data: als }, { name: `${folder}/Cue sheet.txt`, data: enc.encode(readme) }, ...files]);
  return { blob: new Blob(parts as BlobPart[], { type: "application/zip" }), name: `${name}.zip`, session };
}

interface ClaudeHost { use(name: "downloads"): Promise<{ save(r: { filename: string; data: Blob }): Promise<{ status: string }> } | null> }

/**
 * Hands a file to the viewer. Inside the Claude app the page can't start downloads itself, so it
 * asks the app to save the file (the viewer confirms); everywhere else it's a normal download.
 * Resolves false if the viewer declined.
 */
export async function download(blob: Blob, name: string): Promise<boolean> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    const dl = await host.use("downloads").catch(() => null);
    if (dl) {
      try { await dl.save({ filename: name, data: blob }); return true; } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "declined") return false;
        if (code === "too_large") throw new Error("That project is too big to save from here. Export from the installed app.");
        // any other refusal: fall back to a plain download below
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
