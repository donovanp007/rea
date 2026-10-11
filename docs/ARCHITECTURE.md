# Architecture

## Layout

```
src/
  app/                    Next.js entry: layout, global styles (design tokens), page
  components/
    App.tsx               shell: navigation, keyboard shortcuts, drag-and-drop, file input
    practice/             waveform, transport, section pads, tools, lyrics + section fixing
    sets/ songs/ queue/   the other three tabs
    shell/                nav, mini player, status line, icons, confirm button
  lib/
    audio/analyze.ts      section + tempo analysis (pure TypeScript, tested in Node)
    audio/analysis.worker.ts  runs the analysis off the main thread
    audio/analysisClient.ts   decodes audio, talks to the worker
    audio/demoSong.ts     generated demo song with known structure (app + tests)
    music/sections.ts     section names, Planning Center shorthand, timing helpers
    music/lyrics.ts       splits lyric sheets / chord charts by section heading
    player/engine.ts      playback: loops, count-ins, speed trainer, launches, queue
    store/appStore.ts     app state + `useApp` hook
    store/repository.ts   storage interface; IndexedDB implementation today
    actions.ts            every user operation, shared by all screens
```

Data flows one way: components call `actions`, actions update the store and save through the
`Repository`, components re-render from the store. The `PlayerEngine` owns the `<audio>`
element and timing; it reads settings from the store and writes playback state back.

## How section detection works

All of this runs in the browser, on the CPU, in a Web Worker, in a few seconds per song.

1. Decode the file, mix to mono, downsample to ~22 kHz.
2. For each 23 ms frame: **chroma** (which notes/chords are sounding), energy in six frequency
   bands (instrument mix), loudness, and **spectral flux** (note onsets).
3. Pool frames into 0.5 s blocks and compare every block with every other (a self-similarity
   matrix). Slide a checkerboard kernel down the diagonal: it scores high where the music
   *before* differs from the music *after*. Peaks are candidate section boundaries.
4. **Tempo** from the autocorrelation of the onset envelope; then choose the downbeat and
   snap each boundary onto the nearest **bar line**, because sections change on bars.
5. **Labels**: group similar segments. The group that repeats most is the chorus, the other
   repeated group the verse, a one-off late section the bridge; quiet short ends are intro/outro.

When the Planning Center arrangement order is known, step 3 instead picks exactly that many
boundaries at the strongest changes, and the labels come from the order. That's the most
reliable route for real worship tracks.

## Does every song need a GPU?

**No.** A song is analysed **once**, when it's added, and the results are saved with it:
section times and names, tempo and downbeat, the waveform overview, and the data needed to
re-split it later. Playing, looping, slowing down and re-splitting by arrangement order
never redo the heavy work.

| Job | Where | Cost | How often |
|---|---|---|---|
| Sections, tempo, waveform (today) | Browser CPU | Free, a few seconds | Once per song |
| Playback, loops, speed, count-in | Browser | Free | Every practice |
| Spoken guide cues ("Verse 1…"), timed lyrics (Whisper) | GPU worker *(planned)* | Seconds of GPU time | Once per song |
| Stems: drums / bass / vocals / keys (Demucs) | GPU worker *(planned)* | Tens of seconds of GPU time | Once per song |

With a server, results are stored next to the audio and keyed by the file's hash, so the same
track uploaded by two band members (or two churches) is only processed once. A serverless GPU
(billed per second, nothing running between jobs) suits this pattern; check current pricing
before committing to a provider.

## Roadmap

1. **Foundation (this branch).** Next.js app; practice player, sets, songs, queue, lyrics; on-device storage; tests.
2. **Team accounts and cloud.** Supabase (Postgres, auth, storage) behind the existing
   `Repository` interface. Private storage per church; streaming without a download button.
3. **Planning Center sync.** Import plans, songs, arrangements, keys and attachments through the
   official Planning Center API. Notifications when a song is added or changed in a set.
4. **Audio worker.** Python service: spoken guide-cue detection for exact section starts,
   line-timed lyrics (forced alignment against licensed lyrics, e.g. CCLI SongSelect),
   stems so players can mute their own part.
5. **Live mode.** Bar-quantised section launching and a band-wide "follow the leader" view.
6. **App stores.** Wrap the PWA with Capacitor for iOS and Android.

## Copyright

Songs stay private to the person (later, the team) who added them. Lyrics should come from a
licensed source such as CCLI SongSelect rather than scraped websites. Hosting other artists'
recordings for a team needs the right licence; check with CCLI and your local collecting
society (SAMRO in South Africa) before launching hosted audio.
