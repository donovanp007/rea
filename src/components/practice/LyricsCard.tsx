"use client";
import { useState } from "react";
import { joinWithPrevious, moveSectionStart, player, redetect, renameSection, splitAt, splitByArrangement, splitByLyricHeadings, updateSong } from "@/lib/actions";
import { lyricsFor } from "@/lib/music/lyrics";
import { formatTime, typeOf } from "@/lib/music/sections";
import { store, useApp } from "@/lib/store/appStore";
import { secVar, useCurrentSong } from "./useCurrentSong";

const NAMES = ["Intro", "Verse 1", "Verse 2", "Verse 3", "Pre-Chorus", "Chorus", "Bridge", "Tag", "Instrumental", "Outro"];
const say = (text: string) => store.set({ status: { text, busy: false } });

/** Lyrics for the section that's playing, plus song details and section fixing. */
export function LyricsCard() {
  const { song, sections } = useCurrentSong();
  const idx = useApp((s) => s.player.sectionIdx);
  const loop = useApp((s) => s.player.loop);
  const [arr, setArr] = useState<{ id: string; text: string } | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  if (!song) return null;

  const sec = loop?.idx != null ? sections[loop.idx] : sections[idx] ?? sections[0];
  const block = sec ? lyricsFor(song.lyrics, sec.label) : null;
  const arrangement = arr?.id === song.id ? arr.text : song.arrangement;

  return (
    <div className="card">
      <div className="row between">
        <div className="lyrics-label" style={{ "--c": sec ? secVar(typeOf(sec.label)) : undefined } as React.CSSProperties}>
          <i /><h3>{sec?.label ?? "Lyrics"}</h3>
        </div>
        {!song.lyrics && <span className="note">Paste lyrics or a chord chart below and they follow the song.</span>}
      </div>
      {song.lyrics && <pre className="lyrics">{block ? block.text || "(Instrumental)" : "No lyrics for this section."}</pre>}

      <details className="fold" open={lyricsOpen} onToggle={(e) => setLyricsOpen(e.currentTarget.open)}>
        <summary>Song details, lyrics and chords</summary>
        {lyricsOpen && (
          <form
            className="fold-body"
            key={song.id}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              updateSong(song.id, { name: String(f.get("name")).trim() || song.name, artist: String(f.get("artist")).trim(), key: String(f.get("key")).trim(), lyrics: String(f.get("lyrics")) });
              say("Saved. Lyrics follow the sections that have matching headings.");
            }}
          >
            <div className="grid2">
              <div className="field"><label className="eyebrow" htmlFor="f-name">Title</label><input id="f-name" name="name" type="text" defaultValue={song.name} /></div>
              <div className="field"><label className="eyebrow" htmlFor="f-artist">Artist</label><input id="f-artist" name="artist" type="text" defaultValue={song.artist} /></div>
              <div className="field"><label className="eyebrow" htmlFor="f-key">Key</label><input id="f-key" name="key" type="text" placeholder="e.g. Bb" defaultValue={song.key} /></div>
            </div>
            <div className="field">
              <label className="eyebrow" htmlFor="f-lyrics">Lyrics or chord chart, with section headings</label>
              <textarea id="f-lyrics" name="lyrics" defaultValue={song.lyrics} placeholder={"Verse 1\nLyrics for the first verse\n\nChorus\nLyrics for the chorus"} />
              <p className="note">Paste from Planning Center or your chart. Lines like “Verse 1”, “Chorus” or “[Bridge]” start a section.</p>
            </div>
            <div className="row"><button type="submit" className="btn primary">Save details</button></div>
          </form>
        )}
      </details>

      <details className="fold" open={editOpen} onToggle={(e) => setEditOpen(e.currentTarget.open)}>
        <summary>Fix sections</summary>
        {editOpen && (
          <div className="fold-body">
            <div className="field">
              <label className="eyebrow" htmlFor="arr">Arrangement order from Planning Center</label>
              <div className="row">
                <input id="arr" className="grow" type="text" autoComplete="off" placeholder="I, V1, C, V2, C, B, C, O" value={arrangement} onChange={(e) => setArr({ id: song.id, text: e.target.value })} />
                <button type="button" className="btn" onClick={() => say(splitByArrangement(song.id, arrangement) ? "Split by the arrangement order. Drag an edge on the waveform if one lands early or late." : "Type the order first, for example: I, V1, C, V2, C, B, C, O")}>Split by this order</button>
              </div>
              <p className="note">Cuts the song into exactly that many sections, on bar lines, at the strongest changes in the music. Shorthand works: I, V1, PC, C, B, T, Inst, O.</p>
              <div className="row">
                <button type="button" className="btn sm" onClick={() => say(splitByLyricHeadings(song.id, song.lyrics) ? "Split using the lyric headings as the order." : "No section headings found. Add lines like “Verse 1” or “Chorus” above each part of the lyrics.")}>Use the lyric headings as the order</button>
              </div>
            </div>
            <datalist id="sec-names">{NAMES.map((n) => <option key={n} value={n} />)}</datalist>
            <div className="list">
              {sections.map((s, i) => (
                <div className="sec-row" key={`${song.id}-${i}-${s.start}`} style={{ "--c": secVar(typeOf(s.label)) } as React.CSSProperties}>
                  <span className="dot" />
                  <input type="text" list="sec-names" defaultValue={s.label} aria-label={`Name of section ${i + 1}`} onBlur={(e) => { if (e.target.value !== s.label) renameSection(song.id, i, e.target.value); }} />
                  <div className="time">
                    <button type="button" className="btn sm" disabled={i === 0} title="Start a quarter second earlier" aria-label={`Start ${s.label} earlier`} onClick={() => moveSectionStart(song.id, i, s.start - 0.25)}>−</button>
                    <span className="mono">{formatTime(s.start, true)}</span>
                    <button type="button" className="btn sm" disabled={i === 0} title="Start a quarter second later" aria-label={`Start ${s.label} later`} onClick={() => moveSectionStart(song.id, i, s.start + 0.25)}>+</button>
                  </div>
                  <div className="acts row">
                    {i > 0 && <button type="button" className="btn sm ghost" onClick={() => joinWithPrevious(song.id, i)}>Join with previous</button>}
                  </div>
                </div>
              ))}
            </div>
            <div className="row">
              <button type="button" className="btn sm" onClick={() => { if (!splitAt(song.id, player().time)) say("Move the playhead at least a second away from a section edge, then split."); }}>Split at playhead</button>
              <button type="button" className="btn sm" onClick={() => { redetect(song.id); say("Re-detected the sections."); }}>Re-detect automatically</button>
            </div>
          </div>
        )}
      </details>
    </div>
  );
}
