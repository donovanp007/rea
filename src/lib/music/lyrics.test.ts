import { test } from "node:test";
import assert from "node:assert/strict";
import { headingsOf, lyricsFor, parseLyrics } from "./lyrics.ts";

const SHEET = `[Verse 1]
Line one

Chorus:
Sing it out

Verse 2
Line two

BRIDGE
Lift it up`;

test("splits a chart at section headings in several styles", () => {
  const b = parseLyrics(SHEET);
  assert.deepEqual(b.map((x) => x.label), ["Verse 1", "Chorus", "Verse 2", "Bridge"]);
  assert.equal(b[1]!.text, "Sing it out");
  assert.deepEqual(headingsOf(SHEET), ["Verse 1", "Chorus", "Verse 2", "Bridge"]);
});

test("repeated choruses reuse the chorus words; verses must match by number", () => {
  assert.equal(lyricsFor(SHEET, "Chorus 3")!.text, "Sing it out");
  assert.equal(lyricsFor(SHEET, "Verse 2")!.text, "Line two");
  assert.equal(lyricsFor(SHEET, "Verse 3"), null);
  assert.equal(lyricsFor(SHEET, "Bridge 2")!.text, "Lift it up");
});

test("keeps unlabelled text and ignores empty input", () => {
  assert.deepEqual(parseLyrics("Just some words\nmore"), [{ label: "", text: "Just some words\nmore" }]);
  assert.deepEqual(parseLyrics(""), []);
});
