"use client";
import { useEffect, useRef } from "react";
import { player } from "@/lib/actions";
import { formatTime } from "@/lib/music/sections";
import { useApp } from "@/lib/store/appStore";
import { IconLoop, IconNext, IconPause, IconPlay, IconPrev } from "../shell/icons";
import { useCurrentSong } from "./useCurrentSong";

export function Transport({ active }: { active: boolean }) {
  const { song } = useCurrentSong();
  const p = useApp((s) => s.player);
  const clock = useRef<HTMLDivElement>(null);
  const sub = useRef<HTMLDivElement>(null);
  const playing = p.playing || p.waiting;

  useEffect(() => {
    if (!active || !song) return;
    let raf = 0;
    const tick = () => {
      const t = player().time;
      if (clock.current) clock.current.textContent = formatTime(t, true);
      if (sub.current) sub.current.textContent = `/ ${formatTime(song.duration)}${song.bpm ? ` · bar ${Math.floor((Math.max(0, t - song.barOffset) * song.bpm) / 240) + 1}` : ""}`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, song]);

  const chip = p.waiting ? "Get ready…" : p.loop ? `Looping ${p.loop.label}` : p.pending ? `Next: ${p.pending.label}` : "Not looping";
  return (
    <div className="transport">
      <button type="button" className="iconbtn" disabled={!song} aria-label="Previous section" title="Previous section (←)" onClick={() => player().step(-1)}><IconPrev /></button>
      <button type="button" className="playbtn" disabled={!song} aria-label={playing ? "Pause" : "Play"} title="Play / pause (space)" onClick={() => player().toggle()}>
        {playing ? <IconPause /> : <IconPlay />}
      </button>
      <button type="button" className="iconbtn" disabled={!song} aria-label="Next section" title="Next section (→)" onClick={() => player().step(1)}><IconNext /></button>
      <button type="button" className="iconbtn" disabled={!song} aria-pressed={!!p.loop} aria-label="Loop current section" title="Loop current section (L)" onClick={() => player().loopCurrent()}><IconLoop /></button>
      <span className={`chip${p.loop ? " live" : ""}`}>{chip}</span>
      <div className="clock">
        <div className="t mono" ref={clock}>0:00.0</div>
        <div className="s mono" ref={sub}>/ 0:00</div>
      </div>
    </div>
  );
}
