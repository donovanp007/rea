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

  if (!song) return null;
  return (
    <section className="panel" aria-label="Sections">
      <div className="panel-h">
        <h3>Sections</h3>
        <div className="seg" role="group" aria-label="When you tap a pad while playing">
          {(["now", "end"] as LaunchMode[]).map((m) => (
            <button key={m} type="button" aria-pressed={launch === m} onClick={() => setPrefs({ launch: m })} title={m === "now" ? "Jump straight to the section" : "Start it when the current section ends"}>
              {m === "now" ? "Jump now" : "At section end"}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-b">
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
                  <span><em className="at">{formatTime(s.start)} · </em>{bars ? `${bars} bar${bars === 1 ? "" : "s"}` : `${Math.round(s.end - s.start)}s`}</span>
                  <i className="prog" data-idx={s.idx} />
                  {looping ? <span className="tag">LOOP</span> : pending?.idx === s.idx ? <span className="tag next">NEXT</span> : null}
                </button>
                <button type="button" className="padadd" aria-label={`Add ${s.label} to queue`} title={`Add ${s.label} to queue`} onClick={() => addToQueue(song.id, s)}>+</button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
