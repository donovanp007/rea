"use client";
import { useState } from "react";
import { addToSet, deleteSet, isNew, moveSetItem, newSet, openSet, openSong, queueSet, removeSetItem, renameSet, setDate, updateSetItem } from "@/lib/actions";
import { formatTime, shortLabel } from "@/lib/music/sections";
import { useApp } from "@/lib/store/appStore";
import type { SetList } from "@/lib/store/types";
import { ConfirmButton } from "../shell/ConfirmButton";

const prettyDate = (d: string) => (d ? new Date(`${d}T12:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "No date");

export function SetsView() {
  const sets = useApp((s) => s.sets);
  const openId = useApp((s) => s.openSetId);
  const open = sets.find((s) => s.id === openId);
  return open ? <SetDetail set={open} /> : <SetList sets={sets} />;
}

function SetList({ sets }: { sets: SetList[] }) {
  const songs = useApp((s) => s.songs);
  const sorted = sets.slice().sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="view" aria-label="Set lists">
      <div className="vhead">
        <div><h1>Set lists</h1><p>Plan what the band plays each service. Songs added in the last week show as New.</p></div>
        <button type="button" className="btn primary" onClick={newSet}>New set</button>
      </div>
      {!sets.length ? (
        <p className="empty">No sets yet. Make one for Sunday and add the songs the band is playing.</p>
      ) : (
        <div className="setcards">
          {sorted.map((s) => {
            const fresh = s.items.filter(isNew).length;
            return (
              <button key={s.id} type="button" className="setcard" onClick={() => openSet(s.id)}>
                <span className="date">{prettyDate(s.date)}</span>
                <b>{s.name}</b>
                <span className="songs">{s.items.length ? s.items.map((it) => songs.find((x) => x.id === it.songId)?.name ?? "Missing song").join(" · ") : "No songs yet"}</span>
                {fresh > 0 && <span className="chip new" style={{ justifySelf: "start" }}>{fresh} new</span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SetDetail({ set }: { set: SetList }) {
  const songs = useApp((s) => s.songs);
  const [pick, setPick] = useState("");
  return (
    <section className="view" aria-label={set.name}>
      <div className="vhead">
        <div><h1>{set.name}</h1><p>{prettyDate(set.date)} · {set.items.length} {set.items.length === 1 ? "song" : "songs"}</p></div>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => openSet(null)}>← All sets</button>
          <button type="button" className="btn primary" disabled={!set.items.length} onClick={() => queueSet(set.id)}>Queue whole set</button>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <input className="grow" type="text" aria-label="Set name" defaultValue={set.name} key={`n-${set.id}`} onBlur={(e) => renameSet(set.id, e.target.value)} />
          <input type="date" aria-label="Date" value={set.date} onChange={(e) => setDate(set.id, e.target.value)} />
          <ConfirmButton label="Delete set" confirmLabel="Tap again to delete" className="btn ghost" onConfirm={() => deleteSet(set.id)} />
        </div>
        <div className="row">
          <select className="grow" aria-label="Song to add" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">{songs.length ? "Choose a song to add…" : "Add songs to your library first"}</option>
            {songs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" className="btn" disabled={!pick} onClick={() => { addToSet(set.id, pick); setPick(""); }}>Add to set</button>
        </div>
      </div>
      <ul className="list">
        {!set.items.length && <li className="empty">Add the songs the band is playing. Each one opens straight into practice.</li>}
        {set.items.map((it, i) => {
          const song = songs.find((x) => x.id === it.songId);
          return (
            <li key={`${it.songId}-${i}`} className="item">
              <span className="sw mono">{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div className="name">{song?.name ?? "Missing song"}{isNew(it) && <span className="chip new">New</span>}</div>
                <div className="meta mono">{song ? [song.artist, formatTime(song.duration), song.sections.map((x) => shortLabel(x.label)).join(" ")].filter(Boolean).join(" · ") : ""}</div>
              </div>
              <div className="acts"><button type="button" className="btn sm" disabled={!song} onClick={() => void openSong(it.songId)}>Practise</button></div>
              <div className="opts">
                <input className="key" type="text" placeholder="Key" aria-label="Key for this service" defaultValue={it.key} key={`k-${set.id}-${i}-${it.songId}`} onBlur={(e) => updateSetItem(set.id, i, { key: e.target.value.trim() })} />
                <input className="note-in" type="text" placeholder="Note, e.g. skip V2" aria-label="Note" defaultValue={it.note} key={`t-${set.id}-${i}-${it.songId}`} onBlur={(e) => updateSetItem(set.id, i, { note: e.target.value })} />
                <button type="button" className="btn sm" disabled={i === 0} aria-label="Move up" onClick={() => moveSetItem(set.id, i, -1)}>↑</button>
                <button type="button" className="btn sm" disabled={i === set.items.length - 1} aria-label="Move down" onClick={() => moveSetItem(set.id, i, 1)}>↓</button>
                <button type="button" className="btn sm ghost" onClick={() => removeSetItem(set.id, i)}>Remove</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
