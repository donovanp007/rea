/**
 * Multitrack stems: the separate parts of a song (click, guide, drums, bass…) as churches get
 * them from MultiTracks.com, Loop Community or their own sessions.
 */

export type StemGroup = "click" | "guide" | "drums" | "perc" | "bass" | "ag" | "eg" | "keys" | "synth" | "pad" | "strings" | "vox" | "bgv" | "mix" | "other";

export interface Stem {
  id: string;
  name: string;
  group: StemGroup;
}

/** Display order, label and colour of each group. Click and guide are cues for the band only. */
export const GROUPS: Record<StemGroup, { label: string; short: string; color: string; cue?: boolean }> = {
  click: { label: "Click", short: "CLK", color: "#ffc94d", cue: true },
  guide: { label: "Guide", short: "GDE", color: "#ffd98a", cue: true },
  drums: { label: "Drums", short: "DRM", color: "#ff6b6b" },
  perc: { label: "Percussion", short: "PRC", color: "#ff8fb1" },
  bass: { label: "Bass", short: "BSS", color: "#f2994a" },
  ag: { label: "Acoustic", short: "AG", color: "#d9b26f" },
  eg: { label: "Electric", short: "EG", color: "#5aa9ff" },
  keys: { label: "Keys", short: "KEY", color: "#33c3b0" },
  synth: { label: "Synth", short: "SYN", color: "#d17bff" },
  pad: { label: "Pad", short: "PAD", color: "#9d8cff" },
  strings: { label: "Strings", short: "STR", color: "#7fd47f" },
  vox: { label: "Vocals", short: "VOX", color: "#ff9f80" },
  bgv: { label: "Backing vocals", short: "BGV", color: "#ffb8a0" },
  mix: { label: "Full mix", short: "MIX", color: "#a3adbb" },
  other: { label: "Other", short: "OTH", color: "#8b97ab" },
};
export const GROUP_ORDER = Object.keys(GROUPS) as StemGroup[];

// First match wins, so more specific names come before general ones ("synth bass" is bass,
// "acoustic guitar" is acoustic, "lead vox" is vocals, not a lead synth).
const RULES: [StemGroup, RegExp][] = [
  ["click", /\b(click|metronome|clk|met)\b/],
  ["guide", /\b(guide|guides|cues?|cue track|count ?in|vocal cues?|gde)\b/],
  ["bgv", /\b(bgv|bgvs|backing|background|harmon(y|ies)|choir|alto|tenor|soprano|bv|bvs)\b/],
  ["vox", /\b(vox|vocals?|lead vocal|lv|singer)\b/],
  ["bass", /\b(bass|sub bass|synth bass|bass gtr|bs)\b/],
  ["perc", /\b(perc|percussion|shaker|tamb|tambourine|conga|bongo|claps?|toms? loop)\b/],
  ["drums", /\b(drums?|kit|kick|snare|hats?|hi-?hats?|overheads?|oh|cymbals?|toms?|rooms?|loop|loops|beat)\b/],
  ["ag", /\b(ag|acoustic|ac gtr|acc gtr|acoustic guitar)\b/],
  ["eg", /\b(eg|eg\d|electric|elec|gtr|guitars?|lead gtr)\b/],
  ["pad", /\b(pads?|ambient|atmos|swell|drone|texture)\b/],
  ["strings", /\b(strings?|cello|violin|viola|orch|orchestra|brass|horns?)\b/],
  ["keys", /\b(keys|piano|pno|rhodes|wurli|wurlitzer|organ|b3|ep)\b/],
  ["synth", /\b(synths?|syn|arp|arps|sequence|seq|plucks?|lead synth|fx|sfx|tracks?)\b/],
  ["mix", /\b(mix|full mix|master|stereo mix|reference)\b/],
];

/** The group a stem belongs to, from its file name. */
export function classifyStem(fileName: string): StemGroup {
  const n = stemName(fileName).toLowerCase().replace(/[_\-.]+/g, " ");
  for (const [group, re] of RULES) if (re.test(n)) return group;
  return "other";
}

/**
 * Names and groups for the files of ONE song. The song title is usually part of every file name
 * ("ALLELUIA_drums (RP).mp3"), and a title like "Bass Drum Blues" would fool the matcher, so what
 * the files share at the start is removed first, along with tags like "(RP)".
 */
export function classifyBatch(fileNames: string[]): { name: string; group: StemGroup }[] {
  const base = fileNames.map((f) => stemName(f).replace(/\((rp|stem|stems|mp3|wav)\)/gi, "").replace(/\s+/g, " ").trim());
  let prefix = "";
  if (base.length > 1) {
    prefix = base[0]!;
    for (const b of base) while (prefix && !b.toLowerCase().startsWith(prefix.toLowerCase())) prefix = prefix.slice(0, -1);
    // only cut at a word edge, and never the whole name
    const cut = prefix.search(/[\s_\-.]+[^\s_\-.]*$/);
    prefix = base.every((b) => b.length > prefix.length) && /[\s_\-.]$/.test(prefix) ? prefix : cut > 2 && base.every((b) => b.length > cut + 1) && prefix.length < Math.min(...base.map((b) => b.length)) ? prefix.slice(0, cut + 1) : "";
  }
  return fileNames.map((f, i) => {
    const rest = prefix ? base[i]!.slice(prefix.length).replace(/^[\s_\-.]+/, "") : base[i]!;
    const label = rest || base[i]!;
    return { name: label, group: classifyStem(label) };
  });
}

/** A tidy display name: no extension, no leading track number. */
export function stemName(fileName: string): string {
  return fileName.replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]{2,4}$/i, "").replace(/^\d{1,3}[\s._-]+/, "").replace(/_/g, " ").trim() || fileName;
}

/** Stems in mixer order: by group, then by name. */
export function sortStems<T extends Stem>(stems: T[]): T[] {
  return stems.slice().sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.name.localeCompare(b.name));
}

export const isCue = (g: StemGroup) => !!GROUPS[g].cue;

/** A mixer strip setting. Kept per group, so "click muted" carries from song to song. */
export interface Strip {
  vol: number;
  mute: boolean;
  solo: boolean;
}
export const DEFAULT_STRIP: Strip = { vol: 0.8, mute: false, solo: false };

/**
 * The gain each stem plays at. Solo wins over mute; cue tracks (click, guide) ignore solo so
 * the band never loses the click when someone soloes the bass.
 */
export function stemGain(group: StemGroup, mix: Partial<Record<StemGroup, Strip>>): number {
  const s = mix[group] ?? DEFAULT_STRIP;
  const anySolo = Object.entries(mix).some(([g, x]) => x?.solo && !isCue(g as StemGroup));
  if (s.mute) return 0;
  if (anySolo && !isCue(group) && !s.solo) return 0;
  return s.vol;
}

/**
 * Where to jump when a section is tapped during playback. "bar" waits for the next downbeat,
 * "section" for the end of the current section, "now" jumps straight away. Returns the song time
 * at which the jump happens.
 */
export function jumpTime(now: number, mode: "now" | "bar" | "section", grid: { bpm: number | null; barOffset: number }, sectionEnd: number | null): number {
  if (mode === "now") return now;
  if (mode === "section" && sectionEnd !== null) return sectionEnd;
  if (!grid.bpm) return now;
  const bar = 240 / grid.bpm;
  const k = Math.floor((now - grid.barOffset) / bar + 1e-6) + 1;
  return Math.max(now, grid.barOffset + k * bar);
}
