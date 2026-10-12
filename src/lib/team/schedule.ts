import { activeAssignments, availabilityOf, canFill, memberById, recentCount, teamById } from "./logic.ts";
import type { Avail, Service, TeamState } from "./types.ts";

const DAY = 86_400_000;
/** How far back copy-forward looks for who usually plays a position. */
export const LOOKBACK_DAYS = 183;

/** The most recent earlier service a person served on, optionally for one team or position. */
export function lastScheduled(s: TeamState, memberId: string, before: string, where: { teamId?: string; position?: string } = {}): { date: string; title: string; position: string } | null {
  let best: { date: string; title: string; position: string } | null = null;
  for (const v of s.services) {
    if (v.date >= before) continue;
    for (const a of activeAssignments(v)) {
      if (a.memberId !== memberId) continue;
      if (where.teamId && a.teamId !== where.teamId) continue;
      if (where.position && a.position !== where.position) continue;
      if (!best || v.date > best.date) best = { date: v.date, title: v.title, position: a.position };
    }
  }
  return best;
}

export type ConflictKind = "unavailable" | "maybe" | "unanswered" | "double" | "declined";
export interface Conflict { kind: ConflictKind; text: string }

/** Everything that might stop someone being on this service, as short badges for the picker. */
export function conflictsFor(s: TeamState, svc: Service, memberId: string, position?: string): Conflict[] {
  const out: Conflict[] = [];
  const av: Avail | undefined = availabilityOf(s, memberId, svc.date);
  if (av === "no") out.push({ kind: "unavailable", text: "Away" });
  else if (av === "maybe") out.push({ kind: "maybe", text: "Maybe" });
  else if (!av) out.push({ kind: "unanswered", text: "No answer" });
  const other = activeAssignments(svc).find((a) => a.memberId === memberId && a.position !== position);
  if (other) out.push({ kind: "double", text: `Already on ${other.position}` });
  if (svc.assignments.some((a) => a.memberId === memberId && a.status === "declined" && (!position || a.position === position))) out.push({ kind: "declined", text: "Declined this service" });
  return out;
}

export interface Proposal {
  position: string;
  memberId: string;
  /** Why this person: shown beside the name before anything is applied. */
  reason: string;
}

const rank: Record<string, number> = { yes: 0, maybe: 1, undefined: 2 };
const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function openPositions(s: TeamState, svc: Service, teamId: string): string[] {
  const team = teamById(s, teamId);
  if (!team) return [];
  const live = activeAssignments(svc).filter((a) => a.teamId === teamId);
  return team.positions.filter((p) => !live.some((a) => a.position === p));
}

/** Someone who may be put on this service now: right instrument, not away, not already on it or picked. */
function eligible(s: TeamState, svc: Service, memberId: string, teamId: string, position: string, taken: Set<string>): boolean {
  const m = memberById(s, memberId);
  if (!m || taken.has(memberId) || !canFill(m, teamId, position)) return false;
  if (availabilityOf(s, memberId, svc.date) === "no") return false;
  if (activeAssignments(svc).some((a) => a.memberId === memberId)) return false;
  if (svc.assignments.some((a) => a.memberId === memberId && a.status === "declined" && a.position === position)) return false;
  return true;
}

/**
 * Copy forward: for each open position, the person who filled it in the most recent earlier plan or
 * template (within about six months), if they can still do it. Fast way to start from "same as usual".
 */
export function autoAssignPreview(s: TeamState, svc: Service, teamId: string): Proposal[] {
  const taken = new Set<string>();
  const out: Proposal[] = [];
  const from = Date.parse(svc.date) - LOOKBACK_DAYS * DAY;
  const past = s.services.filter((v) => v.date < svc.date && Date.parse(v.date) >= from).sort((a, b) => b.date.localeCompare(a.date));
  for (const position of openPositions(s, svc, teamId)) {
    let found: Proposal | null = null;
    for (const v of past) {
      const a = activeAssignments(v).find((x) => x.teamId === teamId && x.position === position && eligible(s, svc, x.memberId, teamId, position, taken));
      if (a) { found = { position, memberId: a.memberId, reason: `Played ${position} on ${fmt(v.date)}` }; break; }
    }
    if (!found) for (const t of s.templates ?? []) {
      const p = t.positions.find((x) => x.teamId === teamId && x.position === position && eligible(s, svc, x.memberId, teamId, position, taken));
      if (p) { found = { position, memberId: p.memberId, reason: `Usual in “${t.name}”` }; break; }
    }
    if (found) { taken.add(found.memberId); out.push(found); }
  }
  return out;
}

/**
 * Fair rotation: for each open position, the available person who has served least recently.
 * Available beats maybe beats no answer; away is never chosen. Ties go to whoever last served longest ago.
 */
export function autoSchedulePreview(s: TeamState, svc: Service, teamId: string): Proposal[] {
  const taken = new Set<string>();
  const out: Proposal[] = [];
  for (const position of openPositions(s, svc, teamId)) {
    const pool = s.members
      .filter((m) => eligible(s, svc, m.id, teamId, position, taken))
      .map((m) => ({ m, av: availabilityOf(s, m.id, svc.date), recent: recentCount(s, m.id, svc.date), last: lastScheduled(s, m.id, svc.date, { teamId, position })?.date ?? "" }))
      .sort((a, b) => rank[String(a.av)]! - rank[String(b.av)]! || a.recent - b.recent || a.last.localeCompare(b.last) || a.m.name.localeCompare(b.m.name));
    const pick = pool[0];
    if (!pick) continue;
    taken.add(pick.m.id);
    const why = pick.last ? `Last played ${position} on ${fmt(pick.last)}` : `Hasn't played ${position} yet`;
    out.push({ position, memberId: pick.m.id, reason: `${pick.av === "yes" ? "Available" : pick.av === "maybe" ? "Maybe available" : "No answer yet"} · ${why}` });
  }
  return out;
}
