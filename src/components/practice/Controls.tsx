"use client";
import { useRef, useState } from "react";
import { player, setPrefs, updateSong } from "@/lib/actions";
import { useApp } from "@/lib/store/appStore";
import type { GapMode } from "@/lib/store/types";
import { useCurrentSong } from "./useCurrentSong";

const PRESETS = [50, 60, 70, 80, 90, 100];
const GAPS: [GapMode, string][] = [["none", "None"], ["p1", "1s"], ["p2", "2s"], ["c1", "1-bar"], ["c2", "2-bar"]];

export function Controls() {
  const { song } = useCurrentSong();
  const p = useApp((s) => s.player);
  const prefs = useApp((s) => s.prefs);
  const taps = useRef<number[]>([]);
  const [bpmNote, setBpmNote] = useState("Detected from the audio.");

  const tap = () => {
    if (!song) return;
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    const n = taps.current.length;
    if (n < 4) { setBpmNote(`Keep tapping on the beat… ${n}/4`); return; }
    const iv = taps.current.slice(1).map((t, i) => t - taps.current[i]!);
    const bpm = Math.round(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length) / (p.speed / 100));
    updateSong(song.id, { bpm, bpmSource: "tapped", barOffset: +(player().time % ((60 / bpm) * 4)).toFixed(3) });
    setBpmNote(`Tapped ${bpm} BPM.`);
  };

  return (
    <section className="panel" aria-label="Practice controls">
      <div className="panel-b">
        <div className="ctl">
          <div className="ctl-h"><label className="label" htmlFor="speed">Speed · same key</label><span className="speed-val">{p.speed}%</span></div>
          <div className="slider"><input id="speed" type="range" min={50} max={110} step={5} value={p.speed} onChange={(e) => player().setSpeed(Number(e.target.value))} /></div>
          <div className="seg grid" role="group" aria-label="Speed presets" style={{ "--cols": 6 } as React.CSSProperties}>
            {PRESETS.map((v) => <button key={v} type="button" aria-pressed={p.speed === v} onClick={() => player().setSpeed(v)}>{v}</button>)}
          </div>
        </div>

        <div className="ctl">
          <div className="ctl-h">
            <span className="label">Speed trainer</span>
            <button type="button" className="btn sm" aria-pressed={p.trainer} onClick={() => player().setTrainer(!p.trainer)}>{p.trainer ? "On" : "Off"}</button>
          </div>
          <div className="trio">
            <label>Start %<input id="trStart" type="number" min={50} max={110} step={5} value={prefs.trainerStart} onChange={(e) => setPrefs({ trainerStart: clamp(+e.target.value, 50, 110) })} /></label>
            <label>Faster by %<input id="trStep" type="number" min={1} max={20} value={prefs.trainerStep} onChange={(e) => setPrefs({ trainerStep: clamp(+e.target.value, 1, 20) })} /></label>
            <label>Up to %<input id="trTarget" type="number" min={50} max={110} step={5} value={prefs.trainerTarget} onChange={(e) => setPrefs({ trainerTarget: clamp(+e.target.value, 50, 110) })} /></label>
          </div>
          <p className="note">Each loop plays a little faster until you reach your target.</p>
        </div>

        <div className="ctl">
          <div className="ctl-h"><span className="label">Before each repeat</span><span className="note mono">{p.loop ? `${p.reps}${p.repTarget ? ` of ${p.repTarget}` : ""} done` : ""}</span></div>
          <div className="seg grid" role="group" aria-label="Pause" style={{ "--cols": 3 } as React.CSSProperties}>
            {GAPS.slice(0, 3).map(([v, l]) => <button key={v} type="button" aria-pressed={prefs.gap === v} onClick={() => setPrefs({ gap: v })}>{v === "none" ? "No pause" : `${l} pause`}</button>)}
          </div>
          <div className="seg grid" role="group" aria-label="Count-in" style={{ "--cols": 2 } as React.CSSProperties}>
            {GAPS.slice(3).map(([v, l]) => <button key={v} type="button" aria-pressed={prefs.gap === v} onClick={() => setPrefs({ gap: v })}>{l} count-in</button>)}
          </div>
        </div>

        <div className="ctl">
          <div className="ctl-h"><label className="label" htmlFor="bpm">Tempo</label><span className="note">{bpmNote}</span></div>
          <div className="row">
            <input id="bpm" type="number" min={40} max={240} step={0.01} disabled={!song} key={`${song?.id}-${song?.bpm}`} defaultValue={song?.bpm ?? ""} aria-label="Beats per minute" style={{ width: 96 }}
              onBlur={(e) => { if (!song) return; const v = +e.target.value; if (v !== song.bpm) { updateSong(song.id, { bpm: v >= 40 && v <= 240 ? v : null, bpmSource: "manual" }); setBpmNote("Set by hand."); } }} />
            <span className="muted">BPM</span>
            <button type="button" className="btn sm" disabled={!song} onClick={tap}>Tap tempo</button>
          </div>
        </div>
      </div>
    </section>
  );
}

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);
