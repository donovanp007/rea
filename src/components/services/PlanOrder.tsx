"use client";
import { useState } from "react";
import { addToQueue, openSong, setView } from "@/lib/actions";
import { openLive } from "@/lib/live/actions";
import { METERS } from "@/lib/ableton/export";
import { useApp } from "@/lib/store/appStore";
import { addPlanItem, addSetSong, applyTemplate, changeKey, copySetlist, deleteTemplate, keyOptions, moveItem, moveSetSong, removeSetSong, saveTemplate, updateSetSong } from "@/lib/team/actions";
import { fmtDate } from "@/lib/team/demo";
import { colorOf, isPlaceholder, isSong, ITEM_TYPES, itemType, kindOf, sectionTotals, timeline } from "@/lib/team/plan";
import type { PlanTemplate, Service, SetSong } from "@/lib/team/types";
import { IconPlay, IconTrash } from "../shell/icons";

const NO_TEMPLATES: PlanTemplate[] = [];
const css = (v: Record<string, string>) => v as React.CSSProperties;

/** The order of service: songs and everything else, in order, with a running clock. Leaders drag to reorder. */
export function PlanOrder({ svc, lead, earlier }: { svc: Service; lead: boolean; earlier: Service[] }) {
  const songs = useApp((s) => s.songs);
  const templates = useApp((s) => s.team?.templates) ?? NO_TEMPLATES;
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const tl = timeline(svc);
  const totals = sectionTotals(svc.setlist);
  const hasTracks = svc.setlist.some((s) => s.songId && songs.some((x) => x.id === s.songId));

  const drop = (to: number) => {
    if (drag) moveItem(svc.id, drag, to > svc.setlist.findIndex((x) => x.id === drag) ? to - 1 : to);
    setDrag(null);
    setOver(null);
  };

  return (
    <section className="panel">
      <div className="panel-b">
        <div className="row between">
          <span className="note mono">{svc.time} → {tl.end} · {tl.total} min · {tl.music} min of music</span>
          {hasTracks && (
            <div className="row">
              <button type="button" className="btn sm ghost" onClick={() => { svc.setlist.forEach((s) => { if (s.songId && songs.some((x) => x.id === s.songId)) addToQueue(s.songId, null, 1); }); setView("queue"); }}>Add practice tracks to my queue</button>
            </div>
          )}
        </div>
        {!svc.setlist.length && <p className="empty">Nothing in the order yet.{lead ? " Add songs and items below, start from a template, or copy an earlier Sunday." : ""}</p>}
        <ol className="order" onDragOver={(e) => { if (drag) e.preventDefault(); }}>
          {tl.rows.map(({ item, start }, i) => {
            const isOpen = open === item.id;
            const kind = kindOf(item);
            const dropHere = drag && over === i;
            return (
              <li key={item.id} className={`ord ${kind}${drag === item.id ? " dragging" : ""}${dropHere ? " drop-before" : ""}`} style={css({ "--c": `var(${colorOf(item)})` })}
                onDragOver={(e) => { if (drag) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setOver(e.clientY < r.top + r.height / 2 ? i : i + 1); } }}
                onDrop={(e) => { e.preventDefault(); drop(over ?? i); }}>
                {kind === "header" ? (
                  <div className="ord-row head">
                    {lead && <Grip id={item.id} onStart={setDrag} onEnd={() => { setDrag(null); setOver(null); }} />}
                    {lead ? <input className="ord-title" defaultValue={item.title} key={item.title} aria-label="Section name" onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== item.title) updateSetSong(svc.id, item.id, { title: v }); }} /> : <b>{item.title}</b>}
                    <span className="note mono">{totals[item.id] ?? 0} min</span>
                    {lead && <Actions svc={svc} item={item} i={i} />}
                  </div>
                ) : (
                  <>
                    <div className="ord-row">
                      {lead && <Grip id={item.id} onStart={setDrag} onEnd={() => { setDrag(null); setOver(null); }} />}
                      <span className="clock mono">{start}</span>
                      <div className="ord-main">
                        {lead && !isSong(item) ? <input className="ord-title" defaultValue={item.title} key={item.title} aria-label="Item name" onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== item.title) updateSetSong(svc.id, item.id, { title: v }); }} /> : <b>{item.title}</b>}
                        <span className="note">{isSong(item) ? (item.songId ? "Song · practice track" : "Song") : itemType(item.itemType).label}{isPlaceholder(item) && <em className="fill-in">Fill in</em>}</span>
                      </div>
                      {isSong(item) && (lead
                        ? <select className="key-select" value={item.key} aria-label={`Key of ${item.title}`} onChange={(e) => changeKey(svc.id, item.id, e.target.value)}>{keyOptions.map((k) => <option key={k} value={k}>{k}</option>)}</select>
                        : <span className="key-badge">{item.key}</span>)}
                      {lead ? <label className="mins"><input type="number" min={0} max={240} value={item.minutes} aria-label={`Minutes for ${item.title}`} onChange={(e) => updateSetSong(svc.id, item.id, { minutes: Math.max(0, +e.target.value || 0) })} /><span>min</span></label> : <span className="note mono">{item.minutes} min</span>}
                      <div className="acts">
                        {isSong(item) && <button type="button" className="btn sm ghost" aria-expanded={isOpen} aria-label={`Details for ${item.title}`} onClick={() => setOpen(isOpen ? null : item.id)}>{isOpen ? "Hide" : "Details"}</button>}
                        {lead && <Actions svc={svc} item={item} i={i} />}
                      </div>
                    </div>
                    {isOpen && <SongDetail svc={svc} item={item} lead={lead} />}
                  </>
                )}
              </li>
            );
          })}
          {drag && over === svc.setlist.length && <li className="ord-end" aria-hidden />}
        </ol>
        {drag && <div className="ord-tail" onDragOver={(e) => { e.preventDefault(); setOver(svc.setlist.length); }} onDrop={(e) => { e.preventDefault(); drop(svc.setlist.length); }}>Drop here to move to the end</div>}
        {lead && (
          <>
            <AddSong svc={svc} />
            <AddItem svc={svc} />
            <Templates svc={svc} earlier={earlier} templates={templates} />
            {svc.status === "published" && <p className="note">Changing a key or adding a song notifies everyone on this service.</p>}
          </>
        )}
      </div>
    </section>
  );
}

