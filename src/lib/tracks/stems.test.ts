import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyStem, jumpTime, sortStems, stemGain, stemName } from "./stems.ts";

test("names stems the way MultiTracks and Loop Community files are named", () => {
  const cases: [string, string][] = [
    ["Click.wav", "click"], ["01 Click Track.mp3", "click"], ["Guide.wav", "guide"], ["Cues.m4a", "guide"],
    ["Drums.wav", "drums"], ["Kick.wav", "drums"], ["Drum Loop.wav", "drums"], ["Perc.wav", "perc"], ["Shaker.wav", "perc"],
    ["Bass.wav", "bass"], ["Synth Bass.wav", "bass"], ["Acoustic Guitar.wav", "ag"], ["AG.wav", "ag"],
    ["EG1.wav", "eg"], ["Electric Guitar 2.wav", "eg"], ["Keys.wav", "keys"], ["Piano.wav", "keys"], ["Rhodes.wav", "keys"],
    ["Synth.wav", "synth"], ["Arp.wav", "synth"], ["Pad.wav", "pad"], ["Strings.wav", "strings"],
    ["Lead Vox.wav", "vox"], ["Vocals.wav", "vox"], ["BGVs.wav", "bgv"], ["Alto.wav", "bgv"], ["Choir.wav", "bgv"],
    ["Way_Maker_Bass_E.wav", "bass"], ["Something.wav", "other"],
  ];
  for (const [file, group] of cases) assert.equal(classifyStem(file), group, file);
});

test("tidies stem names", () => {
  assert.equal(stemName("03 Electric_Guitar.wav"), "Electric Guitar");
  assert.equal(stemName("folder/Click.mp3"), "Click");
});

test("orders the mixer click first, then the band", () => {
  const s = sortStems([{ id: "1", name: "Pad", group: "pad" }, { id: "2", name: "Click", group: "click" }, { id: "3", name: "Bass", group: "bass" }]);
  assert.deepEqual(s.map((x) => x.group), ["click", "bass", "pad"]);
});

test("solo silences other band tracks but never the click", () => {
  const mix = { bass: { vol: 1, mute: false, solo: true }, click: { vol: 0.5, mute: false, solo: false } };
  assert.equal(stemGain("bass", mix), 1);
  assert.equal(stemGain("drums", mix), 0);
  assert.equal(stemGain("click", mix), 0.5);
  assert.equal(stemGain("click", { click: { vol: 1, mute: true, solo: false } }), 0);
});

test("jumps land on the next downbeat or the section end", () => {
  const g = { bpm: 120, barOffset: 0 }; // 2 s bars
  assert.equal(jumpTime(3.1, "bar", g, 16), 4);
  assert.equal(jumpTime(4, "bar", g, 16), 6);
  assert.equal(jumpTime(3.1, "section", g, 16), 16);
  assert.equal(jumpTime(3.1, "now", g, 16), 3.1);
  assert.equal(jumpTime(3.1, "bar", { bpm: null, barOffset: 0 }, 16), 3.1);
});
