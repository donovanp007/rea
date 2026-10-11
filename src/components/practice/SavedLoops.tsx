"use client";
import { deleteLoop, playSavedLoop, renameLoop, saveCurrentLoop } from "@/lib/actions";
import { describeLength } from "@/lib/music/grid";
import { formatTime, resolveSections, sectionAt, typeOf } from "@/lib/music/sections";
import { useApp } from "@/lib/store/appStore";
import { IconPlay, IconSave, IconTrash } from "../shell/icons";
import { secVar, useCurrentSong } from "./useCurrentSong";

/** Loops the player kept for this song: a fill, a groove, a tricky bar. */
export function SavedLoops() {
  const { song } = useCurrentSong();
  const loop = useApp((s) => s.player.loop);
  if (!song) return null;
  const loops = song.loops ?? [];
  const secs = resolveSections(song.sections, song.duration);
  const grid = { bpm: song.bpm, barOffset: song.barOffset };
  return (
    <section className="panel" aria-label="Saved loops">
      <div className="panel-h">
        <h3>Saved loops</h3>
        <button type="button" className="btn sm" disabled={!loop} onClick={() => saveCurrentLoop()}><IconSave /> Save current loop</button>
      </div>
      <div className="panel-b">
        {!loops.length ? (
          <p className="note">Zoom in, drag the A and B flags around the part you're working on (a fill, a groove, one tricky bar), then save it. It stays with this song.</p>
        ) : (
          <ul className="loops">
            {loops.map((l) => {
              const on = !!loop && Math.abs(loop.start - l.start) < 0.01 && Math.abs(loop.end - l.end) < 0.01;
              const type = typeOf(sectionAt(secs, l.start)?.label ?? "");
              return (
                <li key={l.id} className={`loop-row${on ? " on" : ""}`}>
                  <button type="button" className="btn sm icon" aria-label={`Play ${l.name}`} title="Loop this" onClick={() => void playSavedLoop(song.id, l)}><IconPlay size={14} /></button>
                  <div style={{ minWidth: 0 }}>
                    <input type="text" defaultValue={l.name} key={`${l.id}-${l.name}`} aria-label="Loop name" onBlur={(e) => { if (e.target.value !== l.name) renameLoop(song.id, l.id, e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                    <div className="sub" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="dot" style={{ "--c": secVar(type) } as React.CSSProperties} />
                      {formatTime(l.start, true)}–{formatTime(l.end, true)} · {describeLength(l.end - l.start, grid)} · {l.speed}%
                    </div>
                  </div>
                  <button type="button" className="btn sm icon ghost" aria-label={`Delete ${l.name}`} title="Delete" onClick={() => deleteLoop(song.id, l.id)}><IconTrash /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
