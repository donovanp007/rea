"use client";
import { clearQueue, moveQueueItem, playQueue, player, removeQueueItem, updateQueueItem } from "@/lib/actions";
import { formatTime, shortLabel, typeOf } from "@/lib/music/sections";
import { useApp } from "@/lib/store/appStore";
import { ConfirmButton } from "../shell/ConfirmButton";

const SPEEDS = Array.from({ length: 13 }, (_, i) => 50 + i * 5);

export function QueueView() {
  const queue = useApp((s) => s.queue);
  const songs = useApp((s) => s.songs);
  const index = useApp((s) => s.player.queueIndex);
  return (
    <section className="view" aria-label="Practice queue">
      <div className="vhead">
        <div><h1>Practice queue</h1><p>Each part loops the number of times you set, at its own speed, then moves on.</p></div>
        <div className="row">
          <ConfirmButton label="Clear" confirmLabel="Tap again to clear" className="btn ghost" onConfirm={clearQueue} />
          <button type="button" className="btn primary" disabled={!queue.length} onClick={() => (index !== null ? player().stopQueue() : void playQueue(0))}>{index !== null ? "Stop queue" : "Play queue"}</button>
        </div>
      </div>
      <ul className="list">
        {!queue.length && <li className="empty">Tap ＋ on a section pad to add the parts you want to drill tonight.</li>}
        {queue.map((it, i) => {
          const song = songs.find((s) => s.id === it.songId);
          return (
            <li key={it.id} className={`item${index === i ? " current" : ""}`} style={{ "--c": `var(--sec-${typeOf(it.label)})` } as React.CSSProperties}>
              <span className="sw">{shortLabel(it.label)}</span>
              <div style={{ minWidth: 0 }}>
                <div className="name">{it.label}</div>
                <div className="meta mono">{song?.name ?? "Missing song"} · {formatTime(it.start)}–{formatTime(it.end)}</div>
              </div>
              <div className="acts"><button type="button" className="btn sm" onClick={() => void playQueue(i)}>Play</button></div>
              <div className="opts">
                <label htmlFor={`sp-${it.id}`}>Speed</label>
                <select id={`sp-${it.id}`} value={it.speed} onChange={(e) => updateQueueItem(it.id, { speed: Number(e.target.value) })}>
                  {SPEEDS.map((v) => <option key={v} value={v}>{v}%</option>)}
                </select>
                <label htmlFor={`rp-${it.id}`}>Repeats</label>
                <input id={`rp-${it.id}`} type="number" min={1} max={50} value={it.reps} onChange={(e) => updateQueueItem(it.id, { reps: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} />
                <button type="button" className="btn sm" disabled={i === 0} aria-label="Move up" onClick={() => moveQueueItem(i, -1)}>↑</button>
                <button type="button" className="btn sm" disabled={i === queue.length - 1} aria-label="Move down" onClick={() => moveQueueItem(i, 1)}>↓</button>
                <button type="button" className="btn sm ghost" onClick={() => removeQueueItem(it.id)}>Remove</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
