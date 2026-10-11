"use client";
import { useEffect, useState } from "react";
import { player, setView } from "@/lib/actions";
import { useApp } from "@/lib/store/appStore";
import { formatTime, resolveSections } from "@/lib/music/sections";
import { IconPause, IconPlay } from "./icons";

/** Shown on Sets, Songs and Queue so playback stays in reach. */
export function MiniPlayer() {
  const view = useApp((s) => s.view);
  const songId = useApp((s) => s.player.songId);
  const song = useApp((s) => s.songs.find((x) => x.id === songId));
  const playing = useApp((s) => s.player.playing || s.player.waiting);
  const loop = useApp((s) => s.player.loop);
  const idx = useApp((s) => s.player.sectionIdx);
  const [time, setTime] = useState(0);
  const show = view !== "practice" && !!song;
  useEffect(() => {
    if (!show) return;
    setTime(player().time);
    const id = setInterval(() => setTime(player().time), 400);
    return () => clearInterval(id);
  }, [show]);
  if (!show) return null;
  const sec = loop?.label ?? resolveSections(song.sections, song.duration)[idx]?.label ?? "";
  return (
    <div className="mini">
      <button type="button" className="playbtn" aria-label={playing ? "Pause" : "Play"} onClick={() => player().toggle()}>
        {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
      </button>
      <button type="button" className="info" onClick={() => setView("practice")}>
        <b>{song.name}</b>
        <span className="mono">{loop ? "Looping " : ""}{sec} · {formatTime(time)}</span>
      </button>
    </div>
  );
}
