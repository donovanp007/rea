# WorshipFlow build plan

WorshipFlow is the operating system for a worship team: who is serving, what we're playing, how
to prepare, and what changed. This plan turns the product blueprint into milestones, tracks every
feature, and sets out what it takes to make the app fully working and easy to run.

Status key: **Built** (works in the app today) · **Partial** (some of it works) · **Next** (in the
current milestone) · **Later** (planned, not started).

## Where we are

| Milestone | Theme | Status |
|---|---|---|
| M0 | Practice looper: auto-split, loops, slow-down, saved loops | Built |
| M1 | Team planning: home, availability, roster matrix, service plans | Built |
| M2 | Sunday-ready: service order, synced lyrics, mini-player, new mobile nav | Next |
| M3 | Tracks & Live: stems, multitrack Live mode, export to Ableton | In progress |
| M4 | Team talk: chat, notification centre with levels and acknowledgments | Later |
| M5 | Run the team: profile, members and roles admin, substitutions, version history | Later |
| M6 | Real accounts: sign-in, shared database, invites, hosting | Later |
| M7 | Connect: Planning Center import, WhatsApp/email/push delivery, chord charts | Later |

M2–M5 can be built and tested on the device with the sample team. M6 is the step that makes the
app shared between real people; it needs the decisions listed under "Decisions needed".

## Feature tracker

### 1. Planning & Scheduling

| Feature | Status | Notes |
|---|---|---|
| Availability calendar (available / maybe / away) | Built | Tap a date, or set every Sunday at once |
| Availability chips on Home | Built | |
| Roster matrix (people × Sundays) | Built | Coloured by availability, warnings on assign |
| Suggested people (available first, fair rotation) | Built | |
| Multi-position menu (e.g. keys + vocals) | Built | |
| Confirm / can't make it | Built | One tap from Home |
| Leaders told when a scheduled person becomes unavailable | Built | |
| "Needs replacement" status | Next (M5) | Set automatically on decline |
| Substitution flow: suggest, request, swap | Later (M5) | |
| Section calendars (one per team) | Partial | Roster filters by team; no per-team calendar page |
| Blockout reasons and recurring blockouts | Later | |

### 2. Service Plans

| Feature | Status | Notes |
|---|---|---|
| Service list and plan page | Built | Tabs: Setlist, Team, Rehearsal, Activity |
| Setlist with keys, reorder, add/remove | Built | Key change notifies everyone serving |
| Publish and remind pending | Built | Only people who haven't replied |
| Rehearsal time | Built | |
| Copy last week's setlist | Built | |
| Service order with non-song items (welcome, prayer, scripture, message, communion, offering) | Next (M2) | |
| Durations per item and total service time | Next (M2) | Running clock down the order |
| Transitions and notes per item | Next (M2) | |
| Song detail panel (key, BPM, arrangement, notes) | Next (M2) | |
| "Changes since last publish" | Later (M5) | |
| Version history | Later (M5) | |
| Service templates | Later (M5) | |

### 3. Music & Rehearsal

| Feature | Status | Notes |
|---|---|---|
| Auto-split into sections | Built | Plus Planning Center order or lyric headings |
| Loop sections and A/B custom loops | Built | |
| Slow down without changing pitch, speed trainer | Built | |
| Saved loops per song | Built | |
| Practice queue | Built | |
| Lyrics with section headings | Built | Shows the current part |
| Synced lyrics: line timings per recording | Next (M2) | Stored per audio file |
| Tap a line to jump there | Next (M2) | |
| Sync editor (tap along to set times) | Next (M2) | Sections are pre-timed from the split |
| Focus mode (big lyrics, phone-friendly) | Next (M2) | |
| Persistent mini-player above the bottom nav | Next (M2) | |
| Song library with search and tags | Partial | List exists; no search/tags yet |
| Chord charts | Later (M7) | Paste text first; PDF attachments with storage |
| Stems / multitracks | Later | Licensing: see ARCHITECTURE.md |

### 4. Team Chat

| Feature | Status | Notes |
|---|---|---|
| Inbox: direct messages, section groups, whole team | Later (M4) | |
| Service threads and song threads | Later (M4) | Opened from the plan or song |
| Announcements (leaders only post) | Later (M4) | |
| Replies, unread counts | Later (M4) | |
| Linked service cards in messages | Later (M4) | |
| Attachments | Later (M6) | Needs file storage |

