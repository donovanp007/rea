"use client";
import { useState } from "react";
import { openSong, removeSong } from "@/lib/actions";
import { formatTime } from "@/lib/music/sections";
import { useApp } from "@/lib/store/appStore";
import { ConfirmButton } from "../shell/ConfirmButton";
import { FILE_INPUT_ID } from "../shell/fileInput";

export function SongsView() {
  const songs = useApp((s) => s.songs);
  const currentId = useApp((s) => s.player.songId);
  const [q, setQ] = useState("");
  const shown = songs.filter((s) => !q.trim() || `${s.name} ${s.artist}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <section className="view" aria-label="Songs">
      <div className="vhead">
        <div><h2>Songs</h2><p>Your library. Each song is split into sections when you add it.</p></div>
        <div className="row">
          <input type="search" placeholder="Search songs" aria-label="Search songs" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="btn primary" htmlFor={FILE_INPUT_ID}>Add songs</label>
        </div>
      </div>
      <ul className="list">
        {!songs.length && <li className="empty">No songs yet. Tap Add songs, or drop MP3 or WAV files anywhere on this page.</li>}
        {songs.length > 0 && !shown.length && <li className="empty">No songs match “{q}”.</li>}
        {shown.map((s) => (
          <li key={s.id} className={`item${s.id === currentId ? " current" : ""}`}>
            <span className="sw" style={{ "--c": "var(--sec-chorus)" } as React.CSSProperties}>{s.key || "♪"}</span>
            <div style={{ minWidth: 0 }}>
              <div className="name">{s.name}</div>
              <div className="meta mono">{[s.artist, formatTime(s.duration), s.bpm ? `${Math.round(s.bpm)} BPM` : null, `${s.sections.length} sections`].filter(Boolean).join(" · ")}</div>
            </div>
            <div className="acts">
              <button type="button" className="btn sm" onClick={() => void openSong(s.id)}>Practise</button>
              <ConfirmButton label="Remove" confirmLabel="Tap again to remove" onConfirm={() => void removeSong(s.id)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