function Grip({ id, onStart, onEnd }: { id: string; onStart: (id: string) => void; onEnd: () => void }) {
  return (
    <span className="grip" draggable aria-hidden title="Drag to reorder"
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); onStart(id); }} onDragEnd={onEnd}>⋮⋮</span>
  );
}

function Actions({ svc, item, i }: { svc: Service; item: SetSong; i: number }) {
  return (
    <>
      <button type="button" className="btn sm icon ghost" aria-label={`Move ${item.title} up`} disabled={i === 0} onClick={() => moveSetSong(svc.id, i, -1)}>↑</button>
      <button type="button" className="btn sm icon ghost" aria-label={`Move ${item.title} down`} disabled={i === svc.setlist.length - 1} onClick={() => moveSetSong(svc.id, i, 1)}>↓</button>
      <button type="button" className="btn sm icon ghost" aria-label={`Remove ${item.title}`} onClick={() => removeSetSong(svc.id, item.id)}><IconTrash /></button>
    </>
  );
}

/** Everything about one song in the plan: tempo, time signature, notes and the ways to open it. */
function SongDetail({ svc, item, lead }: { svc: Service; item: SetSong; lead: boolean }) {
  const lib = useApp((s) => s.songs.find((x) => x.id === item.songId));
  const bpm = item.bpm ?? (lib?.bpm ? Math.round(lib.bpm * 100) / 100 : undefined);
  return (
    <div className="ord-detail">
      <div className="facts">
        <label className="field"><span className="label">Tempo</span>
          {lead ? <input type="number" min={30} max={300} step={0.01} value={bpm ?? ""} placeholder="BPM" onChange={(e) => updateSetSong(svc.id, item.id, { bpm: e.target.value ? +e.target.value : undefined })} /> : <b>{bpm ? `${bpm} BPM` : "—"}</b>}
        </label>
        <label className="field"><span className="label">Time</span>
          {lead ? <select value={item.meter ?? "4/4"} onChange={(e) => updateSetSong(svc.id, item.id, { meter: e.target.value })}>{METERS.map((m) => <option key={m}>{m}</option>)}</select> : <b>{item.meter ?? "4/4"}</b>}
        </label>
        {lib && <div className="field"><span className="label">Sections</span><b>{lib.sections.length}</b></div>}
        {lib?.stems?.length ? <div className="field"><span className="label">Stems</span><b>{lib.stems.length}</b></div> : null}
      </div>
      <label className="field"><span className="label">Note for the band</span>
        {lead ? <input type="text" defaultValue={item.note ?? ""} key={item.note ?? ""} placeholder="e.g. Start on the chorus, build on the last time" onBlur={(e) => { if ((item.note ?? "") !== e.target.value) updateSetSong(svc.id, item.id, { note: e.target.value }); }} /> : <span>{item.note || "—"}</span>}
      </label>
      {item.songId && lib && (
        <div className="row">
          <button type="button" className="btn sm" onClick={() => void openSong(item.songId!)}><IconPlay size={13} /> Practise</button>
          <button type="button" className="btn sm" onClick={() => { void openLive(svc.id, item.songId); setView("live"); }}>Open in Live</button>
        </div>
      )}
    </div>
  );
}

