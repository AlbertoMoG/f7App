export type Position = 'Portero' | 'Defensa' | 'Medio' | 'Delantero';
export type Attendance = 'attending' | 'notAttending' | 'noResponse' | 'justified' | 'doubtful';
export type MatchStatus = 'scheduled' | 'completed';

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  shieldUrl?: string;
}

export interface Injury {
  id: string;
  teamId: string;
  playerId: string;
  seasonId: string;
  startDate: string;
  endDate?: string | null;
  cause?: string | null;
}

export interface Player {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  alias?: string;
  number: number;
  position: Position;
  birthDate: string;
  photoUrl?: string;
  isInjured?: boolean;
  isActive?: boolean;
  seasonIds?: string[]; // Deprecated, keeping for migration
}

export interface PlayerSeason {
  id: string;
  teamId: string;
  playerId: string;
  seasonId: string;
}

export interface Season {
  id: string;
  teamId: string;
  name: string;
  division?: string;
  startYear: number;
}

export interface SeasonFeesInput {
  ficha: number;
  inscripcion: number;
  seguro: number;
  arbitroPerMatch: number;
  expectedMatches: number;
  installments: number;
  previousBalance: number;
}

export interface SeasonFees extends SeasonFeesInput {
  id: string;
  seasonId: string;
  teamId: string;
}

export interface PlayerPayment {
  id: string;
  playerId: string;
  seasonId: string;
  teamId: string;
  amountPaid: number;
}

export interface Opponent {
  id: string;
  teamId: string;
  name: string;
  shieldUrl?: string;
  seasonIds?: string[];
}

export interface Field {
  id: string;
  teamId: string;
  name: string;
  location?: string; // Google Maps coordinates or address
  mapUrl?: string; // Computed or stored Google Maps URL
}

export type MatchType = 'friendly' | 'league' | 'cup';

export interface Match {
  id: string;
  teamId: string;
  seasonId: string;
  date: string;
  opponentId: string;
  scoreTeam?: number | null;
  scoreOpponent?: number | null;
  status: MatchStatus;
  type?: MatchType | null;
  round?: string | null;
  isHome?: boolean | null;
  location?: string | null;
  fieldId?: string | null;
}

export interface PlayerStat {
  id: string;
  teamId: string;
  playerId: string;
  matchId: string;
  seasonId: string;
  attendance: Attendance;
  wasDoubtful?: boolean;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

export interface LineupSlot {
  playerId: string | null;
  x: number;
  y: number;
  pos: string;
}

export interface Lineup {
  id: string;
  teamId: string;
  name: string;
  formation: string;
  slots: LineupSlot[];
  matchId?: string;
  benchPlayerIds?: string[];
  createdAt: string;
}

export interface StandingsEntry {
  id: string;
  teamId: string;
  seasonId: string;
  opponentId: string | 'my-team';
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}
