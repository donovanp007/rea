"use client";
import { isNew, setView } from "@/lib/actions";
import { useApp } from "@/lib/store/appStore";
import type { View } from "@/lib/store/types";
import { IconPractice, IconQueue, IconSets, IconSongs, Logo } from "./icons";

const TABS: { view: View; label: string; Icon: (p: { size?: number }) => React.JSX.Element }[] = [
  { view: "practice", label: "Practice", Icon: IconPractice },
  { view: "sets", label: "Sets", Icon: IconSets },
  { view: "songs", label: "Songs", Icon: IconSongs },
  { view: "queue", label: "Queue", Icon: IconQueue },
];

export function Nav() {
  const view = useApp((s) => s.view);
  const newCount = useApp((s) => s.sets.reduce((a, set) => a + set.items.filter(isNew).length, 0));
  const queueCount = useApp((s) => s.queue.length);
  return (
    <nav className="side" aria-label="Main">
      <div className="brand"><Logo /><div><b>Practice Looper</b><small>Rehearse your part</small></div></div>
      <div className="nav">
        {TABS.map(({ view: v, label, Icon }) => {
          const n = v === "sets" ? newCount : v === "queue" ? queueCount : 0;
          return (
            <button key={v} type="button" aria-current={view === v ? "page" : undefined} onClick={() => setView(v)}>
              <Icon />
              <span>{label}</span>
              {n > 0 && <i className={`count${v === "sets" ? " new" : ""}`} aria-label={v === "sets" ? `${n} new songs` : `${n} in queue`}>{n}</i>}
            </button>
          );
        })}
      </div>
      <div className="foot">Your songs stay on this device. Nothing is uploaded.</div>
    </nav>
  );
}
