import { test } from "node:test";
import assert from "node:assert/strict";
import { barsFor, expandToken, formatTime, numberRepeats, parseArrangement, resolveSections, sectionAt, shortLabel, typeOf } from "./sections.ts";

test("expands Planning Center arrangement shorthand", () => {
  assert.deepEqual(parseArrangement("I, V1, PC, C, V2, C, B, Tag, C, O"), ["Intro", "Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Chorus", "Bridge", "Tag", "Chorus", "Outro"]);
  assert.deepEqual(parseArrangement("Intro → Verse 1 → Chorus"), ["Intro", "Verse 1", "Chorus"]);
  assert.deepEqual(parseArrangement("v1; ch; br2 | inst"), ["Verse 1", "Chorus", "Bridge 2", "Instrumental"]);
  assert.equal(expandToken("   "), null);
  assert.equal(expandToken("vamp section"), "Vamp section");
});

test("classifies labels and makes short codes", () => {
  assert.equal(typeOf("Pre-Chorus 2"), "pre");
  assert.equal(typeOf("Chorus 3"), "chorus");
  assert.equal(typeOf("Ending"), "outro");
  assert.equal(typeOf("Turnaround"), "inst");
  assert.equal(shortLabel("Verse 2"), "V2");
  assert.equal(shortLabel("Pre-Chorus"), "PC");
});

test("numbers repeated sections so pads are distinguishable", () => {
  const out = numberRepeats([{ start: 0, label: "Chorus" }, { start: 10, label: "Verse 1" }, { start: 20, label: "Chorus" }, { start: 30, label: "Chorus" }]);
  assert.deepEqual(out.map((s) => s.label), ["Chorus", "Verse 1", "Chorus 2", "Chorus 3"]);
});

test("resolves ends and finds the section at a time", () => {
  const r = resolveSections([{ start: 0, label: "Intro" }, { start: 8, label: "Verse 1" }], 30);
  assert.equal(r[1]!.end, 30);
  assert.equal(sectionAt(r, 7.9)!.label, "Intro");
  assert.equal(sectionAt(r, 8)!.label, "Verse 1");
});

test("formats times and counts bars", () => {
  assert.equal(formatTime(75.25, true), "1:15.3");
  assert.equal(formatTime(5), "0:05");
  assert.equal(barsFor(16, 120), 8);
  assert.equal(barsFor(16, null), null);
});
