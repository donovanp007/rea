"use client";
import { useEffect, useRef } from "react";
import { setView, openSong } from "@/lib/actions";
import { addStems, liveEngine, liveSetlist, newMultitrackSong, openLive, playSong, removeStem, resetMix, setAutoNext, setJump, setSplit, setStemGroup, setStrip } from "@/lib/live/actions";
import { liveStems } from "@/lib/live/liveEngine";
import { barBeatAt } from "@/lib/music/grid";
import { formatTime, resolveSections, sectionAt, shortLabel, typeOf } from "@/lib/music/sections";
import { store, useApp, type JumpMode } from "@/lib/store/appStore";
import type { Song } from "@/lib/store/types";
import { fmtDate } from "@/lib/team/demo";
import { DEFAULT_STRIP, GROUP_ORDER, GROUPS, isCue, stemGain, type Stem } from "@/lib/tracks/stems";
import { AUDIO_ACCEPT } from "../shell/AddSongsButton";
import { IconNext, IconPause, IconPlay, IconPrev, IconTrash } from "../shell/icons";

const css = (v: Record<string, string>) => v as React.CSSProperties;
const JUMPS: [JumpMode, string][] = [["bar", "Next bar"], ["section", "End of section"], ["now", "Now"]];

export function LiveView() {
  const live = useApp((s) => s.live);
  const team = useApp((s) => s.team);
  const songs = useApp((s) => s.songs);
  const song = songs.find((x) => x.id === live.songId);
  const today = new Date().toISOString().slice(0, 10);
  const services = (team?.services ?? []).filter((s) => s.date >= today);
  const list = liveSetlist(live.serviceId);

  // open the next service with playable songs; runs again as songs finish loading
  const ready = songs.length > 0 && !!team;
  useEffect(() => {
    if (!ready || store.state.live.songId || store.state.live.loading) return;
    const svc = services.find((s) => liveSetlist(s.id).length);
    void openLive(svc?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, songs.length]);

  return (
    <section className="view live" aria-label="Live">
      <div className="vhead">
        <div style={{ minWidth: 0 }}>
          <div className="label">Live · multitracks</div>
          <h1>{song?.name ?? "Live"}</h1>
          <p>Run the set with click, guide and stems. Section jumps land on the beat.</p>
        </div>
        <div className="row">
          <label className="sr-only" htmlFor="live-source">Setlist</label>
          <select id="live-source" value={live.serviceId ?? ""} onChange={(e) => void openLive(e.target.value || null)}>
            {services.map((s) => <option key={s.id} value={s.id}>{fmtDate(s.date)} · {s.title}</option>)}
            <option value="">All songs</option>
          </select>
          <StemsButton label="New song from stems" onFiles={(f) => void newMultitrackSong(f)} />
        </div>
      </div>

      <Setlist list={list} current={live.songId} serviceId={live.serviceId} />
      {song ? (
        <>
          <Stage song={song} />
          <SectionPads song={song} />
          <Mixer song={song} />
        </>
      ) : (
        <p className="empty">{live.loading ? "Loading stems…" : "No songs with audio in this set yet. Add a song from the library to the service, or create one from stems."}</p>
      )}
      <LiveDock song={song} hasPrev={!!song && list.findIndex((x) => x.songId === song.id) > 0} hasNext={!!song && list.findIndex((x) => x.songId === song.id) < list.length - 1} />
    </section>
  );
}

function Setlist({ list, current, serviceId }: { list: ReturnType<typeof liveSetlist>; current: string | null; serviceId: string | null }) {
  if (!list.length) return null;
  return (
    <ol className="live-set" aria-label="Setlist">
      {list.map((it, i) => {
        const on = it.songId === current;
        return (
          <li key={it.songId}>
            <button type="button" aria-current={on ? "true" : undefined} onClick={() => void playSong(it.songId)}>
              <span className="n mono">{i + 1}</span>
              <span className="t">{it.title}</span>
              <span className="m mono">{[it.key, it.song.bpm ? `${Math.round(it.song.bpm)} BPM` : "", it.song.stems?.length ? `${it.song.stems.length} stems` : "Mix"].filter(Boolean).join(" · ")}</span>
            </button>
          </li>
        );
      })}
      {serviceId === null && <li className="note">Showing every song in the library.</li>}
    </ol>
  );
}

function Stage({ song }: { song: Song }) {
  const pending = useApp((s) => s.live.pending);
  const secs = resolveSections(song.sections, song.duration);
  const secEl = useRef<HTMLDivElement>(null);
  const nextEl = useRef<HTMLDivElement>(null);
  const bbEl = useRef<HTMLDivElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const headEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0, lastIdx = -2;
    const tick = () => {
      const t = liveEngine().time;
      const cur = sectionAt(secs, t);
      if (cur?.idx !== lastIdx) {
        lastIdx = cur?.idx ?? -1;
        if (secEl.current) { secEl.current.textContent = cur?.label ?? "—"; secEl.current.style.setProperty("--c", `var(--sec-${typeOf(cur?.label ?? "")})`); }
        const nx = cur ? secs[cur.idx + 1] : secs[0];
        if (nextEl.current) nextEl.current.textContent = nx ? `Next: ${nx.label}` : "Last section";
      }
      const bb = barBeatAt(t, { bpm: song.bpm, barOffset: song.barOffset });
      if (bbEl.current) bbEl.current.textContent = bb ? `${Math.max(1, bb.bar)}.${bb.beat}` : "—";
      if (timeEl.current) timeEl.current.textContent = `${formatTime(t)} / ${formatTime(song.duration)}`;
      if (headEl.current) headEl.current.style.left = `${(t / song.duration) * 100}%`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [song, secs]);

  return (
    <div className="panel stage">
      <div className="stage-top">
        <div style={{ minWidth: 0 }}>
          <div className="label">Now</div>
          <div className="stage-sec" ref={secEl}>—</div>
          <div className="stage-next" ref={nextEl} />
        </div>
        <div className="stage-bb">
          <div className="label">Bar</div>
          <div className="bb mono" ref={bbEl}>—</div>
          <span className="mono note" ref={timeEl} />
        </div>
      </div>
      {pending && <div className="stage-pending"><span className="chip cycle">Jumping to {pending.label} {store.state.live.jump === "section" ? "at the end of this section" : "on the next bar"}</span><button type="button" className="btn sm ghost" onClick={() => liveEngine().cancelJump()}>Cancel</button></div>}
      <div className="timeline" role="group" aria-label="Song sections">
        {secs.map((s) => (
          <button key={s.idx} type="button" title={s.label} style={css({ flex: String(s.end - s.start), "--c": `var(--sec-${typeOf(s.label)})` })} onClick={() => liveEngine().jumpTo(s.label, s.start)}>
            <span>{shortLabel(s.label)}</span>
          </button>
        ))}
        <div className="head" ref={headEl} aria-hidden />
      </div>
      <div className="row meta">
        {song.key && <span className="chip">Key {song.key}</span>}
        {song.bpm && <span className="chip mono">{Math.round(song.bpm * 10) / 10} BPM</span>}
        <span className="chip">{secs.length} sections</span>
        <button type="button" className="btn sm ghost" onClick={() => void openSong(song.id)}>Practice this song</button>
      </div>
    </div>
  );
}

function SectionPads({ song }: { song: Song }) {
  const pending = useApp((s) => s.live.pending);
  const secs = resolveSections(song.sections, song.duration);
  return (
    <div className="pads live-pads" role="group" aria-label="Jump to section">
      {secs.map((s) => (
        <button key={s.idx} type="button" className="pad" style={css({ "--c": `var(--sec-${typeOf(s.label)})` })} onClick={() => liveEngine().jumpTo(s.label, s.start)}>
          <b>{s.label}</b>
          <span className="at">{formatTime(s.start)}</span>
          {pending?.to === s.start && <i className="tag next">NEXT</i>}
        </button>
      ))}
    </div>
  );
}

function Mixer({ song }: { song: Song }) {
  const live = useApp((s) => s.live);
  const stems = liveStems(song);
  const groups = [...new Set(stems.map((s) => s.group))].sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));
  const hasCue = groups.some(isCue);
  return (
    <div className="panel">
      <div className="panel-h">
        <h3>Mixer</h3>
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={resetMix}>Reset</button>
          <StemsButton label={song.stems?.length ? "Add stems" : "Add stems to this song"} small onFiles={(f) => void addStems(song.id, f)} />
        </div>
      </div>
      <div className="panel-b">
        <div className="mixer">
          {groups.map((g) => {
            const strip = { ...DEFAULT_STRIP, ...live.mix[g] };
            const audible = stemGain(g, live.mix) > 0;
            const names = stems.filter((s) => s.group === g);
            return (
              <div key={g} className={`strip-row${audible ? "" : " off"}`} style={css({ "--c": GROUPS[g].color })}>
                <div className="sname">
                  <b>{GROUPS[g].label}</b>
                  <small>{names.length > 1 ? `${names.length} tracks` : names[0]!.name}{isCue(g) ? " · cue" : ""}</small>
                </div>
                <input type="range" min={0} max={1} step={0.01} value={strip.vol} aria-label={`${GROUPS[g].label} volume`} onChange={(e) => setStrip(g, { vol: +e.target.value })} />
                <button type="button" className="ms m" aria-pressed={strip.mute} aria-label={`Mute ${GROUPS[g].label}`} onClick={() => setStrip(g, { mute: !strip.mute })}>M</button>
                <button type="button" className="ms s" aria-pressed={strip.solo} aria-label={`Solo ${GROUPS[g].label}`} disabled={isCue(g)} onClick={() => setStrip(g, { solo: !strip.solo })}>S</button>
              </div>
            );
          })}
        </div>
        <div className="ctl">
          <div className="ctl-h"><span className="label">Outputs</span></div>
          <button type="button" className="btn sm" aria-pressed={live.split} onClick={() => setSplit(!live.split)} disabled={!hasCue}>
            {live.split ? "Split: cues left · band right" : "Split cues and band"}
          </button>
          <p className="note">{hasCue ? "Split sends click and guide to the left channel (in-ears) and the band to the right (front of house). Use a stereo-to-dual-mono cable into the desk." : "This song has no click or guide track, so there's nothing to split."}</p>
        </div>
        <div className="ctl">
          <div className="ctl-h"><span className="label">Section jumps</span></div>
          <div className="seg grid" style={css({ "--cols": "3" })} role="group" aria-label="When a section jump happens">
            {JUMPS.map(([v, l]) => <button key={v} type="button" aria-pressed={live.jump === v} onClick={() => setJump(v)}>{l}</button>)}
          </div>
          <label className="row note"><input type="checkbox" checked={live.autoNext} onChange={(e) => setAutoNext(e.target.checked)} /> Start the next song when this one ends</label>
        </div>
        {song.stems?.length ? <StemList song={song} stems={stems} /> : null}
      </div>
    </div>
  );
}

