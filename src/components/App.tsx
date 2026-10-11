"use client";
import { useEffect, useState } from "react";
import { addFiles, init, player } from "@/lib/actions";
import { useApp } from "@/lib/store/appStore";
import { PracticeView } from "./practice/PracticeView";
import { QueueView } from "./queue/QueueView";
import { CalendarView } from "./calendar/CalendarView";
import { HomeView } from "./home/HomeView";
import { ServicesView } from "./services/ServicesView";
import { Nav } from "./shell/Nav";
import { Toast } from "./shell/Toast";
import { TransportDock } from "./shell/TransportDock";
import { AUDIO_ACCEPT } from "./shell/AddSongsButton";
import { FILE_INPUT_ID } from "./shell/fileInput";
import { SongsView } from "./songs/SongsView";

export function App() {
  const view = useApp((s) => s.view);
  const ready = useApp((s) => s.ready);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { void init(); }, []);

  // keyboard: space play/pause, L loop, ←/→ sections, -/+ speed
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      const p = player();
      if (!p) return;
      if (e.code === "Space") { e.preventDefault(); p.toggle(); return; }
      if (view !== "practice") return;
      if (e.key === "l" || e.key === "L") p.loopCurrent();
      else if (e.key === "ArrowLeft") p.step(-1);
      else if (e.key === "ArrowRight") p.step(1);
      else if (e.key === "-") p.setSpeed(p.audio.playbackRate * 100 - 5);
      else if (e.key === "=" || e.key === "+") p.setSpeed(p.audio.playbackRate * 100 + 5);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  // drop audio files anywhere
  useEffect(() => {
    const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) { e.preventDefault(); setDragging(true); } };
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDragging(false); };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length) void addFiles(files);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => { window.removeEventListener("dragover", over); window.removeEventListener("dragleave", leave); window.removeEventListener("drop", drop); };
  }, []);

  return (
    <div className={`shell${dragging ? " drop" : ""}`}>
      <Nav />
      <main>
        {!ready ? (
          <div className="view"><p className="row muted"><i className="spin" aria-hidden /> Loading your songs…</p></div>
        ) : (
          <>
            <PracticeView hidden={view !== "practice"} />
            {view === "home" && <HomeView />}
            {view === "calendar" && <CalendarView />}
            {view === "services" && <ServicesView />}
            {view === "songs" && <SongsView />}
            {view === "queue" && <QueueView />}
          </>
        )}
      </main>
      <TransportDock />
      <Toast />
      <input
        id={FILE_INPUT_ID}
        className="hidden-file"
        type="file"
        accept={AUDIO_ACCEPT}
        multiple
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void addFiles(files);
        }}
      />
    </div>
  );
}
