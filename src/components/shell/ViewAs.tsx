"use client";
import { viewAs } from "@/lib/team/actions";
import { useTeam } from "@/lib/team/useTeam";

/** Preview the app as anyone on the sample team: musician, section leader or worship leader. */
export function ViewAs({ compact = false }: { compact?: boolean }) {
  const { team } = useTeam();
  if (!team) return null;
  const role = (id: string) => {
    const m = team.members.find((x) => x.id === id)!;
    if (m.worshipLeader) return "Worship leader";
    const led = m.teams.find((t) => t.leader);
    if (led) return `${team.teams.find((t) => t.id === led.teamId)?.name} leader`;
    return m.teams.map((t) => team.teams.find((x) => x.id === t.teamId)?.name).join(", ");
  };
  return (
    <label className={`viewas${compact ? " compact" : ""}`}>
      {!compact && <span className="label">Viewing as</span>}
      <select value={team.me} onChange={(e) => viewAs(e.target.value)} aria-label="Viewing as">
        {team.members.map((m) => <option key={m.id} value={m.id}>{m.name} · {role(m.id)}</option>)}
      </select>
    </label>
  );
}
