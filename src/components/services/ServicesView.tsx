"use client";
import { useState } from "react";
import { addToQueue, openSong, setView } from "@/lib/actions";
import { openLive } from "@/lib/live/actions";
import { store, useApp } from "@/lib/store/appStore";
import { addSetSong, changeKey, copySetlist, keyOptions, moveSetSong, publish, remindPending, removeSetSong, respond, setRehearsal, toggleAssign } from "@/lib/team/actions";
import { fmtDate } from "@/lib/team/demo";
import { activeAssignments, candidates, coverage, isLeaderOf, memberById } from "@/lib/team/logic";
import type { Service, TeamState } from "@/lib/team/types";
import { useTeam } from "@/lib/team/useTeam";
import { AVAIL_LABEL, Avatar, STATUS_LABEL } from "../shell/Avatar";
import { IconPlay, IconTrash } from "../shell/icons";
import { UpdateRow } from "../home/HomeView";

export function ServicesView() {
  const { team } = useTeam();
  const openId = useApp((s) => s.openServiceId);
  if (!team) return null;
  const svc = team.services.find((s) => s.id === openId);
  return svc ? <ServicePlan team={team} svc={svc} /> : <ServiceList team={team} />;
}

function ServiceList({ team }: { team: TeamState }) {
  const today = new Date().toISOString().slice(0, 10);
  const services = team.services.filter((s) => s.date >= today);
  return (
    <section className="view" aria-label="Services">
      <div className="vhead"><div><h1>Services</h1><p>Every Sunday's plan: songs, keys, team and rehearsal.</p></div></div>
      <div className="svc-cards">
        {services.map((s) => {
          const cov = coverage(s, team.teams);
          const needed = cov.reduce((a, c) => a + c.needed, 0), filled = cov.reduce((a, c) => a + c.filled, 0);
          const gaps = cov.filter((c) => c.open.length);
          return (
            <button key={s.id} type="button" className="svc-card" onClick={() => store.set({ openServiceId: s.id })}>
              <div className="row between">
                <span className="date-block"><b>{fmtDate(s.date, { day: "numeric" })}</b><span>{fmtDate(s.date, { month: "short" })}</span></span>
                <span className={`chip ${s.status === "published" ? "new" : ""}`}>{s.status === "published" ? "Published" : "Draft"}</span>
              </div>
              <div><b className="t">{s.title}</b><span className="note">{fmtDate(s.date, { weekday: "long" })} · {s.time} · rehearsal {fmtDate(s.rehearsal.date, { weekday: "short" })} {s.rehearsal.time}</span></div>
              <div className="strip" aria-hidden>{cov.map((c) => <i key={c.team.id} style={{ flex: c.needed, "--c": c.open.length ? "var(--line-2)" : `var(${c.team.color})` } as React.CSSProperties} />)}</div>
              <div className="row between note">
                <span>{filled}/{needed} positions · {s.setlist.length} songs</span>
                {gaps.length ? <span className="warn">Needs {gaps.map((g) => g.open.join(", ")).join(", ")}</span> : <span className="okc">Team complete</span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

type Tab = "setlist" | "team" | "rehearsal" | "activity";

function ServicePlan({ team, svc }: { team: TeamState; svc: Service }) {
  const me = memberById(team, team.me)!;
  const songs = useApp((s) => s.songs);
  const [tab, setTab] = useState<Tab>("setlist");
  const lead = me.worshipLeader;
  const myPending = svc.assignments.find((a) => a.memberId === me.id && a.status === "requested");
  const minutes = svc.setlist.reduce((a, s) => a + s.minutes, 0);
  const cov = coverage(svc, team.teams);
  const awaiting = svc.assignments.filter((a) => a.status === "requested").length;
  const proposed = svc.assignments.filter((a) => a.status === "proposed").length;
  const updates = team.updates.filter((u) => u.serviceId === svc.id);
  const earlier = team.services.filter((s) => s.id !== svc.id && s.setlist.length);

  return (
    <section className="view" aria-label={`Service ${fmtDate(svc.date)}`}>
      <div className="vhead">
        <div>
          <button type="button" className="btn sm ghost" style={{ paddingLeft: 0 }} onClick={() => store.set({ openServiceId: null })}>‹ All services</button>
          <h1>{fmtDate(svc.date, { weekday: "long", day: "numeric", month: "long" })}</h1>
          <p>{svc.title} · {svc.time} · rehearsal {fmtDate(svc.rehearsal.date, { weekday: "long" })} {svc.rehearsal.time}</p>
        </div>
        <div className="row">
          <span className={`chip ${svc.status === "published" ? "new" : ""}`}>{svc.status === "published" ? "Published" : "Draft"}</span>
          {svc.setlist.some((x) => x.songId) && <button type="button" className="btn" onClick={() => { void openLive(svc.id); setView("live"); }}>Run live</button>}
          {lead && awaiting > 0 && <button type="button" className="btn" onClick={() => remindPending(svc.id)}>Remind {awaiting} who haven't replied</button>}
          {lead && (svc.status === "draft" || proposed > 0) && <button type="button" className="btn primary" onClick={() => publish(svc.id)}>{svc.status === "draft" ? "Publish plan" : `Send ${proposed} new request${proposed === 1 ? "" : "s"}`}</button>}
        </div>
      </div>

      {myPending && (
        <div className="panel confirm-bar">
          <div><b>You're on {myPending.position}</b><span className="note">Can you make it?</span></div>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => respond(svc.id, myPending.id, true)}>Confirm</button>
            <button type="button" className="btn" onClick={() => respond(svc.id, myPending.id, false)}>Can't make it</button>
          </div>
        </div>
      )}

      <div className="stats4">
        <div className="panel stat"><span className="label">Setlist</span><b>{svc.setlist.length} songs</b><span className="note">{minutes} min of music</span></div>
        <div className="panel stat"><span className="label">Team</span><b>{cov.reduce((a, c) => a + c.filled, 0)}/{cov.reduce((a, c) => a + c.needed, 0)}</b><span className="note">{cov.reduce((a, c) => a + c.confirmed, 0)} confirmed</span></div>
        <div className="panel stat"><span className="label">Awaiting replies</span><b>{awaiting}</b><span className="note">{proposed ? `${proposed} not sent yet` : "requests sent"}</span></div>
        <div className="panel stat"><span className="label">Rehearsal</span><b>{svc.rehearsal.time}</b><span className="note">{fmtDate(svc.rehearsal.date, { weekday: "long" })}</span></div>
      </div>

      <div className="seg" role="tablist" aria-label="Service plan" style={{ width: "fit-content", maxWidth: "100%" }}>
        {(["setlist", "team", "rehearsal", "activity"] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === "setlist" ? "Setlist" : t === "team" ? "Team" : t === "rehearsal" ? "Rehearsal" : `Activity${updates.length ? ` · ${updates.length}` : ""}`}
          </button>
        ))}
      </div>

      {tab === "setlist" && (
        <section className="panel">
          <div className="panel-b">
            {!svc.setlist.length && <p className="empty">No songs yet.{lead ? " Add songs below, or copy an earlier Sunday's set." : ""}</p>}
            <ol className="setlist">
              {svc.setlist.map((s, i) => (
                <li key={s.id}>
                  <span className="num mono">{String(i + 1).padStart(2, "0")}</span>
                  <div style={{ minWidth: 0 }}>
                    <b>{s.title}</b>
                    <span className="note">{s.minutes} min{s.songId ? " · practice track" : ""}</span>
                  </div>
                  {lead ? (
                    <select className="key-select" value={s.key} aria-label={`Key of ${s.title}`} onChange={(e) => changeKey(svc.id, s.id, e.target.value)}>
                      {keyOptions.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  ) : <span className="key-badge">{s.key}</span>}
                  <div className="acts">
                    {s.songId && songs.some((x) => x.id === s.songId) && <button type="button" className="btn sm" onClick={() => void openSong(s.songId!)}><IconPlay size={13} /> Practise</button>}
                    {lead && <>
                      <button type="button" className="btn sm icon ghost" aria-label="Move up" disabled={i === 0} onClick={() => moveSetSong(svc.id, i, -1)}>↑</button>
                      <button type="button" className="btn sm icon ghost" aria-label="Move down" disabled={i === svc.setlist.length - 1} onClick={() => moveSetSong(svc.id, i, 1)}>↓</button>
                      <button type="button" className="btn sm icon ghost" aria-label={`Remove ${s.title}`} onClick={() => removeSetSong(svc.id, s.id)}><IconTrash /></button>
                    </>}
                  </div>
                </li>
              ))}
            </ol>
            {lead && <AddSong svc={svc} earlier={earlier} />}
            {svc.setlist.some((s) => s.songId) && (
              <div className="row"><button type="button" className="btn sm ghost" onClick={() => { svc.setlist.forEach((s) => { if (s.songId && songs.some((x) => x.id === s.songId)) addToQueue(s.songId, null, 1); }); setView("queue"); }}>Add the practice tracks to my queue</button></div>
            )}
            {lead && svc.status === "published" && <p className="note">Changing a key notifies everyone on this service.</p>}
          </div>
        </section>
      )}

      {tab === "team" && (
        <div className="team-grid">
          {cov.map((c) => {
            const canEdit = isLeaderOf(me, c.team.id);
            return (
              <section key={c.team.id} className="panel">
                <div className="panel-h">
                  <h3 className="row" style={{ gap: 8 }}><span className="dot" style={{ "--c": `var(${c.team.color})` } as React.CSSProperties} /> {c.team.name}</h3>
                  <span className={`chip ${c.open.length ? "cycle" : "new"}`}>{c.open.length ? `${c.open.length} open` : "Covered"}</span>
                </div>
                <div className="panel-b">
                  {c.team.positions.map((pos) => {
                    const a = svc.assignments.find((x) => x.teamId === c.team.id && x.position === pos && x.status !== "declined");
                    const m = a && memberById(team, a.memberId);
                    return (
                      <div key={pos} className="pos-row">
                        <span className="note pos">{pos}</span>
                        {m && a ? (
                          <div className="who"><Avatar m={m} size={26} /> <b>{m.name}</b> <span className={`chip st-${a.status}`}>{STATUS_LABEL[a.status]}</span></div>
                        ) : <span className="open-pos">Open</span>}
                        {canEdit && <Pick svc={svc} team={team} teamId={c.team.id} position={pos} current={a?.memberId} />}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {tab === "rehearsal" && (
        <section className="panel">
          <div className="panel-b">
            {lead ? (
              <div className="row">
                <label className="field"><span className="label">Date</span><input type="date" defaultValue={svc.rehearsal.date} key={`d-${svc.rehearsal.date}`} onBlur={(e) => setRehearsal(svc.id, e.target.value, svc.rehearsal.time)} /></label>
                <label className="field"><span className="label">Time</span><input type="text" defaultValue={svc.rehearsal.time} key={`t-${svc.rehearsal.time}`} style={{ width: 90 }} onBlur={(e) => setRehearsal(svc.id, svc.rehearsal.date, e.target.value.trim() || svc.rehearsal.time)} /></label>
              </div>
            ) : <p style={{ margin: 0 }}><b>{fmtDate(svc.rehearsal.date, { weekday: "long", day: "numeric", month: "long" })} at {svc.rehearsal.time}</b></p>}
            <span className="label">Prepare</span>
            <ul className="list">
              {svc.setlist.map((s) => (
                <li key={s.id} className="mini-row">
                  <span className="key-badge">{s.key}</span>
                  <div><b>{s.title}</b></div>
                  {s.songId && songs.some((x) => x.id === s.songId) ? <button type="button" className="btn sm" onClick={() => void openSong(s.songId!)}>Practise</button> : <span className="note">No track yet</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {tab === "activity" && (
        <section className="panel">
          <div className="panel-b">
            {!updates.length ? <p className="note">No changes yet. Key changes, roster changes and replies show up here.</p> : (
              <ul className="updates">{updates.map((u) => <UpdateRow key={u.id} u={u} unread={false} />)}</ul>
            )}
          </div>
        </section>
      )}
    </section>
  );
}

/** Choose who fills a position: available people first, with warnings shown before you commit. */
function Pick({ svc, team, teamId, position, current }: { svc: Service; team: TeamState; teamId: string; position: string; current?: string }) {
  const list = candidates(team, svc, teamId, position);
  return (
    <select className="pick" value={current ?? ""} aria-label={`Who plays ${position}`}
      onChange={(e) => { const id = e.target.value; if (id) toggleAssign(svc.id, teamId, position, id); else if (current) toggleAssign(svc.id, teamId, position, current); }}>
      <option value="">{current ? "Remove" : "Choose…"}</option>
      {list.map((c) => (
        <option key={c.member.id} value={c.member.id}>
          {c.member.name} · {c.avail ? AVAIL_LABEL[c.avail] : "no answer"}{c.recent ? ` · served ${c.recent}× lately` : ""}{activeAssignments(svc).some((a) => a.memberId === c.member.id && a.position !== position) ? " · already on" : ""}
        </option>
      ))}
    </select>
  );
}

function AddSong({ svc, earlier }: { svc: Service; earlier: Service[] }) {
  const songs = useApp((s) => s.songs);
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("G");
  const add = () => {
    const t = title.trim();
    if (!t) return;
    const lib = songs.find((s) => s.name.toLowerCase() === t.toLowerCase());
    addSetSong(svc.id, { title: lib?.name ?? t, key, minutes: lib ? Math.max(1, Math.round(lib.duration / 60)) : 5, songId: lib?.id });
    setTitle("");
  };
  return (
    <div className="add-song">
      <input type="text" list="lib-songs" placeholder="Add a song: type a title or pick from your library" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} className="grow" aria-label="Song title" />
      <datalist id="lib-songs">{songs.map((s) => <option key={s.id} value={s.name} />)}</datalist>
      <select value={key} onChange={(e) => setKey(e.target.value)} aria-label="Key">{keyOptions.map((k) => <option key={k} value={k}>{k}</option>)}</select>
      <button type="button" className="btn" onClick={add} disabled={!title.trim()}>Add</button>
      {earlier.length > 0 && (
        <select value="" onChange={(e) => e.target.value && copySetlist(e.target.value, svc.id)} aria-label="Copy a setlist">
          <option value="">Copy a set from…</option>
          {earlier.map((s) => <option key={s.id} value={s.id}>{fmtDate(s.date)} · {s.setlist.length} songs</option>)}
        </select>
      )}
    </div>
  );
}
