"use client";
import { isNew, setView } from "@/lib/actions";
import { useApp } from "@/lib/store/appStore";
import type { View } from "@/lib/store/types";
import { IconPractice, IconQueue, IconSets, IconSongs, Logo } from "./icons";

const TABS: { view: View; label: string; Icon: () => React.JSX.Element }[] = [
  { view: "practice", label: "Practice", Icon: IconPractice },
  { view: "sets", label: "Sets", Icon: IconSets },
  { view: "songs", label: "Songs", Icon: IconSongs },
  { view: "queue", label: "Queue", Icon: IconQueue },
];

export function Nav() {
  const view = useApp((s) => s.view);
  const newCount = useApp((s) => s.sets.reduce((a, set) => a + set.items.filter(isNew).length, 0));
  const queueCount = useApp((s) => s.queue.length);
  const badge = (v: View) => (v === "sets" ? newCount : v === "queue" ? queueCount : 0);
  return (
    <nav className="rail" aria-label="Main">
      <div className="logo"><Logo /><b>Practice Looper</b></div>
      <div className="nav">
        {TABS.map(({ view: v, label, Icon }) => (
          <button key={v} type="button" aria-current={view === v ? "page" : undefined} onClick={() => setView(v)}>
            <Icon />
            <span>{label}</span>
            {badge(v) > 0 && <i className="badge" aria-label={v === "sets" ? `${badge(v)} new songs` : `${badge(v)} in queue`}>{badge(v)}</i>}
          </button>
        ))}
      </div>
      <div className="foot">Songs stay on this device. Nothing is uploaded.</div>
    </nav>
  );
}
