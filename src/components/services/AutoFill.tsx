"use client";
import { useState } from "react";
import { fillTeam } from "@/lib/team/actions";
import { memberById } from "@/lib/team/logic";
import { autoAssignPreview, autoSchedulePreview } from "@/lib/team/schedule";
import type { Service, TeamState } from "@/lib/team/types";
import { Avatar } from "../shell/Avatar";

type Mode = "copy" | "rotate";

/** Fills a team's open positions in one step. Shows who and why first; nothing changes until you apply. */
export function AutoFill({ svc, team, teamId }: { svc: Service; team: TeamState; teamId: string }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const picks = mode === "copy" ? autoAssignPreview(team, svc, teamId) : mode === "rotate" ? autoSchedulePreview(team, svc, teamId) : [];
  return (
    <div className="autofill">
      <div className="row">
        <span className="label">Fill open positions</span>
        <div className="seg" role="group" aria-label="How to fill">
          <button type="button" aria-pressed={mode === "copy"} onClick={() => setMode(mode === "copy" ? null : "copy")}>Same as before</button>
          <button type="button" aria-pressed={mode === "rotate"} onClick={() => setMode(mode === "rotate" ? null : "rotate")}>Fair rotation</button>
        </div>
      </div>
      {mode && (
        <div className="af-preview">
          {picks.length ? (
            <ul>
              {picks.map((p) => {
                const m = memberById(team, p.memberId);
                return m && (
                  <li key={p.position}>
                    <span className="note pos">{p.position}</span>
                    <span className="who"><Avatar m={m} size={24} /> <b>{m.name}</b></span>
                    <span className="note">{p.reason}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="note">{mode === "copy" ? "Nobody from recent plans or templates can fill these. Try fair rotation." : "Nobody available for these positions."}</p>}
          <div className="row">
            <button type="button" className="btn primary sm" disabled={!picks.length} onClick={() => { fillTeam(svc.id, teamId, picks); setMode(null); }}>
              Add {picks.length} {picks.length === 1 ? "person" : "people"}{svc.status === "published" ? " and ask them" : ""}
            </button>
            <button type="button" className="btn sm ghost" onClick={() => setMode(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
