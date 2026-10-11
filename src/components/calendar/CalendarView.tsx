"use client";
import { useState } from "react";
import { setView } from "@/lib/actions";
import { store } from "@/lib/store/appStore";
import { setAvailability, toggleAssign } from "@/lib/team/actions";
import { fmtDate } from "@/lib/team/demo";
import { activeAssignments, availabilityOf, coverage, ledTeams, monthGrid } from "@/lib/team/logic";
import type { Avail, Member, Service, Team, TeamState } from "@/lib/team/types";
import { useTeam } from "@/lib/team/useTeam";
import { AVAIL_LABEL, Avatar } from "../shell/Avatar";
import { ViewAs } from "../shell/ViewAs";

type Mode = "mine" | "roster";

export function CalendarView() {
  const { team, me, isLeader } = useTeam();
  const [mode, setMode] = useState<Mode>("mine");
  if (!team || !me) return null;
  const m = isLeader ? mode : "mine";
  return (
    <section className="view" aria-label="Calendar">
      <div className="vhead">
        <div><h1>Calendar</h1><p>{m === "mine" ? "Tell your leaders which Sundays you can serve." : "Who's available, and who's on, for every Sunday."}</p></div>
        <div className="row">
          {isLeader && (
            <div className="seg" role="group" aria-label="Calendar view">
              <button type="button" aria-pressed={m === "mine"} onClick={() => setMode("mine")}>My availability</button>
              <button type="button" aria-pressed={m === "roster"} onClick={() => setMode("roster")}>Roster</button>
            </div>
          )}
          <ViewAs compact />
        </div>
      </div>
      {m === "mine" ? <MyMonth team={team} me={me} /> : <Roster team={team} me={me} />}
    </section>
  );
}

/* ---------------- my availability ---------------- */

