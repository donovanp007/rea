/** A named part of a song. `start` is in seconds; the end is the next section's start. */
export interface Section {
  start: number;
  label: string;
}

/** A section with its end time and position resolved. */
export interface ResolvedSection extends Section {
  end: number;
  idx: number;
}

export type SectionType = "intro" | "verse" | "pre" | "chorus" | "bridge" | "tag" | "inst" | "outro" | "other";

/** Classifies a free-text section label so it can be coloured and matched to lyrics. */
export function typeOf(label: string): SectionType {
  const l = (label || "").toLowerCase();
  if (/pre/.test(l)) return "pre";
  if (/chorus/.test(l)) return "chorus";
  if (/verse/.test(l)) return "verse";
  if (/bridge/.test(l)) return "bridge";
  if (/intro/.test(l)) return "intro";
  if (/outro|ending|^end/.test(l)) return "outro";
  if (/tag/.test(l)) return "tag";
  if (/inst|interlude|turn|solo|vamp/.test(l)) return "inst";
  return "other";
}

const SHORT: Record<SectionType, string> = { intro: "I", verse: "V", pre: "PC", chorus: "C", bridge: "B", tag: "T", inst: "In", outro: "O", other: "•" };

/** Planning Center style shorthand for a label, e.g. "Verse 2" → "V2". */
export function shortLabel(label: string): string {
  const n = (label.match(/\d+$/) ?? [""])[0];
  return SHORT[typeOf(label)] + n;
}

/** Expands one arrangement token ("V1", "pc", "Br") into a section name. */
export function expandToken(tok: string): string | null {
  const t = tok.trim();
  if (!t) return null;
  const l = t.toLowerCase().replace(/\s+/g, " ");
  const num = (m: RegExpMatchArray | null) => (m && m[1] ? " " + m[1] : "");
  let m: RegExpMatchArray | null;
  if ((m = l.match(/^(?:v|vs|verse)\s*(\d*)$/))) return "Verse" + num(m);
  if ((m = l.match(/^(?:pc|pre|pre-chorus|prechorus|pre chorus)\s*(\d*)$/))) return "Pre-Chorus" + num(m);
  if ((m = l.match(/^(?:c|ch|cho|chorus)\s*(\d*)$/))) return "Chorus" + num(m);
  if ((m = l.match(/^(?:b|br|bridge)\s*(\d*)$/))) return "Bridge" + num(m);
  if (/^(?:i|in|intro)$/.test(l)) return "Intro";
  if (/^(?:o|out|outro|end|ending)$/.test(l)) return "Outro";
  if ((m = l.match(/^(?:t|tag)\s*(\d*)$/))) return "Tag" + num(m);
  if (/^(?:inst|instrumental|interlude|turn|turnaround|solo)$/.test(l)) return "Instrumental";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Parses an arrangement sequence like "I, V1, C, V2, C, B, C, O" into section names. */
export function parseArrangement(text: string): string[] {
  return text
    .split(/[,;|\n]+|\s+-\s+|\s*→\s*/)
    .map(expandToken)
    .filter((x): x is string => Boolean(x));
}

/** Numbers repeated labels so every pad is distinguishable: Chorus, Chorus 2, Chorus 3. */
export function numberRepeats<T extends Section>(secs: T[]): T[] {
  const seen: Record<string, number> = {};
  return secs.map((s) => {
    const n = (seen[s.label] = (seen[s.label] ?? 0) + 1);
    return { ...s, label: n > 1 && !/\d$/.test(s.label) ? `${s.label} ${n}` : s.label };
  });
}

/** Adds end times and indexes. */
export function resolveSections(sections: Section[], duration: number): ResolvedSection[] {
  return sections.map((x, i) => ({ ...x, end: sections[i + 1]?.start ?? duration, idx: i }));
}

/** The section playing at time `t`. */
export function sectionAt(sections: ResolvedSection[], t: number): ResolvedSection | undefined {
  for (let i = sections.length - 1; i >= 0; i--) {
    const s = sections[i]!;
    if (t >= s.start - 0.001) return s;
  }
  return sections[0];
}

/** Bars covered by a length of time, given a tempo in 4/4. */
export function barsFor(seconds: number, bpm: number | null): number | null {
  return bpm ? Math.max(1, Math.round((seconds * bpm) / 60 / 4)) : null;
}

/** m:ss or m:ss.s */
export function formatTime(t: number, tenths = false): string {
  const v = Math.max(0, t || 0);
  const m = Math.floor(v / 60);
  const s = v - m * 60;
  return `${m}:${tenths ? s.toFixed(1).padStart(4, "0") : String(Math.floor(s)).padStart(2, "0")}`;
}
