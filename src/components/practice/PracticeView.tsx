"use client";
import { setView } from "@/lib/actions";
import { describeLength } from "@/lib/music/grid";
import { useApp } from "@/lib/store/appStore";
import { AddSongsButton } from "../shell/AddSongsButton";
import { Arranger } from "./Arranger";
import { Controls } from "./Controls";
import { LyricsCard } from "./LyricsCard";
import { Pads } from "./Pads";
import { SavedLoops } from "./SavedLoops";
import { useCurrentSong } from "./useCurrentSong";

const SOURCE = { auto: "Auto-detected", arrangement: "From arrangement", edited: "Edited" } as const;

export function PracticeView({ hidden }: { hidden: boolean }) {
  const { song, sections } = useCurrentSong();
  const queueIndex = useApp((s) => s.player.queueIndex);
  const queueLen = useApp((s) => s.queue.length);
  const loop = useApp((s) => s.player.loop);
  const active = !hidden;
  return (
    <section className="view" aria-label="Practice" hidden={hidden}>
      <div className="songhead">
        <div style={{ minWidth: 0 }}>
          <div className="label">{queueIndex !== null ? `Queue · ${queueIndex + 1} of ${queueLen}` : "Now practising"}</div>
          <h1>{song?.name ?? "No song loaded"}</h1>
          {song && (
            <div className="meta">
              {song.key && <span className="chip">Key {song.key}</span>}
              {song.bpm && <span className="chip mono">{Number.isInteger(song.bpm) ? song.bpm : song.bpm.toFixed(1)} BPM</span>}
              {song.bpm && <span className="chip mono">4/4</span>}
              <span className="chip">{sections.length} sections · {SOURCE[song.source]}</span>
              {loop && <span className="chip cycle">Loop {describeLength(loop.end - loop.start, { bpm: song.bpm, barOffset: song.barOffset })}</span>}
            </div>
          )}
        </div>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => setView("queue")}>Queue{queueLen ? ` · ${queueLen}` : ""}</button>
          <AddSongsButton />
        </div>
      </div>
      <Arranger active={active} />
      {song && (
        <div className="practice-grid">
          <div>
            <Pads active={active} />
            <SavedLoops />
            <LyricsCard />
          </div>
          <div>
            <Controls />
          </div>
        </div>
      )}
    </section>
  );
}
