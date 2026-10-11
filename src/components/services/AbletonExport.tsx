"use client";
import { useEffect, useMemo, useState } from "react";
import { buildAbletonProject, download, exportRows, METERS, previewSession, projectName, removeTemplate, saveTemplate, templateInfo, type StoredTemplate } from "@/lib/ableton/export";
import { barBeats, DEFAULT_SESSION_OPTIONS, type SessionOptions } from "@/lib/ableton/session";
import { store, useApp } from "@/lib/store/appStore";
import { updateSetSong } from "@/lib/team/actions";
import type { Service } from "@/lib/team/types";

const OPTS_KEY = "wf-ableton-opts";
const loadOpts = (): SessionOptions => {
  try { return { ...DEFAULT_SESSION_OPTIONS, ...(JSON.parse(localStorage.getItem(OPTS_KEY) ?? "{}") as Partial<SessionOptions>) }; } catch { return DEFAULT_SESSION_OPTIONS; }
};

/** Turns the service's setlist into a ready-to-open Ableton Live project. */
export function AbletonExport({ svc }: { svc: Service }) {
  useApp((s) => s.songs); // re-render when songs or stems change
  const [tpl, setTpl] = useState<StoredTemplate | null | undefined>(undefined);
  const [tplError, setTplError] = useState<string[]>([]);
  const [opts, setOpts] = useState<SessionOptions>(loadOpts);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void templateInfo().then(setTpl); }, []);
  const setOpt = (patch: Partial<SessionOptions>) => {
    const next = { ...opts, ...patch };
    setOpts(next);
    try { localStorage.setItem(OPTS_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  const rows = exportRows(svc);
  const session = useMemo(() => previewSession(svc, opts), [svc, opts, rows.map((r) => `${r.song?.id}${r.stems}${r.bpm}${r.meter}`).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const playable = rows.filter((r) => r.song);
  const minutes = session.songs.reduce((a, s) => a + ((s.end - s.start) * 60) / s.bpm, 0) / 60;

  const onTemplate = async (file: File) => {
    const info = await saveTemplate(file);
    if (!info.ok) { setTplError(info.problems); return; }
    setTplError([]);
    setTpl(await templateInfo());
  };

  const onExport = async () => {
    setError(null);
    try {
      const { blob, name } = await buildAbletonProject(svc, opts, setBusy);
      setBusy(null);
      download(blob, name);
      store.set({ status: { text: `Downloaded ${name}. Unzip it and open the .als file in Ableton.`, busy: false } });
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "The export failed.");
    }
  };

  return (
    <section className="abl">
      <div className="panel">
        <div className="panel-h"><h3>1 · Your Ableton template</h3>{tpl && <button type="button" className="btn sm ghost" onClick={() => void removeTemplate().then(() => setTpl(null))}>Remove</button>}</div>
        <div className="panel-b">
          {tpl === undefined ? <p className="note">Checking…</p> : tpl ? (
            <div className="tpl-ok">
              <b>{tpl.name}</b>
              <span className="note">{tpl.info.creator || "Ableton Live"} · audio tracks: {tpl.info.audioTracks.join(", ")}{tpl.info.otherTracks ? ` · ${tpl.info.otherTracks} other track${tpl.info.otherTracks === 1 ? "" : "s"} kept as they are` : ""}</span>
            </div>
          ) : (
            <p className="note">Generated sets are built from a set saved in your own Ableton, so they open in your version with your routing. Make it once:</p>
          )}
          {!tpl && (
            <ol className="steps">
              <li>In Ableton, make a new Live Set.</li>
              <li>Optional: name audio tracks <b>Click</b>, <b>Guide</b>, <b>Drums</b>… and set their outputs (e.g. click and guide to the in-ear outputs). Those tracks keep their settings. Add MIDI tracks you always use.</li>
              <li>Drag any short audio file onto the first plain audio track in Arrangement view, and add one locator.</li>
              <li>Save the set and choose its <b>.als</b> file here.</li>
            </ol>
          )}
          <div className="row">
            <span className="btn file-btn sm">{tpl ? "Replace template" : "Choose template .als"}<input type="file" className="file-overlay" accept=".als" aria-label="Choose Ableton template" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onTemplate(f); }} /></span>
          </div>
          {tplError.map((p) => <p key={p} className="err">{p}</p>)}
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><h3>2 · Songs, tempo and time signature</h3><span className="note">{playable.length} of {rows.length} have audio</span></div>
        <div className="panel-b">
          <ul className="abl-rows">
            {rows.map((r, i) => (
              <li key={r.item.id} className={r.song ? "" : "skip"}>
                <span className="n mono">{i + 1}</span>
                <span className="t"><b>{r.item.title}</b><small>{r.song ? (r.stems > 1 ? `${r.stems} stems` : "Full mix only") : "No audio · skipped"}</small></span>
                <label className="f"><span>BPM</span><input type="number" min={30} max={300} step={0.01} value={r.bpm ?? ""} placeholder="120" disabled={!r.song} onChange={(e) => updateSetSong(svc.id, r.item.id, { bpm: e.target.value ? +e.target.value : undefined })} /></label>
                <label className="f"><span>Time</span><select value={r.meter} disabled={!r.song} onChange={(e) => updateSetSong(svc.id, r.item.id, { meter: e.target.value })}>{METERS.map((m) => <option key={m}>{m}</option>)}</select></label>
              </li>
            ))}
          </ul>
          <p className="note">Tempo starts from the detected value. Change the order on the Setlist tab, then export again: the set is rebuilt from scratch every time.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><h3>3 · Build the set</h3></div>
        <div className="panel-b">
          <div className="row">
            <label className="row note">Gap between songs
              <select value={opts.gapBars} onChange={(e) => setOpt({ gapBars: +e.target.value })}>{[0, 1, 2, 4, 8].map((n) => <option key={n} value={n}>{n} bar{n === 1 ? "" : "s"}</option>)}</select>
            </label>
            <label className="row note"><input type="checkbox" checked={opts.sectionLocators} onChange={(e) => setOpt({ sectionLocators: e.target.checked })} /> Locator for every section</label>
            <label className="row note"><input type="checkbox" checked={opts.stopLocators} onChange={(e) => setOpt({ stopLocators: e.target.checked })} /> STOP locator after each song</label>
          </div>
          <div className="abl-preview" aria-label="What the set will contain">
            <div className="label">{projectName(svc)}.als · {session.tracks.length} tracks · {session.locators.length} locators · {Math.round(minutes)} min</div>
            <div className="abl-tracks">{session.tracks.map((t) => <span key={t.name} className="chip">{t.name}</span>)}</div>
            <ol className="abl-cues">
              {session.songs.map((s, i) => (
                <li key={i}>
                  <b>{s.title}</b> <span className="mono note">{s.bpm} BPM · {s.sig.num}/{s.sig.den} · bar {barAt(session, s.start)}</span>
                  <div className="abl-locs">{session.locators.filter((l) => l.beat > s.start && l.beat <= s.end).map((l, k) => <span key={k} className={l.name === "STOP" ? "stop" : ""}>{l.name}</span>)}</div>
                </li>
              ))}
            </ol>
          </div>
          {error && <p className="err">{error}</p>}
          <div className="row">
            <button type="button" className="btn primary" disabled={!tpl || !playable.length || !!busy} onClick={() => void onExport()}>{busy ? <><i className="spin" aria-hidden /> {busy}</> : "Download Ableton project"}</button>
          </div>
          <p className="note">You get a .zip with the .als set, every stem in its Samples folder and a cue sheet. Unzip it anywhere and open the .als. Downloads work in the installed app; the Claude preview blocks them.</p>
        </div>
      </div>
    </section>
  );
}

function barAt(session: ReturnType<typeof previewSession>, beat: number): number {
  let bar = 1;
  for (let i = 0; i < session.songs.length; i++) {
    const s = session.songs[i]!, next = session.songs[i + 1];
    if (beat < (next?.start ?? Infinity)) return bar + Math.round((beat - s.start) / barBeats(s.sig));
    bar += Math.round((next!.start - s.start) / barBeats(s.sig));
  }
  return bar;
}
