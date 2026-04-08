export type Position = 'Portero' | 'Defensa' | 'Medio' | 'Delantero';
export type Attendance = 'attending' | 'notAttending' | 'noResponse';
export type MatchStatus = 'scheduled' | 'completed';

export interface Team {
  id: string;
  name: string;
  shieldUrl?: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  alias?: string;
  number: number;
  position: Position;
  birthDate: string;
  photoUrl?: string;
  isInjured?: boolean;
  isActive?: boolean;
  seasonIds?: string[];
}

export interface Season {
  id: string;
  name: string;
}

export interface Opponent {
  id: string;
  name: string;
  shieldUrl?: string;
  seasonIds?: string[];
}

export type MatchType = 'friendly' | 'league' | 'cup';

export interface Match {
  id: string;
  seasonId: string;
  date: string;
  opponentId: string;
  scoreTeam?: number;
  scoreOpponent?: number;
  status: MatchStatus;
  type?: MatchType;
  round?: string;
  isHome?: boolean;
  location?: string;
}

export interface PlayerStat {
  id: string;
  playerId: string;
  matchId: string;
  seasonId: string;
  attendance: Attendance;
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
  name: string;
  formation: string;
  slots: LineupSlot[];
  createdAt: string;
}
