"use client";
import { useApp } from "@/lib/store/appStore";
import { FILE_INPUT_ID } from "../shell/fileInput";
import { StatusLine } from "../shell/StatusLine";
import { LyricsCard } from "./LyricsCard";
import { Pads } from "./Pads";
import { Tools } from "./Tools";
import { Transport } from "./Transport";
import { useCurrentSong } from "./useCurrentSong";
import { Waveform } from "./Waveform";

const SOURCE = { auto: "Auto-detected sections", arrangement: "Split by arrangement", edited: "Sections edited" } as const;

export function PracticeView({ hidden }: { hidden: boolean }) {
  const { song } = useCurrentSong();
  const queueIndex = useApp((s) => s.player.queueIndex);
  const queueLen = useApp((s) => s.queue.length);
  const active = !hidden;
  return (
    <section className="view" aria-label="Practice" hidden={hidden}>
      <div className="song-top">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{queueIndex !== null ? `Queue · ${queueIndex + 1} of ${queueLen}` : "Now practising"}</div>
          <h2>{song?.name ?? "No song loaded"}</h2>
          {song && (
            <div className="facts">
              {song.artist && <span className="chip">{song.artist}</span>}
              {song.key && <span className="chip">Key {song.key}</span>}
              {song.bpm && <span className="chip mono">{Math.round(song.bpm)} BPM</span>}
              <span className="chip">{SOURCE[song.source]}</span>
            </div>
          )}
        </div>
        <label className="btn" htmlFor={FILE_INPUT_ID}>Add songs</label>
      </div>
      <div className="stage">
        <Waveform active={active} />
        <Transport active={active} />
        <p className="hint">Tap the wave to jump · drag across it to loop any stretch · drag a section edge to move it</p>
      </div>
      <Pads active={active} />
      <Tools />
      <LyricsCard />
      <StatusLine />
    </section>
  );
}
