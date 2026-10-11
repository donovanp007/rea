"use client";
import { useRef, useState } from "react";
import { player, setPrefs, updateSong } from "@/lib/actions";
import { useApp } from "@/lib/store/appStore";
import type { GapMode } from "@/lib/store/types";
import { useCurrentSong } from "./useCurrentSong";

const PRESETS = [60, 70, 80, 90, 100];

export function Tools() {
  const { song } = useCurrentSong();
  const p = useApp((s) => s.player);
  const prefs = useApp((s) => s.prefs);
  const taps = useRef<number[]>([]);
  const [bpmNote, setBpmNote] = useState("Detected from the audio. Tap along to correct it.");

  const tap = () => {
    if (!song) return;
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    const n = taps.current.length;
    if (n < 4) { setBpmNote(`Keep tapping on the beat… (${n})`); return; }
    const iv = taps.current.slice(1).map((t, i) => t - taps.current[i]!);
    const bpm = Math.round(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length) / (p.speed / 100));
    // the last tap marks a beat; take it as a downbeat
    const beat = 60 / bpm;
    updateSong(song.id, { bpm, bpmSource: "tapped", barOffset: +(player().time % (beat * 4)).toFixed(3) });
    setBpmNote(`Tapped ${bpm} BPM. Keep tapping to refine it.`);
  };

  const repText = p.loop ? `${p.reps}${p.repTarget ? ` of ${p.repTarget}` : ""} repeats done${p.trainer ? ` · now ${p.speed}%` : ""}` : "Not looping";

  return (
    <div className="card tools">
      <div className="tool">
        <label className="eyebrow" htmlFor="speed">Speed · key stays the same</label>
        <div className="slider">
          <input id="speed" type="range" min={50} max={110} step={5} value={p.speed} onChange={(e) => player().setSpeed(Number(e.target.value))} />
          <span className="mono">{p.speed}%</span>
        </div>
        <div className="presets">
          {PRESETS.map((v) => (
            <button key={v} type="button" className="btn sm" aria-pressed={p.speed === v} onClick={() => player().setSpeed(v)}>{v}%</button>
          ))}
        </div>
      </div>

      <div className="tool">
        <span className="eyebrow">Speed trainer</span>
        <div className="trainer">
          <button type="button" className="btn sm" aria-pressed={p.trainer} onClick={() => player().setTrainer(!p.trainer)}>{p.trainer ? "On" : "Off"}</button>
          <span>Start</span>
          <input id="trStart" type="number" min={50} max={110} step={5} value={prefs.trainerStart} aria-label="Start speed %" onChange={(e) => setPrefs({ trainerStart: clamp(+e.target.value, 50, 110) })} />
          <span>+</span>
          <input id="trStep" type="number" min={1} max={20} value={prefs.trainerStep} aria-label="Increase per repeat %" onChange={(e) => setPrefs({ trainerStep: clamp(+e.target.value, 1, 20) })} />
          <span>to</span>
          <input id="trTarget" type="number" min={50} max={110} step={5} value={prefs.trainerTarget} aria-label="Target speed %" onChange={(e) => setPrefs({ trainerTarget: clamp(+e.target.value, 50, 110) })} />
          <span>%</span>
        </div>
        <p className="note">Each loop gets a little faster until you reach the target.</p>
      </div>

      <div className="tool">
        <label className="eyebrow" htmlFor="gap">Before each repeat</label>
        <select id="gap" value={prefs.gap} onChange={(e) => setPrefs({ gap: e.target.value as GapMode })}>
          <option value="none">Go straight back</option>
          <option value="p1">1 second pause</option>
          <option value="p2">2 second pause</option>
          <option value="c1">1 bar count-in</option>
          <option value="c2">2 bar count-in</option>
        </select>
        <div className="mono" aria-live="polite">{repText}</div>
      </div>

      <div className="tool">
        <label className="eyebrow" htmlFor="bpm">Tempo</label>
        <div className="row bpm-row">
          <input
            id="bpm"
            type="number"
            min={40}
            max={240}
            disabled={!song}
            key={`${song?.id}-${song?.bpm}`}
            defaultValue={song?.bpm ? Math.round(song.bpm * 10) / 10 : ""}
            aria-label="Beats per minute"
            onBlur={(e) => { if (!song) return; const v = +e.target.value; updateSong(song.id, { bpm: v >= 40 && v <= 240 ? v : null, bpmSource: "manual" }); setBpmNote("Set by hand."); }}
          />
          <span>BPM</span>
          <button type="button" className="btn sm" disabled={!song} onClick={tap}>Tap tempo</button>
        </div>
        <p className="note">{bpmNote}</p>
      </div>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);
