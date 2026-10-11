"use client";
import { openSong, setView } from "@/lib/actions";
import { store } from "@/lib/store/appStore";
import { markAllRead, respond, setAvailability } from "@/lib/team/actions";
import { fmtDate } from "@/lib/team/demo";
import { activeAssignments, availabilityOf, coverage, unreadFor } from "@/lib/team/logic";
import type { Avail, Update } from "@/lib/team/types";
import { useTeam } from "@/lib/team/useTeam";
import { STATUS_LABEL } from "../shell/Avatar";
import { ViewAs } from "../shell/ViewAs";

const NEXT: Record<string, Avail | null> = { undefined: "yes", yes: "maybe", maybe: "no", no: null };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const openService = (id: string) => { store.set({ openServiceId: id }); setView("services"); };

export function HomeView() {
  const { team, me, isLeader, isWorshipLeader } = useTeam();
  if (!team || !me) return null;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = team.services.filter((s) => s.date >= today);
  const mine = upcoming.flatMap((svc) => svc.assignments.filter((a) => a.memberId === me.id && a.status !== "declined").map((a) => ({ svc, a })));
  const next = mine[0];
  const dates = upcoming.map((s) => s.date);
  const answered = dates.filter((d) => availabilityOf(team, me.id, d)).length;
  const unread = unreadFor(team, me.id);
  const recent = team.updates.filter((u) => u.recipients.includes(me.id)).slice(0, 6);
  const ledIds = me.worshipLeader ? team.teams.map((t) => t.id) : me.teams.filter((t) => t.leader).map((t) => t.teamId);
  const open = upcoming.reduce((n, s) => n + coverage(s, team.teams.filter((t) => ledIds.includes(t.id))).reduce((a, c) => a + c.open.length, 0), 0);
  const awaiting = upcoming.reduce((n, s) => n + s.assignments.filter((a) => a.status === "requested" && ledIds.includes(a.teamId)).length, 0);
  const firstSong = next?.svc.setlist.find((x) => x.songId);

  return (
    <section className="view home" aria-label="Home">
      <div className="vhead">
        <div>
          <div className="label">{team.church}</div>
          <h1>{greeting()}, {me.name}</h1>
          <p>Your worship week at a glance.</p>
        </div>
        <ViewAs />
      </div>

      <div className="home-grid">
        <div className="col">
          {next ? (
            <section className="panel hero-card">
              <div className="panel-b">
                <div className="row between">
                  <span className="label">You're scheduled</span>
                  <span className={`chip ${next.a.status === "accepted" ? "new" : "cycle"}`}>{STATUS_LABEL[next.a.status]}</span>
                </div>
                <h2 className="hero-date">{fmtDate(next.svc.date, { weekday: "long", day: "numeric", month: "long" })}</h2>
                <div className="facts3">
                  <div><span className="label">Your role</span><b>{next.a.position}</b></div>
                  <div><span className="label">Service</span><b>{next.svc.time}</b></div>
                  <div><span className="label">Rehearsal</span><b>{fmtDate(next.svc.rehearsal.date, { weekday: "short" })} {next.svc.rehearsal.time}</b></div>
                </div>
                {next.a.status === "requested" && (
                  <div className="row">
                    <button type="button" className="btn primary grow" onClick={() => respond(next.svc.id, next.a.id, true)}>Confirm</button>
                    <button type="button" className="btn grow" onClick={() => respond(next.svc.id, next.a.id, false)}>Can't make it</button>
                  </div>
                )}
                <div className="row">
                  <button type="button" className="btn sm" onClick={() => openService(next.svc.id)}>Open service plan</button>
                  {firstSong?.songId && <button type="button" className="btn sm" onClick={() => void openSong(firstSong.songId!)}>Practise the set</button>}
                  <span className="note">{next.svc.setlist.length} songs · {next.svc.setlist.map((x) => `${x.title.replace("Sample song: ", "")} (${x.key})`).join(" · ")}</span>
                </div>
              </div>
            </section>
          ) : (
            <section className="panel"><div className="panel-b"><span className="label">Next up</span><p className="muted" style={{ margin: 0 }}>You're not scheduled for any upcoming services yet.</p></div></section>
          )}

          <section className="panel" aria-label="Your availability">
            <div className="panel-h">
              <h3>Your availability</h3>
              <span className={`chip ${answered === dates.length ? "new" : "cycle"}`}>{answered} of {dates.length} answered</span>
            </div>
            <div className="panel-b">
              <p className="note">Tap a date to change it: available, maybe, unavailable.</p>
              <div className="avail-chips">
                {dates.map((d) => {
                  const v = availabilityOf(team, me.id, d);
                  const on = activeAssignments(upcoming.find((s) => s.date === d)!).some((a) => a.memberId === me.id);
                  return (
                    <button key={d} type="button" className={`avail-chip ${v ?? "none"}`} onClick={() => setAvailability(me.id, [d], NEXT[String(v)] ?? null)} aria-label={`${fmtDate(d)}: ${v ?? "not answered"}`}>
                      <span className="d">{fmtDate(d, { day: "numeric" })}</span>
                      <span className="m">{fmtDate(d, { month: "short" })}</span>
                      <span className="s">{v === "yes" ? "Available" : v === "maybe" ? "Maybe" : v === "no" ? "Away" : "Tap to answer"}</span>
                      {on && <i className="on" title="You're scheduled" />}
                    </button>
                  );
                })}
              </div>
              <div className="row">
                <button type="button" className="btn sm" onClick={() => setAvailability(me.id, dates.filter((d) => !availabilityOf(team, me.id, d)), "yes")} disabled={answered === dates.length}>Mark the rest available</button>
                <button type="button" className="btn sm ghost" onClick={() => setView("calendar")}>Open calendar</button>
              </div>
            </div>
          </section>
        </div>

        <div className="col">
          {isLeader && (
            <section className="panel" aria-label="Needs attention">
              <div className="panel-h"><h3>{isWorshipLeader ? "Across all teams" : "Your section"}</h3><button type="button" className="btn sm ghost" onClick={() => setView("calendar")}>Schedule</button></div>
              <div className="panel-b stats2">
                <div className="stat"><span className="label">Open positions</span><b className={open ? "warn" : ""}>{open}</b></div>
                <div className="stat"><span className="label">Awaiting replies</span><b>{awaiting}</b></div>
                <p className="note" style={{ gridColumn: "1 / -1" }}>Across the next {upcoming.length} Sundays, including ones still in draft.</p>
              </div>
            </section>
          )}
          <section className="panel" aria-label="Updates">
            <div className="panel-h">
              <h3>Updates {unread.length > 0 && <span className="count new" style={{ marginLeft: 6 }}>{unread.length}</span>}</h3>
              {unread.length > 0 && <button type="button" className="btn sm ghost" onClick={() => markAllRead(me.id)}>Mark all read</button>}
            </div>
            <div className="panel-b">
              {!recent.length ? <p className="note">Nothing new. Changes to your services show up here.</p> : (
                <ul className="updates">
                  {recent.map((u) => <UpdateRow key={u.id} u={u} unread={!u.readBy.includes(me.id)} />)}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

const ICON: Record<Update["kind"], string> = { key: "♯", assigned: "✓", accepted: "✓", declined: "!", availability: "!", published: "↗", setlist: "♪", rehearsal: "◷" };

export function UpdateRow({ u, unread }: { u: Update; unread: boolean }) {
  const ago = (() => { const m = Math.round((Date.now() - u.at) / 60000); return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; })();
  return (
    <li className={`update ${u.kind}${unread ? " unread" : ""}`}>
      <span className="ic" aria-hidden>{ICON[u.kind]}</span>
      <div style={{ minWidth: 0 }}>
        <b>{u.title}</b>
        <span>{u.body}</span>
      </div>
      <time className="mono">{ago}</time>
      {u.serviceId && <button type="button" className="stretch" aria-label={`Open: ${u.title}`} onClick={() => openService(u.serviceId!)} />}
    </li>
  );
}