function StemList({ song, stems }: { song: Song; stems: Stem[] }) {
  return (
    <details className="fold">
      <summary>Tracks ({stems.length}) · fix a track's group</summary>
      <ul className="stem-list">
        {stems.map((s) => (
          <li key={s.id}>
            <span className="dot" style={css({ "--c": GROUPS[s.group].color })} />
            <span className="nm">{s.name}</span>
            <select value={s.group} aria-label={`Group for ${s.name}`} onChange={(e) => void setStemGroup(song.id, s.id, e.target.value as Stem["group"])}>
              {GROUP_ORDER.filter((g) => g !== "mix").map((g) => <option key={g} value={g}>{GROUPS[g].label}</option>)}
            </select>
            <button type="button" className="btn sm icon ghost" aria-label={`Remove ${s.name}`} onClick={() => void removeStem(song.id, s.id)}><IconTrash /></button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function StemsButton({ label, onFiles, small }: { label: string; onFiles: (f: File[]) => void; small?: boolean }) {
  return (
    <span className={`btn file-btn${small ? " sm" : ""}`}>
      {label}
      <input type="file" className="file-overlay" accept={AUDIO_ACCEPT} multiple aria-label={label}
        onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; if (files.length) onFiles(files); }} />
    </span>
  );
}

function LiveDock({ song, hasPrev, hasNext }: { song: Song | undefined; hasPrev: boolean; hasNext: boolean }) {
  const live = useApp((s) => s.live);
  const timeEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => { if (timeEl.current) timeEl.current.textContent = formatTime(liveEngine().time, true); raf = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="dock live-dock" role="region" aria-label="Live transport">
      <div className="now">
        <span className={`live-dot${live.playing ? " on" : ""}`} aria-hidden />
        <div style={{ minWidth: 0 }}>
          <b>{song?.name ?? "Nothing loaded"}</b>
          <small>{live.loading ? "Loading stems…" : live.playing ? "Playing" : "Stopped"}{live.split ? " · split outputs" : ""}</small>
        </div>
      </div>
      <div className="center">
        <button type="button" className="tbtn" disabled={!hasPrev} aria-label="Previous song" onClick={() => void liveEngine().skip(-1)}><IconPrev /></button>
        <button type="button" className="tbtn" disabled={!song} aria-label="Back to start" onClick={() => liveEngine().stop()}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="5" y="5" width="14" height="14" rx="2" /></svg></button>
        <button type="button" className="playbtn" disabled={!song || live.loading} aria-label={live.playing ? "Pause" : "Play"} onClick={() => liveEngine().toggle()}>{live.playing ? <IconPause /> : <IconPlay />}</button>
        <button type="button" className="tbtn" disabled={!hasNext} aria-label="Next song" onClick={() => void liveEngine().skip(1)}><IconNext /></button>
      </div>
      <div className="right">
        <button type="button" className="btn sm ghost" onClick={() => setView("services")}>Plans</button>
        <div className="time"><div className="t" ref={timeEl}>0:00.0</div></div>
      </div>
    </div>
  );
}
