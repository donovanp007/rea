/**
 * Lays out a setlist on one Ableton arrangement timeline: where each song starts, its tempo and
 * time signature, a locator per song and section, and which stem goes on which track.
 *
 * Arrangement time in Ableton is counted in quarter-note beats, whatever the time signature.
 */
import type { StemGroup } from "../tracks/stems.ts";
import { GROUPS, GROUP_ORDER } from "../tracks/stems.ts";

export interface SessionSongInput {
  title: string;
  bpm: number;
  /** Time signature, e.g. 4/4 or 6/8. */
  sig: { num: number; den: number };
  /** Length of the audio, in seconds. */
  duration: number;
  /** Time of the first downbeat in the audio, in seconds (a pickup or count-in comes before it). */
  barOffset: number;
  sections: { label: string; start: number }[];
  /** Audio files for the song: its stems, or one full mix. `file` is the name inside the project. */
  stems: { name: string; group: StemGroup; file: string; sampleRate?: number }[];
}

export interface SessionOptions {
  /** Empty bars between songs. */
  gapBars: number;
  /** A locator per section as well as per song. */
  sectionLocators: boolean;
  /** A "STOP" locator at the end of each song, for players that stop there (e.g. AbleSet). */
  stopLocators: boolean;
}
export const DEFAULT_SESSION_OPTIONS: SessionOptions = { gapBars: 2, sectionLocators: true, stopLocators: true };

export interface Clip { name: string; file: string; start: number; length: number; seconds: number; bpm: number; sampleRate?: number }
export interface SessionTrack { name: string; group: StemGroup; clips: Clip[] }
export interface Locator { beat: number; name: string }
export interface SessionSong { title: string; start: number; end: number; bpm: number; sig: { num: number; den: number }; downbeat: number }

export interface Session {
  songs: SessionSong[];
  tempo: { beat: number; bpm: number }[];
  sig: { beat: number; num: number; den: number }[];
  locators: Locator[];
  tracks: SessionTrack[];
  length: number;
}

const r = (x: number) => Math.round(x * 1e6) / 1e6;
/** Quarter-note beats in one bar. */
export const barBeats = (sig: { num: number; den: number }) => (sig.num * 4) / sig.den;

export function buildSession(songs: SessionSongInput[], opts: SessionOptions = DEFAULT_SESSION_OPTIONS): Session {
  const out: Session = { songs: [], tempo: [], sig: [], locators: [], tracks: [], length: 0 };
  // track per group, plus extra tracks when a song has two stems in one group ("Electric 2")
  const trackFor = new Map<string, SessionTrack>();
  let cursor = 0;

  for (const s of songs) {
    const bpm = r(s.bpm), bar = barBeats(s.sig), beatSec = 60 / bpm;
    // the first downbeat lands on a bar line; any pickup before it gets whole bars of room
    const pickup = s.barOffset / beatSec;
    const room = Math.ceil(pickup / bar - 1e-6) * bar;
    const clipStart = r(cursor + room - pickup);
    const downbeat = r(cursor + room);
    const length = r(s.duration / beatSec);
    const end = r(clipStart + length);

    out.songs.push({ title: s.title, start: cursor, end, bpm, sig: s.sig, downbeat });
    out.tempo.push({ beat: cursor, bpm });
    out.sig.push({ beat: cursor, num: s.sig.num, den: s.sig.den });
    out.locators.push({ beat: cursor, name: s.title });
    if (opts.sectionLocators) {
      for (const sec of s.sections) {
        // detected section times are a few ms off; put the locator on the beat when it's that close
        const raw = clipStart + sec.start / beatSec, onBeat = Math.round(raw - (downbeat % 1)) + (downbeat % 1);
        const beat = r(Math.abs(raw - onBeat) < 0.15 ? onBeat : raw);
        // the first section usually starts with the song; don't stack two locators there
        if (beat - cursor < 0.5) continue;
        out.locators.push({ beat, name: sec.label });
      }
    }
    if (opts.stopLocators) out.locators.push({ beat: end, name: "STOP" });

    const seen = new Map<StemGroup, number>();
    for (const st of s.stems) {
      const n = (seen.get(st.group) ?? 0) + 1;
      seen.set(st.group, n);
      const key = `${st.group}#${n}`;
      let track = trackFor.get(key);
      if (!track) {
        track = { name: GROUPS[st.group].label + (n > 1 ? ` ${n}` : ""), group: st.group, clips: [] };
        trackFor.set(key, track);
      }
      track.clips.push({ name: `${s.title} · ${st.name}`, file: st.file, start: clipStart, length, seconds: s.duration, bpm, sampleRate: st.sampleRate });
    }

    // next song starts on a bar line after this one, plus the gap
    cursor = r(Math.ceil((end - downbeat) / bar - 1e-6) * bar + downbeat + opts.gapBars * bar);
  }

  out.length = cursor;
  out.tracks = [...trackFor.entries()]
    .sort(([a], [b]) => {
      const [ga, na] = a.split("#") as [StemGroup, string], [gb, nb] = b.split("#") as [StemGroup, string];
      return GROUP_ORDER.indexOf(ga) - GROUP_ORDER.indexOf(gb) || +na - +nb;
    })
    .map(([, t]) => t);
  return out;
}

/** A plain-text cue sheet of the session, for the music director's notes. */
export function cueSheet(session: Session): string {
  const lines: string[] = [];
  // bars are counted in each stretch's own time signature
  let bar = 1, prev: SessionSong | null = null;
  session.songs.forEach((s, i) => {
    if (prev) bar += Math.round((s.start - prev.start) / barBeats(prev.sig));
    prev = s;
    lines.push(`${i + 1}. ${s.title} — ${s.bpm} BPM, ${s.sig.num}/${s.sig.den}, starts bar ${bar}`);
    for (const l of session.locators.filter((l) => l.beat > s.start && l.beat <= s.end)) lines.push(`     ${l.name}`);
  });
  return lines.join("\n") + "\n";
}
