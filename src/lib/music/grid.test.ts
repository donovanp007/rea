import { test } from "node:test";
import assert from "node:assert/strict";
import { barBeatAt, describeLength, snapTime } from "./grid.ts";

const g = { bpm: 120, barOffset: 0.5 }; // beats every 0.5 s, bars every 2 s from 0.5 s

test("snaps to beats and bars from the first downbeat", () => {
  assert.equal(snapTime(1.74, g, "beat"), 1.5);
  assert.equal(snapTime(1.76, g, "beat"), 2);
  assert.equal(snapTime(1.4, g, "bar"), 0.5);
  assert.equal(snapTime(1.6, g, "bar"), 2.5);
  assert.equal(snapTime(1.234, g, "off"), 1.234);
  assert.equal(snapTime(1.234, { bpm: null, barOffset: 0 }, "beat"), 1.234);
});

test("reports bar and beat", () => {
  assert.deepEqual(barBeatAt(0.5, g), { bar: 1, beat: 1 });
  assert.deepEqual(barBeatAt(2.0, g), { bar: 1, beat: 4 });
  assert.deepEqual(barBeatAt(2.5, g), { bar: 2, beat: 1 });
  assert.equal(barBeatAt(1, { bpm: null, barOffset: 0 }), null);
});

test("describes loop lengths musically", () => {
  assert.equal(describeLength(4, g), "2 bars");
  assert.equal(describeLength(3, g), "1 bar 2 beats");
  assert.equal(describeLength(0.5, g), "1 beat");
  assert.equal(describeLength(2.25, { bpm: null, barOffset: 0 }), "2.3s");
});
