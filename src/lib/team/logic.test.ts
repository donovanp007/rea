import { test } from "node:test";
import assert from "node:assert/strict";
import { assignmentWarnings, candidates, coverage, monthGrid, recentCount, servingIds, sundaysIn } from "./logic.ts";
import type { TeamState } from "./types.ts";

const state: TeamState = {
  church: "Test",
  me: "a",
  teams: [{ id: "drums", name: "Drums", color: "--sec-chorus", positions: ["Drums"] }, { id: "gtr", name: "Guitar", color: "--sec-verse", positions: ["Electric guitar", "Acoustic guitar"] }],
  members: [
    { id: "a", name: "Ann", color: "#555", worshipLeader: true, teams: [{ teamId: "drums", leader: true, positions: ["Drums"] }] },
    { id: "b", name: "Ben", color: "#555", worshipLeader: false, teams: [{ teamId: "drums", leader: false, positions: ["Drums"] }] },
    { id: "c", name: "Cal", color: "#555", worshipLeader: false, teams: [{ teamId: "gtr", leader: false, positions: ["Electric guitar"] }] },
  ],
  services: [
    { id: "s1", date: "2026-10-04", time: "09:00", title: "Sunday", rehearsal: { date: "2026-10-03", time: "16:00" }, status: "published", setlist: [], assignments: [{ id: "x", memberId: "a", teamId: "drums", position: "Drums", status: "accepted" }] },
    { id: "s2", date: "2026-10-11", time: "09:00", title: "Sunday", rehearsal: { date: "2026-10-10", time: "16:00" }, status: "draft", setlist: [], assignments: [{ id: "y", memberId: "c", teamId: "gtr", position: "Electric guitar", status: "declined" }] },
  ],
  availability: { "a|2026-10-11": "yes", "b|2026-10-11": "yes", "c|2026-10-11": "no" },
  updates: [],
};

test("coverage counts filled positions and ignores declines", () => {
  const c = coverage(state.services[1]!, state.teams);
  assert.deepEqual(c.map((x) => [x.team.id, x.filled, x.needed, x.open]), [["drums", 0, 1, ["Drums"]], ["gtr", 0, 2, ["Electric guitar", "Acoustic guitar"]]]);
  assert.deepEqual(servingIds(state.services[1]!), []);
});

test("warns about the wrong instrument, unavailability and double-booking", () => {
  const svc = state.services[1]!;
  assert.deepEqual(assignmentWarnings(state, svc, "b", "drums", "Drums"), []);
  assert.ok(assignmentWarnings(state, svc, "b", "gtr", "Electric guitar")[0]!.includes("isn't set up"));
  assert.ok(assignmentWarnings(state, svc, "c", "gtr", "Electric guitar").some((w) => w.includes("unavailable")));
});

test("suggests available people first, then whoever served least recently", () => {
  const list = candidates(state, state.services[1]!, "drums", "Drums");
  assert.deepEqual(list.map((c) => c.member.id), ["b", "a"], "Ben served less recently than Ann");
  assert.equal(recentCount(state, "a", "2026-10-11"), 1);
});

test("finds Sundays and builds a Monday-first month grid", () => {
  assert.deepEqual(sundaysIn(2026, 9), ["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"]);
  const g = monthGrid(2026, 9);
  assert.equal(g[0]!.date, "2026-09-28");
  assert.equal(g.filter((c) => c.inMonth).length, 31);
  assert.equal(g.length % 7, 0);
});
