"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loopRange, moveSectionStart, player, saveCurrentLoop, setMarker, setPrefs } from "@/lib/actions";
import { snapTime } from "@/lib/music/grid";
import { formatTime, shortLabel, typeOf, type ResolvedSection } from "@/lib/music/sections";
import { store, useApp } from "@/lib/store/appStore";
import type { SnapMode, Song } from "@/lib/store/types";
import { IconFit, IconFlag, IconFollow, IconSave, IconX, IconZoomIn, IconZoomOut } from "../shell/icons";
import { useCurrentSong } from "./useCurrentSong";

// vertical layout of the main canvas, in CSS pixels
const RULER = 22, LANE_Y = 26, LANE_H = 28, WAVE_Y = 62;
const MIN_WINDOW = 1.5; // seconds visible at maximum zoom

type Drag =
  | { kind: "range"; t0: number; t1: number; x0: number; moved: boolean }
  | { kind: "handle"; which: "a" | "b"; t: number }
  | { kind: "edge"; i: number; t: number }
  | { kind: "lane"; t: number; x0: number; moved: boolean }
  | { kind: "pinch" };

interface View { start: number; end: number }

/**
 * The arrangement view: bar ruler with the loop (cycle) bar, the section lane, the waveform and
 * an overview strip. Zoom in to set loop markers around a single fill.
 */
