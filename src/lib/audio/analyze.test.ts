import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSamples, sectionsFromOrder } from "./analyze.ts";
import { DEMO_ARRANGEMENT, DEMO_BPM, DEMO_STRUCTURE, renderDemoSong } from "./demoSong.ts";
import { parseArrangement } from "../music/sections.ts";

const SR = 22050;
const result = analyzeSamples(renderDemoSong(SR), SR);

test("finds every section boundary of the demo song within a tenth of a second", () => {
  assert.equal(result.sections.length, DEMO_STRUCTURE.length);
  result.sections.forEach((s, i) => assert.ok(Math.abs(s.start - DEMO_STRUCTURE[i]!.start) < 0.1, `${s.label} at ${s.start}, expected ${DEMO_STRUCTURE[i]!.start}`));
});

test("labels the demo song's sections correctly", () => {
  assert.deepEqual(result.sections.map((s) => s.label), DEMO_STRUCTURE.map((s) => s.label));
});

test("detects the tempo", () => {
  assert.ok(result.tempo);
  assert.ok(Math.abs(result.tempo.bpm - DEMO_BPM) <= 1, `bpm ${result.tempo.bpm}`);
});

test("splits by a Planning Center arrangement order", () => {
  const secs = sectionsFromOrder(result.analysis, result.duration, parseArrangement(DEMO_ARRANGEMENT), result.tempo);
  assert.deepEqual(secs.map((s) => s.label), ["Intro", "Verse 1", "Chorus", "Verse 2", "Chorus 2", "Bridge", "Chorus 3", "Outro"]);
  secs.forEach((s, i) => assert.ok(Math.abs(s.start - DEMO_STRUCTURE[i]!.start) < 0.1));
});

test("always returns the requested number of sections, even with few clear changes", () => {
  const silence = analyzeSamples(new Float32Array(SR * 40), SR);
  const secs = sectionsFromOrder(silence.analysis, silence.duration, ["Intro", "Verse 1", "Chorus", "Outro"]);
  assert.equal(secs.length, 4);
  for (let i = 1; i < secs.length; i++) assert.ok(secs[i]!.start > secs[i - 1]!.start);
});

test("snaps edges onto bar lines and finds the downbeat", async () => {
  const { snapToBars } = await import("./analyze.ts");
  // 120 BPM: bars every 2 s; beat phase given as an off-beat (0.5 s); edges slightly off
  const r = snapToBars([7.7, 16.3, 24.1, 33.0], { bpm: 120, offset: 0.5 });
  assert.equal(r.barOffset, 0);
  assert.deepEqual(r.times.slice(0, 3), [8, 16, 24]);
  assert.equal(r.times[3], 33.0, "edges far from a bar line are left alone");
});
