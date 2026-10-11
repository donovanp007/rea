"use client";
import { useEffect, useRef } from "react";
import { moveSectionStart, player } from "@/lib/actions";
import { formatTime, shortLabel, typeOf } from "@/lib/music/sections";
import { store, useApp } from "@/lib/store/appStore";
import { useCurrentSong } from "./useCurrentSong";

type Drag = { kind: "edge"; i: number; t: number } | { kind: "range"; t0: number; t1: number; x0: number; moved: boolean };

/**
 * Waveform with the section strip above it, bar lines, the loop region and the playhead.
 * Tap to jump, drag across to loop any stretch, drag a section edge to move it.
 */
export function Waveform({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { song, sections } = useCurrentSong();
  const loop = useApp((s) => s.player.loop);
  const drag = useRef<Drag | null>(null);
  const hoverEdge = useRef(-1);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = ref.current;
      if (!cv) return;
      const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
      if (!w) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const g = cv.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const css = getComputedStyle(document.documentElement), tok = (n: string) => css.getPropertyValue(n).trim();
      if (!song) {
        g.fillStyle = tok("--muted");
        g.font = `15px ${tok("--font-body")}`;
        g.fillText("Add a song to see its sections", 16, h / 2);
        return;
      }
      const D = song.duration, X = (t: number) => (t / D) * w, strip = 24, mid = strip + (h - strip) / 2, amp = (h - strip) / 2 - 8;
      const cur = player().time, accent = tok("--accent"), dim = tok("--wave-dim"), d = drag.current;
      const secs = d?.kind === "edge" ? sections.map((s, i) => (i === d.i ? { ...s, start: d.t } : i === d.i - 1 ? { ...s, end: d.t } : s)) : sections;
      if (song.bpm) {
        const bar = 240 / song.bpm;
        g.fillStyle = tok("--line");
        for (let t = song.barOffset; t < D; t += bar) g.fillRect(Math.round(X(t)), strip, 1, h - strip);
      }
      const lp = store.state.player.loop;
      if (lp) { g.fillStyle = accent; g.globalAlpha = 0.18; g.fillRect(X(lp.start), strip, X(lp.end) - X(lp.start), h - strip); g.globalAlpha = 1; }
      const P = song.peaks.length;
      let pm = 0;
      for (const p of song.peaks) pm = Math.max(pm, p);
      pm ||= 1;
      for (const s of secs) {
        const col = tok(`--sec-${typeOf(s.label)}`), x0 = X(s.start), x1 = X(s.end);
        g.fillStyle = col;
        g.fillRect(x0, 0, Math.max(1, x1 - x0 - 1), strip);
        g.fillStyle = "#fff";
        g.font = `700 11px ${tok("--font-body")}`;
        g.save(); g.beginPath(); g.rect(x0, 0, x1 - x0 - 3, strip); g.clip();
        g.fillText(x1 - x0 > 54 ? s.label : shortLabel(s.label), x0 + 6, 16);
        g.restore();
        g.fillStyle = !lp || (s.end > lp.start && s.start < lp.end) ? col : dim;
        const p0 = Math.floor((s.start / D) * P), p1 = Math.ceil((s.end / D) * P), bw = Math.max(1, w / P);
        for (let p = p0; p < p1 && p < P; p++) { const a = (song.peaks[p]! / pm) * amp; g.fillRect((p / P) * w, mid - a, bw, Math.max(1, a * 2)); }
      }
      g.fillStyle = tok("--sunk"); g.globalAlpha = 0.45; g.fillRect(0, strip, X(cur), h - strip); g.globalAlpha = 1;
      secs.forEach((s, i) => {
        if (!i) return;
        g.fillStyle = tok("--ink");
        g.globalAlpha = hoverEdge.current === i || (d?.kind === "edge" && d.i === i) ? 0.95 : 0.4;
        g.fillRect(X(s.start) - 1, strip, 2, h - strip);
        g.globalAlpha = 1;
      });
      if (d?.kind === "range" && d.moved) {
        const a = Math.min(d.t0, d.t1), b = Math.max(d.t0, d.t1);
        g.strokeStyle = accent; g.lineWidth = 2; g.strokeRect(X(a), strip + 1, X(b) - X(a), h - strip - 2);
      }
      g.fillStyle = accent;
      g.fillRect(X(cur) - 1, 0, 2.5, h);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [active, song, sections, loop]);

  const tAt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (song?.duration ?? 0);
  };
  const edgeNear = (e: React.PointerEvent) => {
    if (!song) return -1;
    const r = ref.current!.getBoundingClientRect(), px = e.clientX - r.left;
    for (let i = 1; i < sections.length; i++) if (Math.abs((sections[i]!.start / song.duration) * r.width - px) < 10) return i;
    return -1;
  };

  return (
    <div className="wave-box">
      <canvas
        ref={ref}
        role="img"
        aria-label={song ? `Waveform of ${song.name}: ${sections.map((s) => `${s.label} at ${formatTime(s.start)}`).join(", ")}` : "No song loaded"}
        onPointerDown={(e) => {
          if (!song) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const i = edgeNear(e);
          drag.current = i > 0 ? { kind: "edge", i, t: sections[i]!.start } : { kind: "range", t0: tAt(e), t1: tAt(e), x0: e.clientX, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) { hoverEdge.current = edgeNear(e); e.currentTarget.style.cursor = hoverEdge.current > 0 ? "ew-resize" : "pointer"; return; }
          if (d.kind === "edge") {
            const lo = sections[d.i - 1]!.start + 1, hi = (sections[d.i + 1]?.start ?? song!.duration) - 1;
            d.t = Math.min(hi, Math.max(lo, tAt(e)));
          } else {
            d.t1 = tAt(e);
            if (Math.abs(e.clientX - d.x0) > 8) d.moved = true;
          }
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (!d || !song) return;
          if (d.kind === "edge") { moveSectionStart(song.id, d.i, d.t); return; }
          if (d.moved) {
            const a = Math.min(d.t0, d.t1), b = Math.max(d.t0, d.t1);
            if (b - a > 0.5) { player().setLoop({ start: a, end: b, label: `Custom ${formatTime(a)}–${formatTime(b)}`, idx: null }); void player().play(); }
          } else player().seek(d.t0);
        }}
        onPointerLeave={() => { if (!drag.current) hoverEdge.current = -1; }}
      />
    </div>
  );
}