export function Arranger({ active }: { active: boolean }) {
  const { song, sections } = useCurrentSong();
  const snap = useApp((s) => s.prefs.snap);
  const loop = useApp((s) => s.player.loop);
  const markA = useApp((s) => s.player.markA);
  const main = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ start: 0, end: 1 });
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; view: View; mid: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [follow, setFollow] = useState(true);
  const followRef = useRef(follow);
  followRef.current = follow;

  // reset the view when the song changes
  useEffect(() => {
    if (!song) return;
    view.current = { start: 0, end: song.duration };
    setZoom(1);
  }, [song?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setView = useCallback((start: number, end: number) => {
    if (!song) return;
    const len = Math.max(MIN_WINDOW, Math.min(song.duration, end - start));
    let s = Math.max(0, Math.min(start, song.duration - len));
    if (!Number.isFinite(s)) s = 0;
    view.current = { start: s, end: s + len };
    setZoom(Math.round((song.duration / len) * 10) / 10);
  }, [song]);

  const zoomBy = useCallback((factor: number, center?: number) => {
    const v = view.current, len = v.end - v.start;
    const c = center ?? (player().time >= v.start && player().time <= v.end ? player().time : (v.start + v.end) / 2);
    const nl = len / factor, ratio = (c - v.start) / len;
    setView(c - ratio * nl, c - ratio * nl + nl);
  }, [setView]);

  const zoomToLoop = useCallback(() => {
    const l = store.state.player.loop;
    if (!l || !song) return setView(0, song?.duration ?? 1);
    const pad = (l.end - l.start) * 0.25;
    setView(l.start - pad, l.end + pad);
  }, [setView, song]);

  // drawing
  useEffect(() => {
    if (!active || !song) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const t = player().time;
      const v = view.current;
      // keep the playhead in view while playing
      if (followRef.current && !drag.current && store.state.player.playing && v.end - v.start < song.duration - 0.01) {
        const len = v.end - v.start;
        if (t > v.end - len * 0.05 || t < v.start) setView(t - len * 0.1, t - len * 0.1 + len);
      }
      paintMain(main.current, song, sections, view.current, t, drag.current);
      paintOverview(over.current, song, sections, view.current, t);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [active, song, sections, loop, setView]);

  // trackpad pinch / ctrl+wheel zoom and horizontal pan (needs a non-passive listener)
  useEffect(() => {
    const cv = main.current;
    if (!cv || !song) return;
    const onWheel = (e: WheelEvent) => {
      const v = view.current, len = v.end - v.start;
      const r = cv.getBoundingClientRect();
      const t = v.start + ((e.clientX - r.left) / r.width) * len;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomBy(Math.exp(-e.deltaY * 0.01), t);
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        if (len >= song.duration - 0.01) return;
        e.preventDefault();
        const dx = (e.shiftKey ? e.deltaY : e.deltaX) / r.width * len;
        setView(v.start + dx, v.end + dx);
      }
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [song, zoomBy, setView]);

  if (!song) {
    return (
      <div className="panel arranger">
        <p className="empty" style={{ margin: 16 }}>Add a song to see its arrangement.</p>
      </div>
    );
  }

  const tAt = (clientX: number) => {
    const r = main.current!.getBoundingClientRect(), v = view.current;
    return Math.max(0, Math.min(song.duration, v.start + ((clientX - r.left) / r.width) * (v.end - v.start)));
  };
  const xOf = (t: number) => {
    const r = main.current!.getBoundingClientRect(), v = view.current;
    return ((t - v.start) / (v.end - v.start)) * r.width;
  };
  const grid = { bpm: song.bpm, barOffset: song.barOffset };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = e.currentTarget;
    cv.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const a = pts[0]!, b = pts[1]!;
      pinch.current = { d: Math.abs(a.x - b.x) || 1, view: { ...view.current }, mid: tAt((a.x + b.x) / 2) };
      drag.current = { kind: "pinch" };
      return;
    }
    const r = cv.getBoundingClientRect(), y = e.clientY - r.top, px = e.clientX - r.left;
    const l = store.state.player.loop;
    if (l && (Math.abs(xOf(l.start) - px) < 12 || Math.abs(xOf(l.end) - px) < 12) && y >= 0) {
      const which = Math.abs(xOf(l.start) - px) <= Math.abs(xOf(l.end) - px) ? "a" : "b";
      drag.current = { kind: "handle", which, t: which === "a" ? l.start : l.end };
      return;
    }
    if (y >= LANE_Y - 2 && y <= LANE_Y + LANE_H + 2) {
      for (let i = 1; i < sections.length; i++) if (Math.abs(xOf(sections[i]!.start) - px) < 9) { drag.current = { kind: "edge", i, t: sections[i]!.start }; return; }
      drag.current = { kind: "lane", t: tAt(e.clientX), x0: e.clientX, moved: false };
      return;
    }
    const t = tAt(e.clientX);
    drag.current = { kind: "range", t0: t, t1: t, x0: e.clientX, moved: false };
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    const cv = e.currentTarget;
    if (!d) {
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, y = e.clientY - r.top, l = store.state.player.loop;
      const nearHandle = l && (Math.abs(xOf(l.start) - px) < 12 || Math.abs(xOf(l.end) - px) < 12);
      const nearEdge = y >= LANE_Y && y <= LANE_Y + LANE_H && sections.some((s, i) => i > 0 && Math.abs(xOf(s.start) - px) < 9);
      cv.style.cursor = nearHandle || nearEdge ? "ew-resize" : y >= LANE_Y && y <= LANE_Y + LANE_H ? "pointer" : "crosshair";
      return;
    }
    if (d.kind === "pinch") {
      const pts = [...pointers.current.values()];
      if (pts.length < 2 || !pinch.current) return;
      const dist = Math.abs(pts[0]!.x - pts[1]!.x) || 1, p = pinch.current;
      const len = (p.view.end - p.view.start) * (p.d / dist), ratio = (p.mid - p.view.start) / (p.view.end - p.view.start);
      setView(p.mid - ratio * len, p.mid - ratio * len + len);
      return;
    }
    const t = tAt(e.clientX);
    if (d.kind === "handle") {
      const l = store.state.player.loop!;
      const st = snapTime(t, grid, snap);
      d.t = d.which === "a" ? Math.min(st, l.end - 0.1) : Math.max(st, l.start + 0.1);
    } else if (d.kind === "edge") {
      const lo = sections[d.i - 1]!.start + 0.5, hi = (sections[d.i + 1]?.start ?? song.duration) - 0.5;
      d.t = Math.min(hi, Math.max(lo, snapTime(t, grid, snap === "off" ? "off" : "beat")));
    } else if (d.kind === "range") {
      d.t1 = t;
      if (Math.abs(e.clientX - d.x0) > 6) d.moved = true;
    } else if (d.kind === "lane") {
      if (Math.abs(e.clientX - d.x0) > 6) d.moved = true;
    }
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d?.kind === "pinch") { if (pointers.current.size === 0) { drag.current = null; pinch.current = null; } return; }
    drag.current = null;
    if (!d) return;
    if (d.kind === "handle") {
      const l = store.state.player.loop;
      if (l) loopRange(d.which === "a" ? d.t : l.start, d.which === "b" ? d.t : l.end);
    } else if (d.kind === "edge") {
      moveSectionStart(song.id, d.i, d.t);
    } else if (d.kind === "lane") {
      if (!d.moved) {
        const s = sections.find((x) => d.t >= x.start && d.t < x.end);
        if (s) player().launch(s);
      }
    } else if (d.kind === "range") {
      if (d.moved) { loopRange(d.t0, d.t1); void player().play(); }
      else player().seek(d.t0);
    }
  };

  const overDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = e.currentTarget;
    cv.setPointerCapture(e.pointerId);
    const pan = (clientX: number) => {
      const r = cv.getBoundingClientRect(), v = view.current, len = v.end - v.start;
      const c = ((clientX - r.left) / r.width) * song.duration;
      setView(c - len / 2, c + len / 2);
    };
    pan(e.clientX);
    const move = (ev: PointerEvent) => pan(ev.clientX);
    const up = () => { cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); };
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
  };

  const zoomed = zoom > 1.01;
  return (
    <div className="panel arranger">
      <div className="arr-tools" role="toolbar" aria-label="Arrangement tools">
        <button type="button" className="btn sm icon ghost" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(0.5)} disabled={!zoomed}><IconZoomOut /></button>
        <span className="zoom mono" aria-live="polite">{zoom < 10 ? zoom.toFixed(1) : Math.round(zoom)}×</span>
        <button type="button" className="btn sm icon ghost" aria-label="Zoom in" title="Zoom in (pinch or Ctrl + scroll)" onClick={() => zoomBy(2)}><IconZoomIn /></button>
        <button type="button" className="btn sm ghost" title="Show the whole song" onClick={() => setView(0, song.duration)} disabled={!zoomed}><IconFit /> Fit</button>
        <button type="button" className="btn sm ghost" title="Zoom to the loop" onClick={zoomToLoop} disabled={!loop}>To loop</button>
        <span className="sep" aria-hidden />
        <span className="label">Snap</span>
        <div className="seg" role="group" aria-label="Snap markers to">
          {(["bar", "beat", "off"] as SnapMode[]).map((m) => (
            <button key={m} type="button" aria-pressed={snap === m} onClick={() => setPrefs({ snap: m })}>{m === "off" ? "Off" : m === "bar" ? "Bar" : "Beat"}</button>
          ))}
        </div>
        <span className="sep" aria-hidden />
        <button type="button" className="btn sm" aria-pressed={markA !== null} title="Mark the loop start (A) at the playhead" onClick={() => setMarker("a", player().time)}><IconFlag /> Set A</button>
        <button type="button" className="btn sm" title="Put the loop end (B) at the playhead" onClick={() => setMarker("b", player().time)}><IconFlag /> Set B</button>
        <button type="button" className="btn sm" disabled={!loop} title="Keep this loop for this song" onClick={() => saveCurrentLoop()}><IconSave /> Save loop</button>
        <button type="button" className="btn sm icon ghost" disabled={!loop && markA === null} aria-label="Clear loop" title="Clear loop" onClick={() => { player().setLoop(null); store.setPlayer({ markA: null }); }}><IconX /></button>
        <button type="button" className="btn sm ghost push" aria-pressed={follow} title="Keep the playhead in view when zoomed in" onClick={() => setFollow(!follow)}><IconFollow /> Follow</button>
      </div>
      <div className="arr-canvas">
        <canvas
          ref={main}
          className="main"
          role="img"
          aria-label={`Arrangement of ${song.name}: ${sections.map((s) => `${s.label} at ${formatTime(s.start)}`).join(", ")}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onDoubleClick={(e) => zoomBy(2, tAt(e.clientX))}
        />
        <canvas ref={over} className="over" aria-label="Song overview: drag to move around when zoomed in" onPointerDown={overDown} onDoubleClick={() => setView(0, song.duration)} />
      </div>
      <div className="arr-hint">
        <span className="long">Drag across the waveform to make a loop · drag the yellow A/B flags to fine-tune it · tap a section to loop it · drag a section edge to move it · pinch or double-click to zoom</span>
        <span className="short">Drag to loop · drag the A/B flags · tap a section · pinch to zoom</span>
      </div>
    </div>
  );
}

/* ---------------- painting ---------------- */

function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const t = (n: string) => cs.getPropertyValue(n).trim();
  return { t, font: t("--font"), mono: t("--mono"), cycle: t("--cycle"), play: t("--play"), text: t("--text"), text2: t("--text-2"), text3: t("--text-3"), line: t("--line"), panel2: t("--panel-2"), bg: t("--bg") };
}

function fit(cv: HTMLCanvasElement | null) {
  if (!cv) return null;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return null;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function paintMain(cv: HTMLCanvasElement | null, song: Song, sections: ResolvedSection[], v: View, now: number, d: Drag | null) {
  const c = fit(cv);
  if (!c) return;
  const { g, w, h } = c, k = tokens();
  const len = v.end - v.start, X = (t: number) => ((t - v.start) / len) * w;
  const secColor = (label: string) => k.t(`--sec-${typeOf(label)}`);
  const loop = store.state.player.loop;
  // live previews while dragging
  let ls = loop?.start, le = loop?.end;
  if (d?.kind === "handle" && loop) { if (d.which === "a") ls = d.t; else le = d.t; }
  if (d?.kind === "range" && d.moved) { ls = Math.min(d.t0, d.t1); le = Math.max(d.t0, d.t1); }
  const secs = d?.kind === "edge" ? sections.map((s, i) => (i === d.i ? { ...s, start: d.t } : i === d.i - 1 ? { ...s, end: d.t } : s)) : sections;

  // ruler: bars (or seconds without a tempo)
  g.fillStyle = k.panel2;
  g.fillRect(0, 0, w, RULER);
  g.font = `500 10.5px ${k.mono}`;
  g.textBaseline = "middle";
  if (song.bpm) {
    const bar = 240 / song.bpm, beat = bar / 4, pxBar = (bar / len) * w;
    const every = pxBar >= 34 ? 1 : pxBar >= 17 ? 2 : pxBar >= 8 ? 4 : pxBar >= 4 ? 8 : 16;
    const first = Math.max(0, Math.floor((v.start - song.barOffset) / bar));
    for (let b = first; ; b++) {
      const t = song.barOffset + b * bar;
      if (t > v.end) break;
      const x = Math.round(X(t)) + 0.5;
      // grid lines through the waveform
      g.fillStyle = k.line;
      if (b % every === 0) g.fillRect(x, WAVE_Y, 1, h - WAVE_Y);
      if (pxBar / 4 > 14) for (let q = 1; q < 4; q++) {
        const bx = Math.round(X(t + q * beat)) + 0.5;
        g.fillStyle = k.line; g.globalAlpha = 0.45; g.fillRect(bx, WAVE_Y, 1, h - WAVE_Y); g.globalAlpha = 1;
        // label beats once there's room: 32.2, 32.3, 32.4
        if (pxBar / 4 > 44) { g.fillStyle = k.text3; g.globalAlpha = 0.6; g.fillRect(bx, RULER - 4, 1, 4); g.fillText(`${b + 1}.${q + 1}`, bx + 3, RULER / 2); g.globalAlpha = 1; }
      }
      if (b % every === 0) {
        g.fillStyle = k.text3;
        g.fillRect(x, RULER - 7, 1, 7);
        g.fillText(String(b + 1), x + 4, RULER / 2);
      }
    }
  } else {
    const step = niceStep(len / Math.max(1, w / 80));
    for (let t = Math.ceil(v.start / step) * step; t <= v.end; t += step) {
      const x = Math.round(X(t)) + 0.5;
      g.fillStyle = k.text3; g.fillRect(x, RULER - 7, 1, 7); g.fillText(formatTime(t), x + 4, RULER / 2);
    }
  }

  // loop region
  if (ls !== undefined && le !== undefined) {
    const x0 = X(ls), x1 = X(le);
    g.fillStyle = k.cycle;
    g.globalAlpha = 0.09; g.fillRect(x0, RULER, x1 - x0, h - RULER); g.globalAlpha = 1;
    g.globalAlpha = 0.95; roundRect(g, x0, 3, Math.max(2, x1 - x0), RULER - 6, 4); g.fill(); g.globalAlpha = 1;
    // A / B flags
    for (const [x, tag] of [[x0, "A"], [x1, "B"]] as const) {
      g.fillStyle = k.cycle;
      g.fillRect(x - 1, 0, 2, h);
      roundRect(g, tag === "A" ? x : x - 14, h - 18, 14, 14, 3); g.fill();
      g.fillStyle = "#1d1503"; g.font = `700 9.5px ${k.font}`; g.textAlign = "center";
      g.fillText(tag, tag === "A" ? x + 7 : x - 7, h - 11);
      g.textAlign = "start";
    }
    if (x1 - x0 > 60) { g.fillStyle = "#1d1503"; g.font = `650 10.5px ${k.font}`; g.fillText(loop?.label ?? "Loop", x0 + 7, RULER / 2 + 0.5); }
  }

  // a start marked with Set A, waiting for Set B
  const markA = store.state.player.markA;
  if (markA !== null && ls === undefined && markA >= v.start && markA <= v.end) {
    const x = X(markA);
    g.fillStyle = k.cycle;
    g.fillRect(x - 1, 0, 2, h);
    roundRect(g, x, h - 18, 14, 14, 3); g.fill();
    g.fillStyle = "#1d1503"; g.font = `700 9.5px ${k.font}`; g.textAlign = "center"; g.fillText("A", x + 7, h - 11); g.textAlign = "start";
  }

  // section lane
  for (const s of secs) {
    const x0 = Math.max(X(s.start), -10), x1 = Math.min(X(s.end), w + 10);
    if (x1 < 0 || x0 > w) continue;
    const col = secColor(s.label), on = loop?.idx === s.idx, cur = store.state.player.sectionIdx === s.idx;
    g.fillStyle = col;
    g.globalAlpha = on || cur ? 1 : 0.82;
    roundRect(g, x0 + 1, LANE_Y, Math.max(2, x1 - x0 - 2), LANE_H, 6); g.fill();
    g.globalAlpha = 1;
    if (on) { g.strokeStyle = k.cycle; g.lineWidth = 2; roundRect(g, x0 + 1, LANE_Y, Math.max(2, x1 - x0 - 2), LANE_H, 6); g.stroke(); }
    g.save(); roundRect(g, x0 + 1, LANE_Y, Math.max(2, x1 - x0 - 2), LANE_H, 6); g.clip();
    g.fillStyle = "#0b0e14"; g.font = `650 11.5px ${k.font}`; g.textBaseline = "middle";
    const label = x1 - x0 > 70 ? s.label : shortLabel(s.label);
    g.fillText(label, Math.max(x0, 0) + 8, LANE_Y + LANE_H / 2 + 0.5);
    g.restore();
  }

  // waveform
  const P = song.peaks.length;
  let pm = 0;
  for (const p of song.peaks) pm = Math.max(pm, p);
  pm ||= 1;
  const top = WAVE_Y + 4, bottom = h - 24, mid = (top + bottom) / 2, amp = (bottom - top) / 2;
  let si = 0;
  for (let x = 0; x < w; x++) {
    const t0 = v.start + (x / w) * len, t1 = v.start + ((x + 1) / w) * len;
    let i0 = Math.floor((t0 / song.duration) * P), i1 = Math.max(i0 + 1, Math.ceil((t1 / song.duration) * P));
    i0 = Math.max(0, i0); i1 = Math.min(P, i1);
    let m = 0;
    for (let i = i0; i < i1; i++) m = Math.max(m, song.peaks[i]!);
    while (si < secs.length - 1 && t0 >= secs[si]!.end) si++;
    const s = secs[si];
    const a = Math.max(0.75, (m / pm) * amp);
    const inLoop = ls === undefined || (t0 >= ls && t0 <= (le ?? 0));
    g.fillStyle = s ? secColor(s.label) : k.text2;
    g.globalAlpha = (t0 <= now ? 1 : 0.62) * (inLoop ? 1 : 0.35);
    g.fillRect(x, mid - a, 1, a * 2);
  }
  g.globalAlpha = 1;

  // time at the bottom left/right
  g.fillStyle = k.text3; g.font = `500 10.5px ${k.mono}`; g.textBaseline = "alphabetic";
  g.fillText(formatTime(v.start), 8, h - 6);
  const endLabel = formatTime(v.end), ew = g.measureText(endLabel).width;
  g.fillText(endLabel, w - ew - 8, h - 6);

  // playhead
  if (now >= v.start && now <= v.end) {
    const x = Math.round(X(now)) + 0.5;
    g.fillStyle = k.play;
    g.fillRect(x - 0.75, RULER, 1.5, h - RULER);
    g.beginPath(); g.moveTo(x - 5, RULER - 1); g.lineTo(x + 5, RULER - 1); g.lineTo(x, RULER + 5); g.closePath(); g.fill();
  }
}

function paintOverview(cv: HTMLCanvasElement | null, song: Song, sections: ResolvedSection[], v: View, now: number) {
  const c = fit(cv);
  if (!c) return;
  const { g, w, h } = c, k = tokens();
  const X = (t: number) => (t / song.duration) * w;
  g.fillStyle = k.panel2; g.fillRect(0, 0, w, h);
  const P = song.peaks.length;
  let pm = 0;
  for (const p of song.peaks) pm = Math.max(pm, p);
  pm ||= 1;
  let si = 0;
  for (let x = 0; x < w; x++) {
    const t0 = (x / w) * song.duration;
    const i0 = Math.floor((x / w) * P), i1 = Math.max(i0 + 1, Math.floor(((x + 1) / w) * P));
    let m = 0;
    for (let i = i0; i < i1 && i < P; i++) m = Math.max(m, song.peaks[i]!);
    while (si < sections.length - 1 && t0 >= sections[si]!.end) si++;
    const s = sections[si];
    g.fillStyle = s ? k.t(`--sec-${typeOf(s.label)}`) : k.text3;
    g.globalAlpha = 0.55;
    const a = Math.max(0.5, (m / pm) * (h / 2 - 5));
    g.fillRect(x, h / 2 - a, 1, a * 2);
  }
  g.globalAlpha = 1;
  const l = store.state.player.loop;
  if (l) { g.fillStyle = k.cycle; g.fillRect(X(l.start), 0, Math.max(2, X(l.end) - X(l.start)), 3); }
  if (v.end - v.start < song.duration - 0.01) {
    const x0 = X(v.start), x1 = X(v.end);
    g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(0, 0, x0, h); g.fillRect(x1, 0, w - x1, h);
    g.strokeStyle = k.text; g.globalAlpha = 0.7; g.lineWidth = 1.5; roundRect(g, x0 + 0.75, 1.5, Math.max(4, x1 - x0 - 1.5), h - 3, 4); g.stroke(); g.globalAlpha = 1;
  }
  g.fillStyle = k.play; g.fillRect(Math.round(X(now)), 0, 1.5, h);
}

function niceStep(raw: number) {
  for (const s of [1, 2, 5, 10, 15, 30, 60, 120]) if (s >= raw) return s;
  return 300;
}
