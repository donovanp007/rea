/** Availability for one service date. */
export type Avail = "yes" | "maybe" | "no";

/** A section of the worship team and the positions it fills each service. */
export interface Team {
  id: string;
  name: string;
  /** Section colour token, e.g. "--sec-verse". */
  color: string;
  positions: string[];
}

export interface Membership {
  teamId: string;
  leader: boolean;
  /** Positions this person can fill in the team (e.g. "Acoustic guitar"). */
  positions: string[];
}

export interface Member {
  id: string;
  name: string;
  /** Avatar background, any CSS colour. */
  color: string;
  teams: Membership[];
  worshipLeader: boolean;
}

/** proposed: draft only the leaders see · requested: sent, awaiting reply · accepted · declined */
export type AssignmentStatus = "proposed" | "requested" | "accepted" | "declined";

export interface Assignment {
  id: string;
  memberId: string;
  teamId: string;
  position: string;
  status: AssignmentStatus;
}

export interface SetSong {
  id: string;
  title: string;
  key: string;
  minutes: number;
  /** A library song with audio, so it opens in Practice. */
  songId?: string;
  note?: string;
  /** Tempo for the click and the Ableton set; defaults to the detected tempo. */
  bpm?: number;
  /** Time signature, e.g. "4/4" or "6/8". */
  meter?: string;
}

export interface Service {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  time: string;
  title: string;
  rehearsal: { date: string; time: string };
  status: "draft" | "published";
  setlist: SetSong[];
  assignments: Assignment[];
}

export type UpdateKind = "key" | "assigned" | "accepted" | "declined" | "availability" | "published" | "setlist" | "rehearsal";

/** Something that changed, delivered to the people it affects. */
export interface Update {
  id: string;
  at: number;
  kind: UpdateKind;
  title: string;
  body: string;
  serviceId?: string;
  recipients: string[];
  readBy: string[];
}

export interface TeamState {
  church: string;
  me: string;
  members: Member[];
  teams: Team[];
  services: Service[];
  /** key: `${memberId}|${YYYY-MM-DD}` */
  availability: Record<string, Avail>;
  updates: Update[];
}
