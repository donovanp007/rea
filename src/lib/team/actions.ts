"use client";
import { store } from "../store/appStore.ts";
import type { Repository } from "../store/repository.ts";
import { demoTeam, fmtDate } from "./demo.ts";
import { activeAssignments, assignmentWarnings, availabilityOf, availKey, leadersFor, memberById, servingIds, teamById } from "./logic.ts";
import type { Assignment, Avail, Service, SetSong, TeamState, Update, UpdateKind } from "./types.ts";

/**
 * Team planning: availability, rosters, confirmations, service plans and the updates they send.
 * Every change is stored once and the people it affects get an update.
 */
let repo: Repository | null = null;
const uid = () => Math.random().toString(36).slice(2, 10);
const T = (): TeamState => store.state.team!;
const say = (text: string) => store.set({ status: { text, busy: false } });

function commit(next: TeamState) {
  store.set({ team: next });
  void repo?.saveTeam(next);
}
function notify(t: TeamState, kind: UpdateKind, title: string, body: string, recipients: string[], serviceId?: string): TeamState {
  const to = [...new Set(recipients)].filter((r) => r !== t.me); // you don't need to be told about your own change
  if (!to.length) return t;
  const u: Update = { id: uid(), at: Date.now(), kind, title, body, serviceId, recipients: to, readBy: [] };
  return { ...t, updates: [u, ...t.updates].slice(0, 200) };
}
const editService = (t: TeamState, id: string, fn: (s: Service) => Service): TeamState => ({ ...t, services: t.services.map((s) => (s.id === id ? fn(s) : s)) });
const svcOf = (id: string) => T().services.find((s) => s.id === id);
const nameOf = (id: string) => memberById(T(), id)?.name ?? "Someone";

export async function initTeam(r: Repository, practiceSongId?: string) {
  repo = r;
  const saved = await r.loadTeam();
  const team = saved && saved.services?.length ? saved : demoTeam(new Date(), practiceSongId);
  if (!saved) void r.saveTeam(team);
  store.set({ team });
}
export function resetDemo(practiceSongId?: string) {
  commit(demoTeam(new Date(), practiceSongId));
  say("Sample team restored.");
}

/** "Viewing as" switch, so leaders can check what each role sees. */
export const viewAs = (memberId: string) => commit({ ...T(), me: memberId });

/* ---------- availability ---------- */

export function setAvailability(memberId: string, dates: string[], status: Avail | null) {
  let t = T();
  const availability = { ...t.availability };
  for (const d of dates) {
    if (status) availability[availKey(memberId, d)] = status;
    else delete availability[availKey(memberId, d)];
  }
  t = { ...t, availability };
  // changed to unavailable for a date you're already on: tell your leaders
  if (status === "no")
    for (const d of dates)
      for (const svc of t.services.filter((s) => s.date === d)) {
        const mine = activeAssignments(svc).filter((a) => a.memberId === memberId);
        for (const a of mine) t = notify(t, "availability", `${nameOf(memberId)} is now unavailable`, `${a.position} · ${fmtDate(svc.date)} · find cover`, leadersFor(t, a.teamId), svc.id);
      }
  commit(t);
}

/* ---------- roster ---------- */

/** Puts someone on a position (replacing whoever was there), or takes them off if they're already on it. */
export function toggleAssign(serviceId: string, teamId: string, position: string, memberId: string) {
  const svc = svcOf(serviceId);
  if (!svc) return;
  let t = T();
  const existing = svc.assignments.find((a) => a.teamId === teamId && a.position === position && a.status !== "declined");
  if (existing?.memberId === memberId) {
    t = editService(t, serviceId, (s) => ({ ...s, assignments: s.assignments.filter((a) => a.id !== existing.id) }));
    if (svc.status === "published" && existing.status !== "proposed") t = notify(t, "assigned", "Removed from a service", `${position} · ${fmtDate(svc.date)}`, [memberId], serviceId);
    commit(t);
    return;
  }
  const warnings = assignmentWarnings(t, svc, memberId, teamId, position);
  const status: Assignment["status"] = svc.status === "published" ? "requested" : "proposed";
  const next: Assignment = { id: uid(), memberId, teamId, position, status };
  t = editService(t, serviceId, (s) => ({ ...s, assignments: [...s.assignments.filter((a) => !(a.teamId === teamId && a.position === position)), next] }));
  if (status === "requested") t = notify(t, "assigned", "You're scheduled", `${position} · ${fmtDate(svc.date)} · please confirm`, [memberId], serviceId);
  commit(t);
  say(warnings.length ? `${nameOf(memberId)} added. Heads up: ${warnings.join("; ")}.` : status === "requested" ? `${nameOf(memberId)} added and asked to confirm.` : `${nameOf(memberId)} added to the draft.`);
}

export function respond(serviceId: string, assignmentId: string, accept: boolean) {
  const svc = svcOf(serviceId);
  const a = svc?.assignments.find((x) => x.id === assignmentId);
  if (!svc || !a) return;
  let t = editService(T(), serviceId, (s) => ({ ...s, assignments: s.assignments.map((x) => (x.id === assignmentId ? { ...x, status: accept ? "accepted" : "declined" } : x)) }));
  t = accept
    ? notify(t, "accepted", `${nameOf(a.memberId)} confirmed`, `${a.position} · ${fmtDate(svc.date)}`, leadersFor(t, a.teamId), serviceId)
    : notify(t, "declined", `${nameOf(a.memberId)} can't make it`, `${a.position} · ${fmtDate(svc.date)} · this position is open again`, leadersFor(t, a.teamId), serviceId);
  if (!accept) t = { ...t, availability: { ...t.availability, [availKey(a.memberId, svc.date)]: "no" } };
  commit(t);
  say(accept ? "Confirmed. See you there!" : "Declined. Your leader has been told.");
}

