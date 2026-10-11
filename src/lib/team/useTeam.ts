"use client";
import { useApp } from "../store/appStore.ts";
import { memberById } from "./logic.ts";

/** The team workspace and the person using the app. */
export function useTeam() {
  const team = useApp((s) => s.team);
  const me = team ? memberById(team, team.me) : undefined;
  const isLeader = !!me && (me.worshipLeader || me.teams.some((t) => t.leader));
  return { team, me, isLeader, isWorshipLeader: !!me?.worshipLeader };
}
