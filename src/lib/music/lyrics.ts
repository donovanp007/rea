import { expandToken, typeOf } from "./sections.ts";

/** One block of a lyric sheet or chord chart, under a section heading. */
export interface LyricBlock {
  label: string;
  text: string;
}

const HEADING = /^\s*[[(]?\s*(intro|verse|vs|pre[- ]?chorus|chorus|bridge|tag|outro|ending|interlude|instrumental|turnaround|vamp)\s*(\d*)\s*[\])]?\s*:?\s*$/i;

/** Splits pasted lyrics or a chord chart into blocks at lines like "Verse 1", "[Chorus]" or "Bridge:". */
export function parseLyrics(text: string): LyricBlock[] {
  const blocks: { label: string; lines: string[] }[] = [];
  let cur: { label: string; lines: string[] } | null = null;
  for (const line of (text || "").split(/\r?\n/)) {
    const m = line.match(HEADING);
    if (m) {
      cur = { label: expandToken(`${m[1]}${m[2] ? " " + m[2] : ""}`) ?? m[1]!, lines: [] };
      blocks.push(cur);
    } else if (cur) cur.lines.push(line);
    else if (line.trim()) {
      cur = { label: "", lines: [line] };
      blocks.push(cur);
    }
  }
  return blocks.map((b) => ({ label: b.label, text: b.lines.join("\n").trim() })).filter((b) => b.label || b.text);
}

/** Section headings in sheet order, usable as an arrangement. */
export function headingsOf(text: string): string[] {
  return parseLyrics(text).map((b) => b.label).filter(Boolean);
}

/**
 * Finds the lyrics for a section. "Chorus 3" falls back to the "Chorus" block because
 * choruses repeat; verses must match by number because each verse has its own words.
 */
export function lyricsFor(text: string, label: string): LyricBlock | null {
  const blocks = parseLyrics(text);
  if (!blocks.length || !label) return null;
  const l = label.toLowerCase();
  const t = typeOf(label);
  const exact = blocks.find((b) => b.label.toLowerCase() === l);
  if (exact) return exact;
  if (t === "verse" || t === "other") return null;
  const base = l.replace(/\s*\d+$/, "");
  return blocks.find((b) => b.label.toLowerCase() === base) ?? blocks.find((b) => typeOf(b.label) === t) ?? null;
}
