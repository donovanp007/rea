import type { Member } from "@/lib/team/types";

export function Avatar({ m, size = 30, ring }: { m: Pick<Member, "name" | "color">; size?: number; ring?: string }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: m.color, boxShadow: ring ? `0 0 0 2px var(--panel), 0 0 0 4px ${ring}` : undefined }} aria-hidden>
      {m.name.slice(0, 1)}
    </span>
  );
}

export const AVAIL_LABEL = { yes: "Available", maybe: "Maybe", no: "Unavailable" } as const;
export const STATUS_LABEL = { proposed: "Draft", requested: "Awaiting reply", accepted: "Confirmed", declined: "Declined" } as const;
