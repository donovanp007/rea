# Practice Looper

A practice app for bands and worship teams. Add a song and it splits into **Intro, Verse,
Chorus, Bridge…** automatically, so you can loop the part you're learning, slow it down
without changing the key, and drill a set list before Sunday.

## What it does

| Area | Features |
|---|---|
| **Practice** | Waveform with coloured sections and bar lines. Section pads like an Ableton clip launcher: tap to loop, tap again to stop. Drag across the waveform to loop any stretch (a fill, a turnaround). |
| **Auto-split** | Detects section changes and names them. Or paste the Planning Center arrangement order (`I, V1, C, V2, C, B, C, O`) and it cuts exactly those sections on bar lines. Or use the headings in your lyrics. |
| **Tempo** | Detects BPM; tap tempo to correct it. Pads show lengths in bars. |
| **Looping tools** | Speed 50–110% with the key unchanged. Speed trainer (start slow, +5% each loop). Before each repeat: go straight back, pause, or a 1–2 bar click count-in. |
| **Launch modes** | "Jumps now", or "Waits for end of section" so the next pad starts on the section boundary. |
| **Lyrics** | Paste lyrics or a chord chart with headings; the right part shows as the song plays. |
| **Sets** | Set lists with date, key and notes per song. Songs added in the last week show as **New**. "Queue whole set". |
| **Queue** | A practice list: each part has its own speed and repeat count, then moves on. |
| **Phone** | Installable web app (PWA) with bottom tabs and a mini player. |

Everything runs in the browser. Songs stay on the device; nothing is uploaded yet.

Keyboard: <kbd>Space</kbd> play/pause · <kbd>L</kbd> loop · <kbd>←</kbd>/<kbd>→</kbd> sections · <kbd>-</kbd>/<kbd>+</kbd> speed.

## Run it

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
```

The first run creates a generated demo song, an example set and lyrics so every feature can
be tried immediately. Add your own songs with **Add songs** or drop audio files on the page.

## Check it

```bash
npm run typecheck  # TypeScript, strict
npm test           # unit tests (Node's built-in runner)
npm run build      # production build
```

The analysis tests render the demo song and check that every section edge is found within a
tenth of a second, the labels are right, and the tempo is 120 BPM.

## How it's built

Next.js 16 (App Router) + React 19 + TypeScript. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the structure, how the section detection works, whether songs need a GPU, and the roadmap.
