"use client";
import { setView } from "@/lib/actions";
import { useApp } from "@/lib/store/appStore";
import type { View } from "@/lib/store/types";
import { unreadFor } from "@/lib/team/logic";
import { IconCalendar, IconHome, IconLive, IconPractice, IconQueue, IconSets, IconSongs, Logo } from "./icons";
import { ViewAs } from "./ViewAs";

const TABS: { view: View; label: string; Icon: (p: { size?: number }) => React.JSX.Element; desktopOnly?: boolean }[] = [
  { view: "home", label: "Home", Icon: IconHome },
  { view: "calendar", label: "Calendar", Icon: IconCalendar },
  { view: "services", label: "Services", Icon: IconSets },
  { view: "live", label: "Live", Icon: IconLive },
  { view: "practice", label: "Practice", Icon: IconPractice },
  { view: "songs", label: "Songs", Icon: IconSongs, desktopOnly: true },
  { view: "queue", label: "Queue", Icon: IconQueue, desktopOnly: true },
];

export function Nav() {
  const view = useApp((s) => s.view);
  const unread = useApp((s) => (s.team ? unreadFor(s.team, s.team.me).length : 0));
  const pending = useApp((s) => (s.team ? s.team.services.reduce((n, v) => n + v.assignments.filter((a) => a.memberId === s.team!.me && a.status === "requested").length, 0) : 0));
  const queueCount = useApp((s) => s.queue.length);
  const church = useApp((s) => s.team?.church);
  const count = (v: View) => (v === "home" ? unread : v === "services" ? pending : v === "queue" ? queueCount : 0);
  return (
    <nav className="side" aria-label="Main">
      <div className="brand"><Logo /><div><b>WorshipFlow</b><small>{church ?? "Worship team"}</small></div></div>
      <div className="nav">
        {TABS.map(({ view: v, label, Icon, desktopOnly }) => {
          const n = count(v);
          return (
            <button key={v} type="button" className={desktopOnly ? "desk" : undefined} aria-current={view === v ? "page" : undefined} onClick={() => setView(v)}>
              <Icon />
              <span>{label}</span>
              {n > 0 && <i className={`count${v === "home" || v === "services" ? " new" : ""}`} aria-label={`${n} new`}>{n}</i>}
            </button>
          );
        })}
      </div>
      <div className="foot"><ViewAs /><p>Sample team on this device. Songs stay on this device.</p></div>
    </nav>
  );
}