### 5. Updates & Notifications

| Feature | Status | Notes |
|---|---|---|
| Updates feed, only to the people affected | Built | Never notifies yourself |
| Unread badges | Built | |
| Notification centre page | Next (M4) | |
| Levels: info / important / critical | Next (M4) | Critical needs acknowledgment |
| Acknowledgment tracking for leaders | Next (M4) | "7 of 9 have seen the key change" |
| Reminders (rehearsal tomorrow, reply needed) | Later (M6) | Needs a server to send on time |
| Push, email and WhatsApp delivery | Later (M7) | |

### 6. Team Administration

| Feature | Status | Notes |
|---|---|---|
| Sample team, "Viewing as" any member | Built | For testing the three roles |
| Roles: musician, section leader, worship leader | Built | Views change by role |
| Profile page (my teams, my positions, my blockouts) | Next (M5) | |
| Members: add, edit, remove, invite | Later (M5) | Invites send in M6 |
| Teams and positions editor, section leaders | Later (M5) | |
| Permissions table enforced | Later (M6) | Server-side rules |
| Workspace settings (church name, service times, default timings) | Later (M5) | |

### 7. Tracks & Live (M3)

Inspired by Plan2Live, which turns a Planning Center plan into an Ableton Live set. We do the same
in the browser, so it works without a Mac or Ableton, and can also export to Ableton.

| Feature | Status | Notes |
|---|---|---|
| Stems per song, grouped automatically from file names | Built | Click, guide, drums, bass, keys, pad, vocals… |
| New song from a folder of stems | Built | Mixed down to find sections and tempo |
| Live mode: stems play in sync | Built | One player per stem, kept within 35 ms of the click |
| Mixer: volume, mute, solo per group | Built | Kept from song to song; solo never silences the click |
| Split outputs: cues left, band right | Built | In-ears and front of house from one stereo output |
| Section jumps on the next bar or at the end of the section | Built | Pads and a timeline; jumps can be cancelled |
| Run a service's setlist, auto-start the next song | Built | "Run live" on every plan |
| Export the service to Ableton (.als): song order, tempo, section markers, stems | Next | Needs one empty Live set saved from Ableton as the template |
| Vamp: repeat a section until released | Next | |
| Generated spoken guide cues ("Verse 2", "Chorus") from the sections | Later | |
| Foot pedal and MIDI control | Later | Bluetooth page-turner pedals send keys; Web MIDI in Chrome |
| Multi-output audio interfaces | Later | Click/guide and band on separate interface outputs |
| Pull stems from Planning Center attachments | Later (M7) | |

### Navigation

| Feature | Status | Notes |
|---|---|---|
| Desktop side nav | Built | |
| Mobile bottom nav | Partial | Today: Home, Calendar, Services, Live, Practice |
| Mobile nav per blueprint: Home / Calendar / Plans / Chat / Profile | Next (M2) | Practice opens from a plan or the mini-player |
| Desktop sections per blueprint (Rehearsal Room, Messages, Notifications, Settings) | Next (M2–M5) | Added as each area lands |

## Milestones in detail

### M2 · Sunday-ready (next)

The two signature features from the blueprint, plus navigation that matches it.

1. **Service order.** Plan items become a list of songs *and* other items with a type, title,
   duration, notes and who leads. Drag to reorder. A running clock shows when each item starts
   and the total time. Song items keep their key and link to Practice.
2. **Synced lyrics.** Each recording gets its own line timings, stored with the song. Three ways
   to time it: from the sections the split already found, a tap-along editor (play the song and
   tap on each new line), or manual edits. Playback highlights the current line, tapping a line
   jumps there, and focus mode shows large lyrics only.
3. **Mini-player and mobile nav.** A small player sits above the bottom bar on every page. The
   bottom bar becomes Home / Calendar / Plans / Chat / Profile; Chat and Profile start as simple
   pages that M4 and M5 fill.

Done when: a leader can build a full Sunday order with timings on a phone, and a musician can
open a song from the plan, play it with synced lyrics, and keep it playing while they check the
calendar.

### M3 · Tracks & Live (in progress)

1. **Stems.** Add a song's stems (from MultiTracks.com, Loop Community or your own session). Each
   file is grouped from its name; wrong guesses are fixed with one select.
