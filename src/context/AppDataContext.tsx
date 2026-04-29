import React, { createContext, useContext } from 'react';
import type {
  Player, Season, Opponent, Match, PlayerStat,
  Lineup, Team, Field, PlayerSeason, Injury,
  StandingsEntry, LeagueFixture,
} from '../types';

interface AppDataContextValue {
  team: Team | null;
  players: Player[];
  playerSeasons: PlayerSeason[];
  seasons: Season[];
  opponents: Opponent[];
  matches: Match[];
  stats: PlayerStat[];
  lineups: Lineup[];
  fields: Field[];
  injuries: Injury[];
  standings: StandingsEntry[];
  leagueFixtures: LeagueFixture[];
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AppDataContextValue;
}) {
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