function MyMonth({ team, me }: { team: TeamState; me: Member }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getUTCFullYear(), m: now.getUTCMonth() });
  const [pick, setPick] = useState<Avail | "clear">("yes");
  const cells = monthGrid(ym.y, ym.m);
  const today = now.toISOString().slice(0, 10);
  const svcDates = new Map(team.services.map((s) => [s.date, s]));
  const sundays = cells.filter((c) => c.inMonth && new Date(`${c.date}T12:00:00Z`).getUTCDay() === 0 && c.date >= today).map((c) => c.date);
  const shift = (d: number) => setYm(({ y, m }) => { const t = new Date(Date.UTC(y, m + d, 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() }; });
  const title = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="cal-layout">
      <section className="panel cal">
        <div className="panel-h wrap">
          <div className="row nowrap">
            <button type="button" className="btn sm icon ghost" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
            <h3 style={{ minWidth: 130, textAlign: "center" }}>{title}</h3>
            <button type="button" className="btn sm icon ghost" aria-label="Next month" onClick={() => shift(1)}>›</button>
          </div>
          <button type="button" className="btn sm" disabled={!sundays.length} onClick={() => setAvailability(me.id, sundays, pick === "clear" ? null : pick)}>
            Every Sunday: {pick === "clear" ? "clear" : pick === "no" ? "away" : AVAIL_LABEL[pick].toLowerCase()}
          </button>
        </div>
        <div className="panel-b">
          <div className="seg grid" role="group" aria-label="Tap dates to mark them" style={{ "--cols": 4 } as React.CSSProperties}>
            {(["yes", "maybe", "no", "clear"] as const).map((p) => (
              <button key={p} type="button" aria-pressed={pick === p} onClick={() => setPick(p)}>
                <span className={`swatch ${p}`} aria-hidden /> {p === "clear" ? "Clear" : p === "no" ? "Away" : AVAIL_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="month" role="grid" aria-label={title}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="dow" role="columnheader">{d}</span>)}
            {cells.map((c) => {
              const v = availabilityOf(team, me.id, c.date);
              const svc = svcDates.get(c.date);
              const mine = svc && activeAssignments(svc).find((a) => a.memberId === me.id);
              const past = c.date < today;
              return (
                <button
                  key={c.date}
                  type="button"
                  role="gridcell"
                  className={`day ${v ?? ""}${c.inMonth ? "" : " out"}${svc ? " svc" : ""}${c.date === today ? " today" : ""}`}
                  disabled={past}
                  aria-label={`${fmtDate(c.date, { weekday: "long", day: "numeric", month: "long" })}${svc ? ", service" : ""}${v ? `, ${AVAIL_LABEL[v]}` : ""}${mine ? `, you're on ${mine.position}` : ""}`}
                  onClick={() => setAvailability(me.id, [c.date], pick === "clear" ? null : pick)}
                >
                  <span className="n">{Number(c.date.slice(8))}</span>
                  {mine && <span className="role">{mine.position}</span>}
                  {svc && !mine && <span className="dot" aria-hidden />}
                </button>
              );
            })}
          </div>
          <div className="legend">
            <span><i className="swatch yes" /> Available</span><span><i className="swatch maybe" /> Maybe</span><span><i className="swatch no" /> Unavailable</span>
            <span><i className="ring" /> Service day</span>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-h"><h3>Your Sundays</h3></div>
        <div className="panel-b">
          <ul className="list">
            {team.services.filter((s) => s.date >= today).map((s) => {
              const v = availabilityOf(team, me.id, s.date);
              const mine = activeAssignments(s).find((a) => a.memberId === me.id);
              return (
                <li key={s.id} className="mini-row">
                  <span className={`swatch ${v ?? "none"}`} aria-hidden />
                  <div style={{ minWidth: 0 }}>
                    <b>{fmtDate(s.date, { weekday: "short", day: "numeric", month: "short" })}</b>
                    <span className="note">{mine ? `You're on ${mine.position}` : v ? AVAIL_LABEL[v] : "Not answered"}</span>
                  </div>
                  <button type="button" className="btn sm ghost" onClick={() => { store.set({ openServiceId: s.id }); setView("services"); }}>Plan</button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}

/* ---------------- roster matrix ---------------- */

function Roster({ team, me }: { team: TeamState; me: Member }) {
  const mine = ledTeams(team, me);
  const [filter, setFilter] = useState<string>(me.worshipLeader ? "all" : mine[0]?.id ?? "all");
  const [menu, setMenu] = useState<{ svc: string; member: string; team: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const services = team.services.filter((s) => s.date >= today);
  const shown = filter === "all" ? mine : mine.filter((t) => t.id === filter);
  const allCov = services.map((s) => coverage(s, team.teams));
  const open = allCov.flat().reduce((n, c) => n + c.open.length, 0);
  const awaiting = services.reduce((n, s) => n + s.assignments.filter((a) => a.status === "requested").length, 0);
  const full = allCov.filter((c) => c.every((x) => !x.open.length)).length;

  return (
    <>
      {me.worshipLeader && (
        <div className="stats4">
          <div className="panel stat"><span className="label">Upcoming services</span><b>{services.length}</b></div>
          <div className="panel stat"><span className="label">Fully covered</span><b>{full}/{services.length}</b></div>
          <div className="panel stat"><span className="label">Open positions</span><b className={open ? "warn" : ""}>{open}</b></div>
          <div className="panel stat"><span className="label">Awaiting replies</span><b>{awaiting}</b></div>
        </div>
      )}
      <div className="row chips-row" role="group" aria-label="Sections">
        {me.worshipLeader && <button type="button" className="btn sm" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All sections</button>}
        {mine.map((t) => {
          const gaps = services.reduce((n, s) => n + (coverage(s, [t])[0]?.open.length ?? 0), 0);
          return (
            <button key={t.id} type="button" className="btn sm" aria-pressed={filter === t.id} onClick={() => setFilter(t.id)}>
              <span className="dot" style={{ "--c": `var(${t.color})` } as React.CSSProperties} /> {t.name}{gaps ? <span className="gap">{gaps}</span> : null}
            </button>
          );
        })}
      </div>
      <section className="panel matrix-wrap" aria-label="Roster">
        <div className="matrix" style={{ "--cols": services.length } as React.CSSProperties} role="table">
          <div className="mx-head" role="row">
            <div className="mx-name" role="columnheader"><span className="label">Person</span></div>
            {services.map((s) => (
              <button key={s.id} type="button" className="mx-col" role="columnheader" onClick={() => { store.set({ openServiceId: s.id }); setView("services"); }} title="Open the service plan">
                <b>{fmtDate(s.date, { day: "numeric", month: "short" })}</b>
                <span className={`chip ${s.status === "published" ? "new" : ""}`}>{s.status === "published" ? "Published" : "Draft"}</span>
              </button>
            ))}
          </div>
          {shown.map((t) => (
            <TeamRows key={t.id} team={team} t={t} services={services} menu={menu} setMenu={setMenu} />
          ))}
        </div>
      </section>
      <div className="legend">
        <span><i className="swatch yes" /> Available</span><span><i className="swatch maybe" /> Maybe</span><span><i className="swatch no" /> Unavailable</span><span><i className="swatch none" /> No answer</span>
        <span>· Tap a cell to put someone on or take them off</span>
      </div>
    </>
  );
}

function TeamRows({ team, t, services, menu, setMenu }: { team: TeamState; t: Team; services: Service[]; menu: { svc: string; member: string; team: string } | null; setMenu: (m: { svc: string; member: string; team: string } | null) => void }) {
  const people = team.members.filter((m) => m.teams.some((x) => x.teamId === t.id));
  return (
    <div className="mx-group" role="rowgroup">
      <div className="mx-team" role="row" style={{ "--c": `var(${t.color})` } as React.CSSProperties}>
        <div className="mx-name"><span className="dot" /> <b>{t.name}</b> <span className="note">{t.positions.join(" · ")}</span></div>
        {services.map((s) => {
          const c = coverage(s, [t])[0]!;
          return <div key={s.id} className={`mx-cov ${c.open.length ? "gap" : "ok"}`}>{c.open.length ? `Needs ${c.open.join(", ")}` : `${c.confirmed}/${c.needed} confirmed`}</div>;
        })}
      </div>
      {people.map((p) => {
        const positions = p.teams.find((x) => x.teamId === t.id)!.positions;
        return (
          <div key={p.id} className="mx-row" role="row">
            <div className="mx-name"><Avatar m={p} size={26} /> <span>{p.name}</span>{p.teams.find((x) => x.teamId === t.id)?.leader && <span className="chip">Leader</span>}</div>
            {services.map((s) => {
              const v = availabilityOf(team, p.id, s.date);
              const a = s.assignments.find((x) => x.memberId === p.id && x.teamId === t.id && x.status !== "declined") ?? s.assignments.find((x) => x.memberId === p.id && x.teamId === t.id);
              const elsewhere = activeAssignments(s).find((x) => x.memberId === p.id && x.teamId !== t.id);
              const open = menu?.svc === s.id && menu.member === p.id && menu.team === t.id;
              const click = () => {
                if (a && a.status !== "declined") { toggleAssign(s.id, t.id, a.position, p.id); return; }
                if (positions.length === 1) { toggleAssign(s.id, t.id, positions[0]!, p.id); return; }
                setMenu(open ? null : { svc: s.id, member: p.id, team: t.id });
              };
              return (
                <div key={s.id} className="mx-cellwrap">
                  <button type="button" className={`mx-cell ${v ?? "none"}${a ? ` as-${a.status}` : ""}`} onClick={click}
                    aria-label={`${p.name}, ${fmtDate(s.date)}: ${v ? AVAIL_LABEL[v] : "no answer"}${a ? `, ${a.position} (${a.status})` : ""}`}>
                    {a ? (
                      <>
                        <span className="pos">{a.position}</span>
                        <span className="st">{a.status === "accepted" ? "✓ Confirmed" : a.status === "requested" ? "Awaiting" : a.status === "declined" ? "✕ Declined" : "Draft"}</span>
                      </>
                    ) : elsewhere ? <span className="st">On {elsewhere.position}</span> : <span className="st">{v ? AVAIL_LABEL[v] : "—"}</span>}
                  </button>
                  {open && (
                    <div className="mx-menu" role="menu">
                      {positions.map((pos) => {
                        const who = activeAssignments(s).find((x) => x.teamId === t.id && x.position === pos);
                        return (
                          <button key={pos} type="button" role="menuitem" onClick={() => { toggleAssign(s.id, t.id, pos, p.id); setMenu(null); }}>
                            {pos}{who ? <span className="note"> · replaces {team.members.find((m) => m.id === who.memberId)?.name}</span> : <span className="note"> · open</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
