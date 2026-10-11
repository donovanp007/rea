import type { Assignment, Avail, Member, Service, Team, TeamState, Update } from "./types.ts";

export const availKey = (memberId: string, date: string) => `${memberId}|${date}`;
export const availabilityOf = (s: TeamState, memberId: string, date: string): Avail | undefined => s.availability[availKey(memberId, date)];

export const memberById = (s: TeamState, id: string) => s.members.find((m) => m.id === id);
export const teamById = (s: TeamState, id: string) => s.teams.find((t) => t.id === id);
export const isLeaderOf = (m: Member | undefined, teamId: string) => !!m && (m.worshipLeader || m.teams.some((t) => t.teamId === teamId && t.leader));
export const ledTeams = (s: TeamState, m: Member | undefined) => (m?.worshipLeader ? s.teams : s.teams.filter((t) => m?.teams.some((x) => x.teamId === t.id && x.leader)));
export const canFill = (m: Member, teamId: string, position: string) => m.teams.some((t) => t.teamId === teamId && t.positions.includes(position));

/** Live assignments (declines don't fill a position). */
export const activeAssignments = (svc: Service) => svc.assignments.filter((a) => a.status !== "declined");

export interface Coverage {
  team: Team;
  needed: number;
  filled: number;
  confirmed: number;
  open: string[];
}

/** How well each section is covered for a service. */
export function coverage(svc: Service, teams: Team[]): Coverage[] {
  return teams.map((team) => {
    const live = activeAssignments(svc).filter((a) => a.teamId === team.id);
    const open = team.positions.filter((p) => !live.some((a) => a.position === p));
    return { team, needed: team.positions.length, filled: team.positions.length - open.length, confirmed: live.filter((a) => a.status === "accepted").length, open };
  });
}

/** Problems with putting someone on a position, shown before the roster goes out. */
export function assignmentWarnings(s: TeamState, svc: Service, memberId: string, teamId: string, position: string): string[] {
  const m = memberById(s, memberId);
  if (!m) return ["Unknown person"];
  const out: string[] = [];
  if (!canFill(m, teamId, position)) out.push(`${m.name} isn't set up to play ${position}`);
  const av = availabilityOf(s, memberId, svc.date);
  if (av === "no") out.push(`${m.name} marked this date unavailable`);
  else if (av === "maybe") out.push(`${m.name} might not be available`);
  else if (!av) out.push(`${m.name} hasn't given availability yet`);
  const other = activeAssignments(svc).find((a) => a.memberId === memberId && !(a.teamId === teamId && a.position === position));
  if (other) out.push(`${m.name} is already on ${other.position} this service`);
  return out;
}

/** People who can fill a position, best options first: available, then fewest recent services. */
export function candidates(s: TeamState, svc: Service, teamId: string, position: string) {
  const rank: Record<string, number> = { yes: 0, maybe: 1, undefined: 2, no: 3 };
  return s.members
    .filter((m) => canFill(m, teamId, position))
    .map((m) => ({ member: m, avail: availabilityOf(s, m.id, svc.date), recent: recentCount(s, m.id, svc.date), warnings: assignmentWarnings(s, svc, m.id, teamId, position) }))
    .sort((a, b) => rank[String(a.avail)]! - rank[String(b.avail)]! || a.recent - b.recent || a.member.name.localeCompare(b.member.name));
}

/** Services this person served (not declined) in the four weeks before a date: for fair rotation. */
export function recentCount(s: TeamState, memberId: string, date: string): number {
  const end = Date.parse(date), start = end - 28 * 86_400_000;
  return s.services.filter((v) => { const t = Date.parse(v.date); return t < end && t >= start && activeAssignments(v).some((a) => a.memberId === memberId); }).length;
}

/** Everyone currently on a service (not declined). */
export const servingIds = (svc: Service) => [...new Set(activeAssignments(svc).map((a) => a.memberId))];

/** Leaders of a section plus the worship leaders. */
export const leadersFor = (s: TeamState, teamId: string) => s.members.filter((m) => m.worshipLeader || m.teams.some((t) => t.teamId === teamId && t.leader)).map((m) => m.id);

export const assignmentsFor = (s: TeamState, memberId: string) =>
  s.services.flatMap((svc) => svc.assignments.filter((a) => a.memberId === memberId).map((a) => ({ svc, a })))
    .sort((x, y) => x.svc.date.localeCompare(y.svc.date));

/** Sundays (or any service dates) a member hasn't answered for in a set of dates. */
export const unanswered = (s: TeamState, memberId: string, dates: string[]) => dates.filter((d) => !availabilityOf(s, memberId, d));

export const unreadFor = (s: TeamState, memberId: string): Update[] =>
  s.updates.filter((u) => u.recipients.includes(memberId) && !u.readBy.includes(memberId));

/** Each Sunday in a month as YYYY-MM-DD. */
export function sundaysIn(year: number, month: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(year, month, 1));
  while (d.getUTCMonth() === month) {
    if (d.getUTCDay() === 0) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Cells for a Monday-first month grid, including leading/trailing days from neighbouring months. */
export function monthGrid(year: number, month: number): { date: string; inMonth: boolean }[] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month, 1 - lead));
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push({ date: d.toISOString().slice(0, 10), inMonth: d.getUTCMonth() === month });
    if (i >= 34 && d.getUTCMonth() !== month && d.getUTCDay() === 0) break;
  }
  return cells;
}

export const isPending = (a: Assignment) => a.status === "requested";
