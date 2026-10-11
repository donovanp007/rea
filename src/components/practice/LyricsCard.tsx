"use client";
import { useState } from "react";
import { joinWithPrevious, moveSectionStart, player, redetect, renameSection, splitAt, splitByArrangement, splitByLyricHeadings, updateSong } from "@/lib/actions";
import { lyricsFor } from "@/lib/music/lyrics";
import { formatTime, SECTION_NAMES, typeOf, type ResolvedSection } from "@/lib/music/sections";
import { store, useApp } from "@/lib/store/appStore";
import { secVar, useCurrentSong } from "./useCurrentSong";

const say = (text: string) => store.set({ status: { text, busy: false } });

/** Lyrics for the section that's playing, plus song details and section fixing. */
export function LyricsCard() {
  const { song, sections } = useCurrentSong();
  const idx = useApp((s) => s.player.sectionIdx);
  const loop = useApp((s) => s.player.loop);
  const [arr, setArr] = useState<{ id: string; text: string } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  if (!song) return null;

  const sec = loop?.idx != null ? sections[loop.idx] : sections[idx] ?? sections[0];
  const block = sec ? lyricsFor(song.lyrics, sec.label) : null;
  const arrangement = arr?.id === song.id ? arr.text : song.arrangement;

  return (
    <section className="panel" aria-label="Lyrics and sections">
      <div className="panel-h">
        <h3 className="row" style={{ gap: 8 }}>
          <span className="dot" style={{ "--c": sec ? secVar(typeOf(sec.label)) : undefined } as React.CSSProperties} />
          {sec?.label ?? "Lyrics"}
        </h3>
        <span className="label">Lyrics</span>
      </div>
      <div className="panel-b">
        {song.lyrics ? (
          <pre className="lyrics">{block ? block.text || "(Instrumental)" : "No lyrics for this section."}</pre>
        ) : (
          <p className="note">Paste lyrics or a chord chart under Song details and the right part shows here as the song plays.</p>
        )}
      </div>

      <details className="fold" open={detailsOpen} onToggle={(e) => setDetailsOpen(e.currentTarget.open)}>
        <summary>Song details, lyrics and chords</summary>
        {detailsOpen && (
          <form
            className="fold-b"
            key={song.id}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              updateSong(song.id, { name: String(f.get("name")).trim() || song.name, artist: String(f.get("artist")).trim(), key: String(f.get("key")).trim(), lyrics: String(f.get("lyrics")) });
              say("Saved.");
            }}
          >
            <div className="grid2">
              <div className="field"><label className="label" htmlFor="f-name">Title</label><input id="f-name" name="name" type="text" defaultValue={song.name} /></div>
              <div className="field"><label className="label" htmlFor="f-artist">Artist</label><input id="f-artist" name="artist" type="text" defaultValue={song.artist} /></div>
              <div className="field"><label className="label" htmlFor="f-key">Key</label><input id="f-key" name="key" type="text" placeholder="e.g. Bb" defaultValue={song.key} /></div>
            </div>
            <div className="field">
              <label className="label" htmlFor="f-lyrics">Lyrics or chord chart</label>
              <textarea id="f-lyrics" name="lyrics" defaultValue={song.lyrics} placeholder={"Verse 1\nLyrics for the first verse\n\nChorus\nLyrics for the chorus\n\nBridge 1\n…"} />
              <p className="note">Lines like “Verse 1”, “Chorus”, “[Bridge 2]” or “Vamp:” start a section.</p>
            </div>
            <div className="row"><button type="submit" className="btn primary">Save details</button></div>
          </form>
        )}
      </details>

      <details className="fold" open={editOpen} onToggle={(e) => setEditOpen(e.currentTarget.open)}>
        <summary>Fix sections</summary>
        {editOpen && (
          <div className="fold-b">
            <div className="field">
              <label className="label" htmlFor="arr">Arrangement order from Planning Center</label>
              <div className="row">
                <input id="arr" className="grow" type="text" autoComplete="off" placeholder="I, V1, PC, C, V2, PC, C, B1, B2, C, Vamp, O" value={arrangement} onChange={(e) => setArr({ id: song.id, text: e.target.value })} />
                <button type="button" className="btn" onClick={() => say(splitByArrangement(song.id, arrangement) ? "Split by your order. Drag a section edge if one lands early or late." : "Type the order first, for example: I, V1, C, V2, C, B, C, O")}>Split by this order</button>
              </div>
              <p className="note">Shorthand works: I, V1, PC, C, PoC, B1, B2, Vamp, T, Inst, Turn, O.</p>
              <div className="row">
                <button type="button" className="btn sm" onClick={() => say(splitByLyricHeadings(song.id, song.lyrics) ? "Split using the lyric headings." : "No headings found. Add lines like “Verse 1” or “Chorus” above each part of the lyrics.")}>Use the lyric headings</button>
                <button type="button" className="btn sm" onClick={() => { if (!splitAt(song.id, player().time)) say("Move the playhead at least a second away from a section edge, then split."); }}>Split at playhead</button>
                <button type="button" className="btn sm ghost" onClick={() => { redetect(song.id); say("Re-detected the sections."); }}>Re-detect</button>
              </div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {sections.map((s, i) => <SectionRow key={`${song.id}-${i}-${s.start}-${s.label}`} songId={song.id} s={s} i={i} />)}
            </div>
          </div>
        )}
      </details>
    </section>
  );
}

function SectionRow({ songId, s, i }: { songId: string; s: ResolvedSection; i: number }) {
  const known = (SECTION_NAMES as readonly string[]).includes(s.label);
  const [custom, setCustom] = useState(false);
  return (
    <div className="sec-row" style={{ "--c": secVar(typeOf(s.label)) } as React.CSSProperties}>
      <span className="dot" />
      {custom ? (
        <input type="text" autoFocus defaultValue={s.label} aria-label={`Name of section ${i + 1}`}
          onBlur={(e) => { setCustom(false); if (e.target.value.trim() && e.target.value !== s.label) renameSection(songId, i, e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      ) : (
        <select value={s.label} aria-label={`Name of section ${i + 1}`} onChange={(e) => (e.target.value === "__custom" ? setCustom(true) : renameSection(songId, i, e.target.value))}>
          {!known && <option value={s.label}>{s.label}</option>}
          {SECTION_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
          <option value="__custom">Other name…</option>
        </select>
      )}
      <div className="time">
        <button type="button" className="btn sm icon" disabled={i === 0} aria-label={`Start ${s.label} earlier`} title="Start a quarter second earlier" onClick={() => moveSectionStart(songId, i, s.start - 0.25)}>−</button>
        <span className="mono" style={{ minWidth: 52, textAlign: "center" }}>{formatTime(s.start, true)}</span>
        <button type="button" className="btn sm icon" disabled={i === 0} aria-label={`Start ${s.label} later`} title="Start a quarter second later" onClick={() => moveSectionStart(songId, i, s.start + 0.25)}>+</button>
      </div>
      <div className="acts row">
        {i > 0 && <button type="button" className="btn sm ghost" onClick={() => joinWithPrevious(songId, i)}>Join with previous</button>}
      </div>
    </div>
  );
}