function AddSong({ svc }: { svc: Service }) {
  const songs = useApp((s) => s.songs);
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("G");
  const add = () => {
    const t = title.trim();
    if (!t) return;
    const lib = songs.find((s) => s.name.toLowerCase() === t.toLowerCase());
    addSetSong(svc.id, { title: lib?.name ?? t, key: lib?.key || key, minutes: lib ? Math.max(1, Math.round(lib.duration / 60)) : 5, songId: lib?.id });
    setTitle("");
  };
  return (
    <div className="add-song">
      <input type="text" list="lib-songs" placeholder="Add a song: type a title or pick from your library" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} className="grow" aria-label="Song title" />
      <datalist id="lib-songs">{songs.map((s) => <option key={s.id} value={s.name} />)}</datalist>
      <select value={key} onChange={(e) => setKey(e.target.value)} aria-label="Key">{keyOptions.map((k) => <option key={k} value={k}>{k}</option>)}</select>
      <button type="button" className="btn" onClick={add} disabled={!title.trim()}>Add song</button>
    </div>
  );
}

function AddItem({ svc }: { svc: Service }) {
  const [type, setType] = useState<string>(ITEM_TYPES[1].id);
  const [title, setTitle] = useState("");
  const [mins, setMins] = useState<string>("");
  return (
    <div className="add-song">
      <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type of item">{ITEM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
      <input type="text" className="grow" placeholder={`Title (default “${itemType(type).label}”)`} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Item title" onKeyDown={(e) => { if (e.key === "Enter") { addPlanItem(svc.id, "item", title, type, mins ? +mins : undefined); setTitle(""); } }} />
      <input type="number" min={0} max={240} value={mins} placeholder={String(itemType(type).minutes)} onChange={(e) => setMins(e.target.value)} style={{ width: 72 }} aria-label="Minutes" />
      <button type="button" className="btn" onClick={() => { addPlanItem(svc.id, "item", title, type, mins ? +mins : undefined); setTitle(""); setMins(""); }}>Add item</button>
      <button type="button" className="btn ghost" onClick={() => { addPlanItem(svc.id, "header", title); setTitle(""); }}>Add section header</button>
    </div>
  );
}

function Templates({ svc, earlier, templates }: { svc: Service; earlier: Service[]; templates: PlanTemplate[] }) {
  const [name, setName] = useState("");
  return (
    <div className="add-song tpl">
      {templates.length > 0 && (
        <select value="" aria-label="Start from a template" onChange={(e) => e.target.value && applyTemplate(svc.id, e.target.value)}>
          <option value="">Start from a template…</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.items.length} items</option>)}
        </select>
      )}
      {earlier.length > 0 && (
        <select value="" aria-label="Copy an earlier service" onChange={(e) => e.target.value && copySetlist(e.target.value, svc.id)}>
          <option value="">Copy an earlier Sunday…</option>
          {earlier.map((s) => <option key={s.id} value={s.id}>{fmtDate(s.date)} · {s.setlist.length} items</option>)}
        </select>
      )}
      <input type="text" placeholder="Save this order as a template" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { saveTemplate(svc.id, name); setName(""); } }} aria-label="Template name" style={{ minWidth: 190 }} />
      <button type="button" className="btn" disabled={!name.trim() || !svc.setlist.length} onClick={() => { saveTemplate(svc.id, name); setName(""); }}>Save template</button>
      {templates.length > 0 && <details className="tpl-manage"><summary>Manage</summary>{templates.map((t) => <div key={t.id} className="row between"><span>{t.name}</span><button type="button" className="btn sm ghost" aria-label={`Delete template ${t.name}`} onClick={() => deleteTemplate(t.id)}><IconTrash /></button></div>)}</details>}
    </div>
  );
}
