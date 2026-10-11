"use client";
import { useMemo } from "react";
import { useApp } from "@/lib/store/appStore";
import { resolveSections } from "@/lib/music/sections";

/** The song in the player and its sections with end times. */
export function useCurrentSong() {
  const songId = useApp((s) => s.player.songId);
  const song = useApp((s) => s.songs.find((x) => x.id === songId));
  const sections = useMemo(() => (song ? resolveSections(song.sections, song.duration) : []), [song]);
  return { song, sections };
}

/** Section colour as a CSS variable reference. */
export const secVar = (type: string) => `var(--sec-${type})`;