2. **Live mode.** The service's setlist as a multitrack player: in-sync stems, a mixer with mute
   and solo, section pads and a timeline that jump on the next bar, split cue/band outputs, and
   songs that start one after another.
3. **Export to Ableton.** One button on a plan writes a Live set with the songs in order, tempo
   changes and section locators, with stems on grouped tracks. Built from a template Live set
   so the file matches the user's Ableton version.

Done when: a music director runs Sunday's set from a phone or laptop with click in the in-ears,
and can hand the same set to Ableton in one click.

### M4 · Team talk

1. **Chat inbox.** Conversations of four kinds: direct, section group, whole team, and threads
   attached to a service or song. Unread counts, replies, a service card that opens the plan.
2. **Announcements.** Leaders post; everyone else reads and reacts.
3. **Notification centre.** One list of everything that changed, each marked info, important or
   critical. Critical items (key change on Sunday morning, time change) need an "I've seen it"
   tap, and leaders see who hasn't.

Done when: a section leader can sort out a swap in a section chat without WhatsApp, and the
worship leader can see who hasn't acknowledged a key change.

### M5 · Run the team

1. **Profile.** My teams, positions, availability and notification settings.
2. **Admin.** Add and edit members, teams, positions and section leaders. Church settings.
3. **Substitutions.** A decline marks the slot "Needs replacement", suggests people, and the
   swap is one tap for the section leader.
4. **History.** Plans keep versions; people see "changed since you last looked".
5. **Templates.** Save a service as a template and start new Sundays from it.

Done when: a church can set up its whole team in the app without editing code, and someone
cancelling on Saturday is fixed in under a minute.

### M6 · Real accounts (makes it fully working)

Today everything is stored on one device with a sample team. To share one team between real
phones the app needs a server. The plan:

| Piece | Choice | Why |
|---|---|---|
| Sign-in | Supabase Auth (email magic link, Google) | No passwords to manage; free tier fits a church |
| Database | Supabase Postgres with row-level security | Permissions enforced on the server, per church |
| Live updates | Supabase Realtime | Chat and roster changes appear instantly |
| Audio and files | Supabase Storage, private buckets, streamed | Songs stay in the app, never downloadable links |
| Hosting | Vercel | Next.js native, preview link for every change |
| Scheduled reminders | Supabase cron / Vercel cron | Rehearsal and reply reminders |

The app already reads and writes through one `Repository` interface, so the move is: add a
Supabase repository next to the device one, migrate the team model to tables, then switch on
sign-in. Each church is its own workspace; nobody sees another church's data.

Done when: two people on two phones sign in, one changes a key, and the other sees it within a
second.

### M7 · Connect

1. **Planning Center import.** Personal access token or OAuth; pull songs, arrangements,
   sequences and plans so nothing is typed twice.
2. **Delivery.** Web push to the installed app, email digests, and WhatsApp messages for
   critical alerts (WhatsApp Business API, paid per message).
3. **Chord charts.** Attach PDFs or paste ChordPro; transpose with the key.

## Making it easy to operate

- **One link to install.** Hosted at a church address; "Add to Home Screen" gives the app icon.
- **Invite by link.** Leaders share one invite link per team; people join and pick their position.
- **Every action in one or two taps.** Confirm, decline, mark away, swap, acknowledge.
- **Only the right people are told.** Changes notify whoever they affect, never everyone.
- **No setup for songs.** Upload once; it's split, tempo-mapped and lyric-timed for everyone.
- **Safe changes.** Previews deploy for every change before it goes live; nightly backups.
- **Simple costs.** Supabase and Vercel free tiers cover a single church; WhatsApp is the only
  per-message cost, and it stays optional.

## Decisions needed (before M6)

1. **Supabase project:** create one (free) and share the project URL and anon key.
2. **Vercel:** connect the GitHub repo so every push gets a preview link.
3. **Church name and service times** for the first real workspace.
4. **Planning Center:** whether to use your account's personal access token for the import.
5. **Licensing:** confirm the church's CCLI licence covers lyric display and streaming for
   rehearsal (CCLI Streaming/Rehearsal licence).

## How we work

- Each milestone is built on the `practice-looper` branch, checked with `npm run typecheck`,
  `npm test`, a production build and a browser run-through of every workflow before publishing.
- The in-app preview (Claude artifact) is rebuilt after each milestone so it can be tried on a
  phone straight away.
- This file is the tracker: statuses are updated in the same commit as the feature.
