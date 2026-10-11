"use client";
import { useEffect, useRef } from "react";
import { addToQueue, player, setPrefs } from "@/lib/actions";
import { barsFor, formatTime, typeOf } from "@/lib/music/sections";
import { useApp } from "@/lib/store/appStore";
import type { LaunchMode } from "@/lib/store/types";
import { secVar, useCurrentSong } from "./useCurrentSong";

/** Section pads, like clips in a launcher: tap to loop, ＋ to add to the practice queue. */
export function Pads({ active }: { active: boolean }) {
  const { song, sections } = useCurrentSong();
  const loop = useApp((s) => s.player.loop);
  const pending = useApp((s) => s.player.pending);
  const current = useApp((s) => s.player.sectionIdx);
  const launch = useApp((s) => s.prefs.launch);
  const box = useRef<HTMLDivElement>(null);

  // progress bar along the bottom of the playing pad
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const t = player().time, s = sections[current];
      box.current?.querySelectorAll<HTMLElement>(".prog").forEach((el) => {
        el.style.width = s && Number(el.dataset.idx) === s.idx ? `${Math.min(100, ((t - s.start) / (s.end - s.start)) * 100)}%` : "0";
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, sections, current]);

  return (
    <div className="card">
      <div className="row between">
        <h3>Sections</h3>
        <div className="row">
          <label className="eyebrow" htmlFor="launch">Tapping a pad while playing</label>
          <select id="launch" value={launch} onChange={(e) => setPrefs({ launch: e.target.value as LaunchMode })}>
            <option value="now">Jumps now</option>
            <option value="end">Waits for end of section</option>
          </select>
        </div>
      </div>
      {!song ? (
        <p className="empty">Add a song and its sections appear here as pads.</p>
      ) : (
        <div className="pads" ref={box}>
          {sections.map((s) => {
            const looping = loop?.idx === s.idx, playing = current === s.idx, bars = barsFor(s.end - s.start, song.bpm);
            return (
              <div className="padwrap" key={`${s.idx}-${s.label}`}>
                <button
                  type="button"
                  className={`pad${looping ? " looping" : playing ? " playing" : ""}`}
                  style={{ "--c": secVar(typeOf(s.label)) } as React.CSSProperties}
                  aria-pressed={looping}
                  title={looping ? "Stop looping" : `Loop ${s.label}`}
                  onClick={() => player().launch(s)}
                >
                  <b>{s.label}</b>
                  <span className="mono">{formatTime(s.start)} · {bars ? `${bars} ${bars === 1 ? "bar" : "bars"}` : `${Math.round(s.end - s.start)}s`}</span>
                  <i className="prog" data-idx={s.idx} />
                  {looping ? <span className="tag">LOOP</span> : pending?.idx === s.idx ? <span className="tag next">NEXT</span> : null}
                </button>
                <button type="button" className="padadd" aria-label={`Add ${s.label} to queue`} title={`Add ${s.label} to queue`} onClick={() => addToQueue(song.id, s)}>＋</button>
              </div>
            );
          })}
        </div>
      )}
      <p className="note">Tap a pad to loop it. Tap again to stop looping. ＋ adds it to your queue.</p>
    </div>
  );
}
