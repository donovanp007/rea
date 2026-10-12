import type { ItemKind, PlanTemplate, Service, SetSong } from "./types.ts";

/** Kinds of line a service order can hold besides songs. Colours are existing section tokens. */
export const ITEM_TYPES = [
  { id: "welcome", label: "Welcome", color: "--sec-intro", minutes: 3 },
  { id: "prayer", label: "Prayer", color: "--sec-bridge", minutes: 3 },
  { id: "scripture", label: "Scripture", color: "--sec-verse", minutes: 3 },
  { id: "message", label: "Message", color: "--sec-chorus", minutes: 30 },
  { id: "communion", label: "Communion", color: "--sec-vamp", minutes: 8 },
  { id: "offering", label: "Offering", color: "--sec-tag", minutes: 5 },
  { id: "announcements", label: "Announcements", color: "--sec-pre", minutes: 3 },
  { id: "video", label: "Video", color: "--sec-inst", minutes: 3 },
  { id: "other", label: "Other", color: "--sec-other", minutes: 5 },
] as const;
export type ItemTypeId = (typeof ITEM_TYPES)[number]["id"];
export const itemType = (id: string | undefined) => ITEM_TYPES.find((t) => t.id === id) ?? ITEM_TYPES[ITEM_TYPES.length - 1]!;

export const kindOf = (i: SetSong): ItemKind => i.kind ?? "song";
export const isSong = (i: SetSong) => kindOf(i) === "song";
export const songsOf = (svc: Service) => svc.setlist.filter(isSong);
export const colorOf = (i: SetSong) => (isSong(i) ? "--sec-chorus" : kindOf(i) === "header" ? "--line-2" : itemType(i.itemType).color);

/** A slot a template leaves for the planner to fill each week, like "#Pastor name here#" or "TBC". */
export const isPlaceholder = (i: SetSong) => /^#.*#$/.test(i.title.trim()) || /^(tbc|tbd)$/i.test(i.title.trim());

export const toMinutes = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? +m[1]! * 60 + +m[2]! : 9 * 60;
};
export const clock = (mins: number): string => {
  const t = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export interface TimelineRow { item: SetSong; start: string; end: string; offset: number }
export interface Timeline { rows: TimelineRow[]; total: number; end: string; /** minutes of songs only */ music: number }

/**
 * The running clock of a service: when each item starts and ends, from the service start time.
 * Headers take no time; their section total is the sum of what follows until the next header.
 */
export function timeline(svc: Service): Timeline {
  const t0 = toMinutes(svc.time);
  let at = 0, music = 0;
  const rows = svc.setlist.map((item) => {
    const len = kindOf(item) === "header" ? 0 : Math.max(0, item.minutes || 0);
    const row = { item, start: clock(t0 + at), end: clock(t0 + at + len), offset: at };
    at += len;
    if (isSong(item)) music += len;
    return row;
  });
  return { rows, total: at, end: clock(t0 + at), music };
}

/** Minutes in each header's section, keyed by header id (items before the first header are ignored). */
export function sectionTotals(items: SetSong[]): Record<string, number> {
  const out: Record<string, number> = {};
  let cur: string | null = null;
  for (const i of items) {
    if (kindOf(i) === "header") { cur = i.id; out[cur] = 0; } else if (cur) out[cur]! += i.minutes || 0;
  }
  return out;
}

/**
 * Applies a full new order. Like a drag-and-drop save, the caller always sends the whole sequence,
 * so the result can never lose or duplicate an item: anything missing keeps its place at the end,
 * unknown ids are ignored.
 */
export function applyOrder(items: SetSong[], sequence: string[]): SetSong[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const out: SetSong[] = [];
  for (const id of sequence) {
    const it = byId.get(id);
    if (it && !seen.has(id)) { out.push(it); seen.add(id); }
  }
  for (const i of items) if (!seen.has(i.id)) out.push(i);
  return out;
}

/** Moves one item to a new index (drag and drop), returning the new full sequence of ids. */
export function moveTo(items: SetSong[], id: string, to: number): string[] {
  const ids = items.map((i) => i.id);
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  ids.splice(from, 1);
  ids.splice(Math.max(0, Math.min(ids.length, to)), 0, id);
  return ids;
}

/* ---------- templates ---------- */

export function templateFromService(svc: Service, name: string, id: string): PlanTemplate {
  return {
    id, name,
    items: svc.setlist.map((i) => ({ ...i })),
    positions: svc.assignments.filter((a) => a.status !== "declined").map((a) => ({ teamId: a.teamId, position: a.position, memberId: a.memberId })),
  };
}
