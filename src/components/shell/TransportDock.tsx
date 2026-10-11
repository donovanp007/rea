"use client";
import { useEffect, useRef } from "react";
import { player, setView } from "@/lib/actions";
import { barBeatAt } from "@/lib/music/grid";
import { formatTime, resolveSections, typeOf } from "@/lib/music/sections";
import { useApp } from "@/lib/store/appStore";
import { IconLoop, IconNext, IconPause, IconPlay, IconPrev } from "./icons";

/** The transport, docked at the bottom of every screen like a DAW. */
export function TransportDock() {
  const songId = useApp((s) => s.player.songId);
  const song = useApp((s) => s.songs.find((x) => x.id === songId));
  const p = useApp((s) => s.player);
  const time = useRef<HTMLDivElement>(null);
  const pos = useRef<HTMLDivElement>(null);
  const playing = p.playing || p.waiting;

  useEffect(() => {
    if (!song) return;
    let raf = 0;
    const tick = () => {
      const t = player().time;
      if (time.current) time.current.textContent = formatTime(t, true);
      if (pos.current) {
        const bb = barBeatAt(t, { bpm: song.bpm, barOffset: song.barOffset });
        pos.current.textContent = `${bb ? `Bar ${Math.max(1, bb.bar)}.${bb.beat} · ` : ""}${formatTime(song.duration)}`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [song]);

  const sec = song ? resolveSections(song.sections, song.duration)[p.sectionIdx] : undefined;
  const where = p.waiting ? "Get ready…" : p.loop ? `Looping ${p.loop.label}` : p.pending ? `Next: ${p.pending.label}` : sec?.label ?? "";
  const reps = p.loop && p.reps > 0 ? ` · ${p.reps}${p.repTarget ? `/${p.repTarget}` : "×"}` : "";
  return (
    <div className="dock" role="region" aria-label="Transport">
      <div className="now">
        <button type="button" onClick={() => setView("practice")} disabled={!song} style={{ minWidth: 0 }}>
          <b>{song?.name ?? "No song loaded"}</b>
          <small>
            {(p.loop || sec) && <span className="dot" style={{ "--c": p.loop ? "var(--cycle)" : `var(--sec-${typeOf(sec?.label ?? "")})` } as React.CSSProperties} />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{where}{reps}</span>
          </small>
        </button>
      </div>
      <div className="center">
        <button type="button" className="tbtn hide-sm" disabled={!song} aria-label="Previous section" title="Previous section (←)" onClick={() => player().step(-1)}><IconPrev /></button>
        <button type="button" className="playbtn" disabled={!song} aria-label={playing ? "Pause" : "Play"} title="Play / pause (space)" onClick={() => player().toggle()}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button type="button" className="tbtn hide-sm" disabled={!song} aria-label="Next section" title="Next section (→)" onClick={() => player().step(1)}><IconNext /></button>
        <button type="button" className="tbtn" disabled={!song} aria-pressed={!!p.loop} aria-label="Loop current section" title="Loop current section (L)" onClick={() => player().loopCurrent()}><IconLoop /></button>
      </div>
      <div className="right">
        <span className="speedpill" title="Playback speed">{p.speed}%</span>
        <div className="time">
          <div className="t" ref={time}>0:00.0</div>
          <div className="s" ref={pos}>—</div>
        </div>
      </div>
    </div>
  );
}
