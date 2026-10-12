import assert from "node:assert/strict";
import { test } from "node:test";
import { autoAssignPreview, autoSchedulePreview, conflictsFor, lastScheduled } from "./schedule.ts";
import { applyOrder, clock, isPlaceholder, moveTo, sectionTotals, songsOf, templateFromService, timeline, toMinutes } from "./plan.ts";
import type { Assignment, Service, SetSong, TeamState } from "./types.ts";

const item = (id: string, kind: SetSong["kind"], minutes: number, title = id): SetSong => ({ id, kind, title, key: "G", minutes });
const svc = (id: string, date: string, setlist: SetSong[], assignments: Assignment[] = [], time = "09:00"): Service =>
  ({ id, date, time, title: "Sunday", rehearsal: { date, time: "16:00" }, status: "draft", setlist, assignments });
const as = (id: string, memberId: string, position: string, status: Assignment["status"] = "accepted"): Assignment => ({ id, memberId, teamId: "drums", position, status });

test("the running clock adds up from the service start and ignores headers", () => {
  const s = svc("s", "2026-11-01", [item("h1", "header", 0), item("w", "item", 3), item("a", "song", 5), item("b", undefined, 6), item("m", "item", 30)]);
  const t = timeline(s);
  assert.deepEqual(t.rows.map((r) => `${r.start}-${r.end}`), ["09:00-09:00", "09:00-09:03", "09:03-09:08", "09:08-09:14", "09:14-09:44"]);
  assert.equal(t.total, 44);
  assert.equal(t.music, 11); // a song with no kind is a song
  assert.equal(t.end, "09:44");
  assert.equal(songsOf(s).length, 2);
  assert.deepEqual(sectionTotals(s.setlist), { h1: 44 });
});

test("times wrap past midnight and read bad input as 09:00", () => {
  assert.equal(toMinutes("10:30"), 630);
  assert.equal(toMinutes("later"), 540);
  assert.equal(clock(1450), "00:10");
});

test("a saved drag order always keeps every item once", () => {
  const items = [item("a", "song", 1), item("b", "song", 1), item("c", "song", 1)];
  assert.deepEqual(applyOrder(items, ["c", "a", "b"]).map((i) => i.id), ["c", "a", "b"]);
  assert.deepEqual(applyOrder(items, ["c", "x", "c"]).map((i) => i.id), ["c", "a", "b"]); // missing items stay, duplicates and unknown ids dropped
  assert.deepEqual(moveTo(items, "a", 2), ["b", "c", "a"]);
  assert.deepEqual(moveTo(items, "c", 0), ["c", "a", "b"]);
  assert.deepEqual(moveTo(items, "zzz", 0), ["a", "b", "c"]);
});

test("templates keep the order and the usual people", () => {
  const s = svc("s", "2026-11-01", [item("a", "song", 4)], [as("1", "ann", "Drums"), as("2", "bob", "Drums", "declined")]);
  const t = templateFromService(s, "Normal Sunday", "t1");
  assert.equal(t.items.length, 1);
  assert.deepEqual(t.positions, [{ teamId: "drums", position: "Drums", memberId: "ann" }]);
});

const state = (): TeamState => ({
  church: "T", me: "ann",
  teams: [{ id: "drums", name: "Drums", color: "--sec-chorus", positions: ["Drums"] }, { id: "keys", name: "Keys", color: "--sec-inst", positions: ["Keys"] }],
  members: [
    { id: "ann", name: "Ann", color: "#111", worshipLeader: true, teams: [{ teamId: "drums", leader: true, positions: ["Drums"] }] },
    { id: "ben", name: "Ben", color: "#111", worshipLeader: false, teams: [{ teamId: "drums", leader: false, positions: ["Drums"] }, { teamId: "keys", leader: false, positions: ["Keys"] }] },
    { id: "cal", name: "Cal", color: "#111", worshipLeader: false, teams: [{ teamId: "drums", leader: false, positions: ["Drums"] }] },
  ],
  services: [
    svc("s1", "2026-09-06", [], [as("1", "ann", "Drums")]),
    svc("s2", "2026-09-13", [], [as("2", "ann", "Drums")]),
    svc("s3", "2026-09-20", [], [as("3", "ben", "Drums")]),
    svc("s4", "2026-09-27", []),
  ],
  availability: { "ann|2026-09-27": "yes", "ben|2026-09-27": "yes", "cal|2026-09-27": "yes" },
  updates: [],
});