/** Sends the roster: drafts become requests and everyone on it is asked to confirm. */
export function publish(serviceId: string) {
  const svc = svcOf(serviceId);
  if (!svc) return;
  let t = editService(T(), serviceId, (s) => ({ ...s, status: "published", assignments: s.assignments.map((a) => (a.status === "proposed" ? { ...a, status: "requested" } : a)) }));
  const asked = svc.assignments.filter((a) => a.status === "proposed");
  for (const a of asked) t = notify(t, "assigned", "You're scheduled", `${a.position} · ${fmtDate(svc.date)} · please confirm`, [a.memberId], serviceId);
  commit(t);
  say(`Published. ${asked.length ? `${asked.length} ${asked.length === 1 ? "person was" : "people were"} asked to confirm.` : "Nobody new to ask."}`);
}

/** Reminds only the people who haven't confirmed yet. */
export function remindPending(serviceId: string) {
  const svc = svcOf(serviceId);
  if (!svc) return;
  const pending = svc.assignments.filter((a) => a.status === "requested").map((a) => a.memberId);
  if (!pending.length) { say("Everyone has replied."); return; }
  commit(notify(T(), "assigned", "Please confirm", `You're scheduled for ${fmtDate(svc.date)}. Tap to confirm or decline.`, pending, serviceId));
  say(`Reminded ${pending.length} ${pending.length === 1 ? "person" : "people"} who haven't replied.`);
}

/* ---------- service plan ---------- */

const KEYS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
export const keyOptions = KEYS;

export function changeKey(serviceId: string, songId: string, key: string) {
  const svc = svcOf(serviceId);
  const song = svc?.setlist.find((s) => s.id === songId);
  if (!svc || !song || song.key === key) return;
  let t = editService(T(), serviceId, (s) => ({ ...s, setlist: s.setlist.map((x) => (x.id === songId ? { ...x, key } : x)) }));
  if (svc.status === "published") t = notify(t, "key", "Key changed", `${song.title} · ${fmtDate(svc.date)} · now in ${key} (was ${song.key})`, servingIds(svc), serviceId);
  commit(t);
  const n = servingIds(svc).filter((id) => id !== T().me).length;
  say(svc.status === "published" ? `Key changed to ${key}. ${n} ${n === 1 ? "person" : "people"} on this service ${n === 1 ? "was" : "were"} notified.` : `Key changed to ${key}.`);
}

export function addSetSong(serviceId: string, song: Omit<SetSong, "id">) {
  const svc = svcOf(serviceId);
  if (!svc) return;
  let t = editService(T(), serviceId, (s) => ({ ...s, setlist: [...s.setlist, { ...song, id: uid() }] }));
  if (svc.status === "published") t = notify(t, "setlist", "Song added", `${song.title} (${song.key}) · ${fmtDate(svc.date)}`, servingIds(svc), serviceId);
  commit(t);
}
/** Edits a setlist song's details that don't need anyone told (tempo, time signature, note). */
export function updateSetSong(serviceId: string, id: string, patch: Partial<Pick<SetSong, "bpm" | "meter" | "note">>) {
  commit(editService(T(), serviceId, (s) => ({ ...s, setlist: s.setlist.map((x) => (x.id === id ? { ...x, ...patch } : x)) })));
}
export function removeSetSong(serviceId: string, songId: string) {
  const svc = svcOf(serviceId);
  const song = svc?.setlist.find((s) => s.id === songId);
  if (!svc || !song) return;
  let t = editService(T(), serviceId, (s) => ({ ...s, setlist: s.setlist.filter((x) => x.id !== songId) }));
  if (svc.status === "published") t = notify(t, "setlist", "Song removed", `${song.title} · ${fmtDate(svc.date)}`, servingIds(svc), serviceId);
  commit(t);
}
export function moveSetSong(serviceId: string, i: number, d: number) {
  commit(editService(T(), serviceId, (s) => {
    const list = s.setlist.slice(), j = i + d;
    if (j < 0 || j >= list.length) return s;
    [list[i], list[j]] = [list[j]!, list[i]!];
    return { ...s, setlist: list };
  }));
}

export function setRehearsal(serviceId: string, date: string, time: string) {
  const svc = svcOf(serviceId);
  if (!svc || (svc.rehearsal.date === date && svc.rehearsal.time === time)) return;
  let t = editService(T(), serviceId, (s) => ({ ...s, rehearsal: { date, time } }));
  if (svc.status === "published") t = notify(t, "rehearsal", "Rehearsal moved", `${fmtDate(date)} at ${time} (for ${fmtDate(svc.date)})`, servingIds(svc), serviceId);
  commit(t);
  say(svc.status === "published" ? "Rehearsal updated and the team notified." : "Rehearsal updated.");
}

/** Copies the setlist of an earlier service into this one. */
export function copySetlist(fromId: string, toId: string) {
  const from = svcOf(fromId);
  if (!from) return;
  commit(editService(T(), toId, (s) => ({ ...s, setlist: from.setlist.map((x) => ({ ...x, id: uid() })) })));
  say(`Copied ${from.setlist.length} songs from ${fmtDate(from.date)}.`);
}

/* ---------- updates ---------- */

export function markAllRead(memberId: string) {
  const t = T();
  commit({ ...t, updates: t.updates.map((u) => (u.recipients.includes(memberId) && !u.readBy.includes(memberId) ? { ...u, readBy: [...u.readBy, memberId] } : u)) });
}

export const teamName = (id: string) => teamById(T(), id)?.name ?? id;
export const availOf = (memberId: string, date: string) => availabilityOf(T(), memberId, date);
