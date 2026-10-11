import type { Prefs, QueueItem, SetList, Song } from "./types.ts";

/**
 * Where the app keeps its data. Today: IndexedDB on this device.
 * Phase 1 adds a Supabase implementation of the same interface for team sharing.
 */
export interface Repository {
  loadSongs(): Promise<Song[]>;
  saveSong(song: Song): Promise<void>;
  deleteSong(id: string): Promise<void>;
  loadAudio(id: string): Promise<Blob | null>;
  saveAudio(id: string, blob: Blob): Promise<void>;
  loadSets(): Promise<SetList[]>;
  saveSets(sets: SetList[]): Promise<void>;
  loadQueue(): Promise<QueueItem[]>;
  saveQueue(queue: QueueItem[]): Promise<void>;
  loadPrefs(): Promise<Partial<Prefs> | null>;
  savePrefs(prefs: Prefs): Promise<void>;
}

const DB_NAME = "practice-looper";
const DB_VERSION = 1;

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ["songs", "audio", "meta"]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * IndexedDB storage. Every call degrades to a no-op if storage is unavailable
 * (private windows, blocked site data), so the app still works for the session.
 */
export class LocalRepository implements Repository {
  private db = open();

  private async run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
    const db = await this.db;
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? (req.result ?? null) : null);
        tx.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async loadSongs() { return ((await this.run<Song[]>("songs", "readonly", (s) => s.getAll() as IDBRequest<Song[]>)) ?? []).sort((a, b) => a.addedAt - b.addedAt); }
  async saveSong(song: Song) { await this.run("songs", "readwrite", (s) => s.put(song, song.id)); }
  async deleteSong(id: string) { await this.run("songs", "readwrite", (s) => s.delete(id)); await this.run("audio", "readwrite", (s) => s.delete(id)); }
  async loadAudio(id: string) { return this.run<Blob>("audio", "readonly", (s) => s.get(id) as IDBRequest<Blob>); }
  async saveAudio(id: string, blob: Blob) { await this.run("audio", "readwrite", (s) => s.put(blob, id)); }
  async loadSets() { return (await this.run<SetList[]>("meta", "readonly", (s) => s.get("sets") as IDBRequest<SetList[]>)) ?? []; }
  async saveSets(sets: SetList[]) { await this.run("meta", "readwrite", (s) => s.put(sets, "sets")); }
  async loadQueue() { return (await this.run<QueueItem[]>("meta", "readonly", (s) => s.get("queue") as IDBRequest<QueueItem[]>)) ?? []; }
  async saveQueue(queue: QueueItem[]) { await this.run("meta", "readwrite", (s) => s.put(queue, "queue")); }
  async loadPrefs() { return this.run<Partial<Prefs>>("meta", "readonly", (s) => s.get("prefs") as IDBRequest<Partial<Prefs>>); }
  async savePrefs(prefs: Prefs) { await this.run("meta", "readwrite", (s) => s.put(prefs, "prefs")); }
}