test("finds when someone last served", () => {
  const s = state();
  assert.equal(lastScheduled(s, "ann", "2026-09-27")?.date, "2026-09-13");
  assert.equal(lastScheduled(s, "cal", "2026-09-27"), null);
  assert.equal(lastScheduled(s, "ann", "2026-09-13", { position: "Drums" })?.date, "2026-09-06");
});

test("copy forward uses whoever played last time, if they can still do it", () => {
  const s = state();
  assert.deepEqual(autoAssignPreview(s, s.services[3]!, "drums").map((p) => `${p.position}:${p.memberId}`), ["Drums:ben"]);
  // the usual drummer is away, so the one before that is used
  s.availability["ben|2026-09-27"] = "no";
  assert.deepEqual(autoAssignPreview(s, s.services[3]!, "drums").map((p) => p.memberId), ["ann"]);
  // everyone with history is away: a template fills the gap
  s.availability["ann|2026-09-27"] = "no";
  s.templates = [{ id: "t", name: "Usual", items: [], positions: [{ teamId: "drums", position: "Drums", memberId: "cal" }] }];
  assert.deepEqual(autoAssignPreview(s, s.services[3]!, "drums").map((p) => [p.memberId, p.reason]), [["cal", "Usual in “Usual”"]]);
});

test("copy forward ignores plans older than six months", () => {
  const s = state();
  s.services[0]!.date = "2025-01-05";
  s.services[1]!.date = "2025-01-12";
  s.services[2]!.date = "2025-01-19";
  assert.deepEqual(autoAssignPreview(s, s.services[3]!, "drums"), []);
});

test("rotation picks the available person who has served least, never someone away", () => {
  const s = state();
  assert.equal(autoSchedulePreview(s, s.services[3]!, "drums")[0]!.memberId, "cal"); // never served in the last 4 weeks
  s.availability["cal|2026-09-27"] = "no";
  assert.equal(autoSchedulePreview(s, s.services[3]!, "drums")[0]!.memberId, "ben"); // served once, ann twice
  s.availability["ben|2026-09-27"] = "maybe";
  assert.equal(autoSchedulePreview(s, s.services[3]!, "drums")[0]!.memberId, "ann"); // a yes beats a maybe
});

test("one person isn't picked for two positions, and filled positions are left alone", () => {
  const s = state();
  s.teams[0]!.positions = ["Drums", "Drums 2"];
  s.members.forEach((m) => m.teams.forEach((t) => { if (t.teamId === "drums") t.positions = ["Drums", "Drums 2"]; }));
  const p = autoSchedulePreview(s, s.services[3]!, "drums");
  assert.equal(p.length, 2);
  assert.notEqual(p[0]!.memberId, p[1]!.memberId);
  s.services[3]!.assignments.push(as("z", "cal", "Drums"));
  assert.deepEqual(autoSchedulePreview(s, s.services[3]!, "drums").map((x) => x.position), ["Drums 2"]);
});

test("conflict badges", () => {
  const s = state();
  s.availability["cal|2026-09-27"] = "no";
  assert.deepEqual(conflictsFor(s, s.services[3]!, "cal").map((c) => c.kind), ["unavailable"]);
  assert.deepEqual(conflictsFor(s, s.services[3]!, "ann").map((c) => c.kind), []);
  s.services[3]!.assignments.push(as("k", "ben", "Keys"));
  assert.deepEqual(conflictsFor(s, s.services[3]!, "ben", "Drums").map((c) => c.kind), ["double"]);
});

test("template placeholders are recognised", () => {
  assert.ok(isPlaceholder(item("p", "item", 30, "#Pastor name here#")));
  assert.ok(isPlaceholder(item("p", "item", 5, "TBC")));
  assert.ok(!isPlaceholder(item("p", "item", 5, "Offering")));
});
