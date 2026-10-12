import { availKey, sundaysIn } from "./logic.ts";
import type { Assignment, Avail, Member, Service, TeamState, Team } from "./types.ts";

/** Sample team so every screen can be tried before real accounts exist. */
export function demoTeam(now = new Date(), practiceSongId?: string): TeamState {
  const teams: Team[] = [
    { id: "vocals", name: "Vocals", color: "--sec-bridge", positions: ["Lead vocal", "Vocal 2", "Vocal 3"] },
    { id: "keys", name: "Keys", color: "--sec-inst", positions: ["Keys"] },
    { id: "guitar", name: "Guitar", color: "--sec-verse", positions: ["Electric guitar", "Acoustic guitar"] },
    { id: "bass", name: "Bass", color: "--sec-pre", positions: ["Bass"] },
    { id: "drums", name: "Drums", color: "--sec-chorus", positions: ["Drums"] },
  ];
  const m = (id: string, name: string, color: string, teamsOf: [string, boolean, string[]][], worshipLeader = false): Member =>
    ({ id, name, color, worshipLeader, teams: teamsOf.map(([teamId, leader, positions]) => ({ teamId, leader, positions })) });
  const members: Member[] = [
    m("donovan", "Donovan", "#c2410c", [["drums", true, ["Drums"]]], true),
    m("daniel", "Daniel", "#0f766e", [["drums", false, ["Drums"]]]),
    m("joshua", "Joshua", "#4338ca", [["drums", false, ["Drums"]]]),
    m("grace", "Grace", "#9d174d", [["vocals", true, ["Lead vocal", "Vocal 2"]]]),
    m("amelia", "Amelia", "#7c3aed", [["vocals", false, ["Lead vocal", "Vocal 2", "Vocal 3"]]]),
    m("ruth", "Ruth", "#b45309", [["vocals", false, ["Vocal 2", "Vocal 3"]]]),
    m("naledi", "Naledi", "#047857", [["vocals", false, ["Vocal 2", "Vocal 3"]], ["keys", false, ["Keys"]]]),
    m("thabo", "Thabo", "#1d4ed8", [["keys", true, ["Keys"]]]),
    m("michelle", "Michelle", "#be123c", [["keys", false, ["Keys"]]]),
    m("luke", "Luke", "#15803d", [["guitar", true, ["Electric guitar", "Acoustic guitar"]]]),
    m("sipho", "Sipho", "#a16207", [["guitar", false, ["Acoustic guitar"]]]),
    m("ethan", "Ethan", "#0369a1", [["guitar", false, ["Electric guitar"]]]),
    m("kagiso", "Kagiso", "#6d28d9", [["bass", true, ["Bass"]]]),
    m("jared", "Jared", "#475569", [["bass", false, ["Bass"]]]),
  ];

  // the next five Sundays after today
  const today = now.toISOString().slice(0, 10);
  const y = now.getUTCFullYear(), mo = now.getUTCMonth();
  const dates = [...sundaysIn(y, mo), ...sundaysIn(mo === 11 ? y + 1 : y, (mo + 1) % 12), ...sundaysIn(mo >= 10 ? y + 1 : y, (mo + 2) % 12)].filter((d) => d > today).slice(0, 5);

  // deterministic availability: mostly yes, some maybe/no; Donovan hasn't answered the last two
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const availability: Record<string, Avail> = {};
  for (const mem of members)
    dates.forEach((d, i) => {
      if (mem.id === "donovan" && i >= 3) return;
      const r = rnd();
      availability[availKey(mem.id, d)] = r < 0.7 ? "yes" : r < 0.85 ? "maybe" : "no";
    });
  availability[availKey("donovan", dates[0]!)] = "yes";
  availability[availKey("donovan", dates[1]!)] = "no";
  availability[availKey("daniel", dates[1]!)] = "no";
  availability[availKey("joshua", dates[1]!)] = "maybe";

  let n = 0;
  const a = (memberId: string, teamId: string, position: string, status: Assignment["status"]): Assignment => ({ id: `as${++n}`, memberId, teamId, position, status });
  const rehearsalBefore = (d: string) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
  const svc = (i: number, status: Service["status"], assignments: Assignment[], setlist: Service["setlist"]): Service =>
    ({ id: `svc-${dates[i]}`, date: dates[i]!, time: "09:00", title: "Sunday service", rehearsal: { date: rehearsalBefore(dates[i]!), time: "16:00" }, status, assignments, setlist });
  const songs = (keys: string[]) => [
    { id: "ss1", title: "EOY", key: keys[0]!, minutes: 4, songId: practiceSongId },
    { id: "ss2", title: "Sample song: Praise", key: keys[1]!, minutes: 5 },
    { id: "ss3", title: "Sample song: Worship", key: keys[2]!, minutes: 6 },
    { id: "ss4", title: "Sample song: Response", key: keys[3]!, minutes: 5 },
  ];
  const orderOf = (keys: string[]): Service["setlist"] => {
    const [first, ...rest] = songs(keys);
    const h = (id: string, title: string) => ({ id, kind: "header" as const, title, key: "", minutes: 0 });
    const it = (id: string, type: string, title: string, minutes: number) => ({ id, kind: "item" as const, itemType: type, title, key: "", minutes });
    return [it("o1", "welcome", "Welcome", 3), h("o2", "Worship"), first!, ...rest, h("o3", "Word"), it("o4", "scripture", "Scripture reading", 3), it("o5", "message", "#Preacher name here#", 30), it("o6", "offering", "Offering", 5), it("o7", "prayer", "Closing prayer", 3)];
  };
  const services: Service[] = [
    svc(0, "published", [a("grace", "vocals", "Lead vocal", "accepted"), a("amelia", "vocals", "Vocal 2", "accepted"), a("ruth", "vocals", "Vocal 3", "requested"), a("thabo", "keys", "Keys", "accepted"), a("luke", "guitar", "Electric guitar", "accepted"), a("sipho", "guitar", "Acoustic guitar", "accepted"), a("kagiso", "bass", "Bass", "accepted"), a("donovan", "drums", "Drums", "requested")], orderOf(["G", "D", "A", "E"])),
    svc(1, "published", [a("amelia", "vocals", "Lead vocal", "accepted"), a("naledi", "vocals", "Vocal 2", "accepted"), a("ruth", "vocals", "Vocal 3", "accepted"), a("michelle", "keys", "Keys", "accepted"), a("ethan", "guitar", "Electric guitar", "requested"), a("jared", "bass", "Bass", "accepted"), a("daniel", "drums", "Drums", "declined")], orderOf(["A", "G", "D", "B"])),
    svc(2, "draft", [a("grace", "vocals", "Lead vocal", "proposed"), a("thabo", "keys", "Keys", "proposed"), a("joshua", "drums", "Drums", "proposed")], songs(["G", "C", "E", "D"]).slice(0, 2)),
    svc(3, "draft", [], []),
    svc(4, "draft", [], []),
  ];
  const ago = (h: number) => now.getTime() - h * 3_600_000;
  return {
    church: "Your church",
    me: "donovan",
    teams, members, services, availability,
    updates: [
      { id: "u1", at: ago(3), kind: "key", title: "Key changed", body: `Sample song: Worship · ${fmtDate(dates[0]!)} · now in A (was G)`, serviceId: services[0]!.id, recipients: servingOf(services[0]!), readBy: [] },
      { id: "u2", at: ago(20), kind: "declined", title: "Daniel can't play drums", body: `${fmtDate(dates[1]!)} · Drums is open again`, serviceId: services[1]!.id, recipients: ["donovan"], readBy: [] },
      { id: "u3", at: ago(30), kind: "assigned", title: "You're scheduled", body: `Drums · ${fmtDate(dates[0]!)} · please confirm`, serviceId: services[0]!.id, recipients: ["donovan"], readBy: [] },
    ],
  };
}

const servingOf = (s: Service) => [...new Set(s.assignments.filter((x) => x.status !== "declined").map((x) => x.memberId))];

export const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-ZA", { ...opts, timeZone: "UTC" });
