# WORSHIPFLOW × PCO — EVIDENCE PACK (do-not-copy reference)

**For:** Claude, building WorshipFlow on `practice-looper`.
**Purpose:** evidence-backed knowledge for finishing the build. This pack explains **mechanisms** —
data shapes, permission gates, scheduling flows — learned by inspection. **No Planning Center code,
assets, icons, names or branding may be copied into WorshipFlow.** Concepts only. Your own code, your
own words, your own visual language.

---

## 1. CONFIRMED: PCO's five product gaps (verified against their app internals)
1. Charts never seek audio — the chart reader and audio player share no timeline.
2. No "mute my instrument" practice mixer.
3. Stems are stream-only; no offline practice sync.
4. No practice workspace between "confirmed" and Sunday.
5. No per-plan/team chat (chat only rides on their separate comms product).
WorshipFlow already targets 1, 2 and 4 with the practice looper + live mode. **Lean in — that's the product.**

## 2. MECHANISMS WORTH MATCHING (as ideas, implemented fresh)
- **Plan spine:** org → service types → plans (one per date) → items (header | item | song).
  The weekly template is a REAL first-class plan type, not a copy hack.
- **Item reorder** = save the whole sequence in one call (simple, robust pattern).
- **Times:** service / rehearsal / other; a member can be scheduled to SOME times only
  ("split teams"), and a PARENT can confirm for family members (households).
- **Member state machine:** pending → confirmed / declined (+ per-time declines).
- **Attachment gate:** every file carries its own permission list
  (stream / download / edit / transpose, each allowed or not) — UI AND server honour it.
  In WorshipFlow: a JSON column + row-level security on it.
- **Chord charts are plain text:** the arrangement stores chords+lyrics inline; charts render
  in 4 flavours per key (chords / numbers / numerals / lyrics) + per-key PDFs server-side.
- **Realtime events are thin:** broadcast ids only; client refetches that row.
- **Autoschedule lives server-side:** client sends teamId; the server walks
  rotation → preferences → conflicts → availability → fills quantities.

## 3. MINIMAL DATA MODEL FOR PARITY (Supabase, from M6's design)
service_types(id, name)
plans(id, service_type_id, date, kind: 'plan'|'template', template_source_id)
plan_items(id, plan_id, seq, type: header|item|song, title, song_id?, duration_s)
plan_times(id, plan_id, type: service|rehearsal|other, starts_at, ends_at)
plan_members(id, plan_id, person_id, team_id, position, status: 'P'|'C'|'D',
             service_time_ids int[], declined_time_ids int[])
persons(id, name, photo_url, household_id?, passed_background_check)
households(id) — parent may answer for members
teams(id, name) · team_positions(id, team_id, name) ·
team_members(team_id, person_id, position, preference, rotation)
songs(id, title, ccli?, tags text[]) ·
arrangements(id, song_id, name, sequence text[]) ·
keys(id, arrangement_id, starting_key, is_minor, alternates jsonb) ·
attachments(id, kind: s3|chart|lyric|link, filetype, url, interactions jsonb)
plan_notes(id, plan_id, item_id?, category, body)
+ Realtime channels on plans / plan_items / plan_members / plan_notes.

## 4. BUILD ORDER (evidence-aligned with docs/PLAN.md)
M2 finish (order+clock+templates — largely IN) → M3 finish tracks/live per-plan →
M4 chat + acks → M5 versions/substitutions → M6 Supabase (RLS reads the SAME
interactions JSON) → M7 optional PCO import (read-only, member's own PAT, never scrape).

## 5. WHAT THIS ANSWERS
- Order-of-service shape ✅ (27-item weekly template, 6 service types incl. one-off events)
- How it works for member / leader / band leader ✅ — three-role model in PLAN.md + state machines above
- Scheduling internals ✅ — mechanisms above, mapped onto WorshipFlow's existing roster matrix

*Everything here = concepts and data shapes, for interoperability and learning.
No PCO code, artwork, or branding in WorshipFlow — keep it that way.*
