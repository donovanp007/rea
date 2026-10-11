import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspectTemplate, renderAls, sigValue, templateGroup } from "./als.ts";
import { FIXTURE } from "./fixture.ts";
import { buildSession, cueSheet, type SessionSongInput } from "./session.ts";
import { concat, crc32, wavSampleRate, zipParts } from "./zip.ts";
import { encodeWav } from "../audio/demoSong.ts";

const song = (title: string, bpm: number, extra: Partial<SessionSongInput> = {}): SessionSongInput => ({
  title, bpm, sig: { num: 4, den: 4 }, duration: 60, barOffset: 0,
  sections: [{ label: "Intro", start: 0 }, { label: "Verse 1", start: 8 }, { label: "Chorus", start: 24 }],
  stems: [{ name: "Click", group: "click", file: `${title} - Click.wav` }, { name: "Drums", group: "drums", file: `${title} - Drums.wav` }],
  ...extra,
});

test("lays songs end to end on bar lines with their own tempo", () => {
  const s = buildSession([song("A", 120), song("B", 90, { sig: { num: 6, den: 8 } })]);
  // A: 60 s at 120 BPM = 120 beats, then 2 bars of 4/4 gap
  assert.equal(s.songs[0]!.start, 0);
  assert.equal(s.songs[0]!.end, 120);
  assert.equal(s.songs[1]!.start, 128);
  assert.deepEqual(s.tempo, [{ beat: 0, bpm: 120 }, { beat: 128, bpm: 90 }]);
  assert.deepEqual(s.sig.map((x) => `${x.num}/${x.den}`), ["4/4", "6/8"]);
  // B: 60 s at 90 BPM = 90 beats
  assert.equal(s.songs[1]!.end, 218);
  assert.deepEqual(s.locators.map((l) => `${l.beat} ${l.name}`), ["0 A", "16 Verse 1", "48 Chorus", "120 STOP", "128 B", "140 Verse 1", "164 Chorus", "218 STOP"]);
  assert.deepEqual(s.tracks.map((t) => `${t.name}:${t.clips.length}`), ["Click:2", "Drums:2"]);
});

test("a pickup before the first downbeat gets its own bar so bar 1 is the downbeat", () => {
  const s = buildSession([song("A", 120, { barOffset: 1 })]); // 2 beats of pickup
  assert.equal(s.songs[0]!.downbeat, 4);
  assert.equal(s.tracks[0]!.clips[0]!.start, 2);
});

test("two stems in one group go on two tracks", () => {
  const s = buildSession([song("A", 120, { stems: [{ name: "EG1", group: "eg", file: "a.wav" }, { name: "EG2", group: "eg", file: "b.wav" }] })]);
  assert.deepEqual(s.tracks.map((t) => t.name), ["Electric", "Electric 2"]);
});

test("cue sheet lists songs and sections", () => {
  const txt = cueSheet(buildSession([song("A", 120), song("B", 90)]));
  assert.match(txt, /1\. A — 120 BPM, 4\/4, starts bar 1/);
  assert.match(txt, /2\. B — 90 BPM/);
  assert.match(txt, /Chorus/);
});

test("Ableton encodes time signatures like 4/4 → 201", () => {
  assert.equal(sigValue(4, 4), 201);
  assert.equal(sigValue(3, 4), 200);
  assert.equal(sigValue(6, 8), 302);
});

test("reads a template set", () => {
  const info = inspectTemplate(FIXTURE);
  assert.ok(info.ok, info.problems.join());
  assert.equal(info.major, 11);
  assert.deepEqual(info.audioTracks, ["1-Audio", "Click"]);
  assert.equal(info.otherTracks, 1);
  assert.ok(info.hasClip && info.hasLocator);
  assert.ok(!inspectTemplate("<html></html>").ok);
  assert.equal(templateGroup('<Name><EffectiveName Value="Click" /><UserName Value="Click" /></Name>'), "click");
  assert.equal(templateGroup('<Name><EffectiveName Value="1-Audio" /><UserName Value="" /></Name>'), null);
});

test("writes a set: named template tracks keep routing, others are cloned, tempo and locators set", () => {
  const session = buildSession([song("A", 120), song("B", 90, { sig: { num: 6, den: 8 } })]);
  const xml = renderAls(FIXTURE, session);
  // the Click track kept its in-ear routing and got both songs' click clips
  const click = /<AudioTrack Id="9">[\s\S]*?<\/AudioTrack>/.exec(xml)![0];
  assert.match(click, /AudioOut\/External\/S2/);
  assert.equal((click.match(/<AudioClip /g) ?? []).length, 2);
  // a Drums track was made from the plain 1-Audio track, which is gone
  assert.match(xml, /<UserName Value="Drums"/);
  assert.doesNotMatch(xml, /EffectiveName Value="1-Audio"/);
  // the MIDI track is untouched
  assert.match(xml, /<MidiTrack Id="10">/);
  // clips point into the project's Samples folder and play at the song tempo
  assert.match(xml, /<RelativePath Value="Samples\/Imported\/B - Drums.wav"/);
  assert.match(xml, /<WarpMarker Id="1" SecTime="0.666667" BeatTime="1" \/>/);
  assert.match(xml, /<AudioClip Id="1" Time="128"/);
  // tempo steps from 120 to 90 at beat 128; 6/8 starts there
  assert.match(xml, /<PointeeId Value="8" \/>[\s\S]*Time="128" Value="120"[\s\S]*Time="128" Value="90"/);
  assert.match(xml, /<EnumEvent Id="1" Time="128" Value="302" \/>/);
  // locators replaced, transport at the top with loop off
  assert.equal((xml.match(/<Locator Id=/g) ?? []).length, session.locators.length);
  assert.match(xml, /<Name Value="Chorus" \/>/);
  assert.match(xml, /<CurrentTime Value="0"/);
  assert.match(xml, /<Transport>[\s\S]*<LoopOn Value="false"/);
  // every automation/pointee id is unique, and below NextPointeeId
  const ids = [...xml.matchAll(/<(?:\w*Target|Pointee)\s+Id="(\d+)"/g)].map((m) => +m[1]!);
  assert.equal(new Set(ids).size, ids.length);
  const next = +/<NextPointeeId Value="(\d+)"/.exec(xml)![1]!;
  assert.ok(ids.every((i) => i < next));
  // track ids unique
  const tids = [...xml.matchAll(/<(?:AudioTrack|MidiTrack|GroupTrack) Id="(\d+)"/g)].map((m) => m[1]);
  assert.equal(new Set(tids).size, tids.length);
});

test("zip files open with a standard unzip tool", () => {
  assert.equal(crc32(new TextEncoder().encode("hello")), 0x3610a686);
  const data = concat(zipParts([{ name: "Set Project/Set.als", data: new TextEncoder().encode("<xml/>") }, { name: "Set Project/Samples/Imported/a.wav", data: new Uint8Array([1, 2, 3]) }]));
  const dir = mkdtempSync(join(tmpdir(), "zip-"));
  const f = join(dir, "t.zip");
  writeFileSync(f, data);
  const out = execFileSync("python3", ["-c", "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip()); print(','.join(z.namelist()))", f]).toString();
  assert.match(out, /^None\nSet Project\/Set.als,Set Project\/Samples\/Imported\/a.wav/);
});

test("reads a WAV file's sample rate", () => {
  assert.equal(wavSampleRate(new Uint8Array(encodeWav(new Float32Array(10), 22050))), 22050);
  assert.equal(wavSampleRate(new Uint8Array(40)), undefined);
});
