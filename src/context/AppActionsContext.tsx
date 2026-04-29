import React, { createContext, useContext } from 'react';
import type { Player, Match, PlayerStat, Lineup, Team, Injury } from '../types';

interface AppActionsContextValue {
  // Team
  saveTeam: (t: Omit<Team, 'id' | 'ownerId'>) => Promise<void>;
  updateTeam: (t: Team) => Promise<void>;
  // Players
  addPlayer: (p: Omit<Player, 'id' | 'teamId'> & { seasonIds?: string[] }) => Promise<void>;
  updatePlayer: (p: Player, seasonIds: string[]) => Promise<void>;
  deletePlayer: (id: string) => Promise<void>;
  addInjury: (injury: Omit<Injury, 'id' | 'teamId'>) => Promise<void>;
  updateInjury: (injury: Injury) => Promise<void>;
  // Matches
  addMatch: (m: Omit<Match, 'id' | 'teamId'>) => Promise<void>;
  updateMatch: (m: Match) => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
  updateStats: (stats: PlayerStat[]) => Promise<void>;
  updateAttendance: (playerId: string, matchId: string, attendance: string) => Promise<void>;
  // Seasons
  addSeason: (name: string, division: string, startYear: number, playerIds?: string[], opponentIds?: string[]) => Promise<void>;
  updateSeason: (id: string, name: string, division: string, startYear: number, playerIds: string[], opponentIds: string[]) => Promise<void>;
  deleteSeason: (id: string) => Promise<void>;
  // Opponents
  addOpponent: (name: string, shieldUrl?: string, seasonIds?: string[]) => Promise<void>;
  updateOpponent: (id: string, name: string, shieldUrl?: string, seasonIds?: string[]) => Promise<void>;
  deleteOpponent: (id: string) => Promise<void>;
  // Fields
  addField: (name: string, location?: string) => Promise<void>;
  updateField: (id: string, name: string, location?: string) => Promise<void>;
  deleteField: (id: string) => Promise<void>;
  // Lineups
  saveLineup: (l: Omit<Lineup, 'id' | 'teamId'>) => Promise<void>;
  deleteLineup: (id: string) => Promise<void>;
}

const AppActionsContext = createContext<AppActionsContextValue | null>(null);

export function AppActionsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AppActionsContextValue;
}) {
  return <AppActionsContext.Provider value={value}>{children}</AppActionsContext.Provider>;
}

export function useAppActions(): AppActionsContextValue {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error('useAppActions must be used inside AppActionsProvider');
  return ctx;
}
