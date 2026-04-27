import React from 'react';
import { Player, Match, PlayerStat, Injury, Season, PlayerSeason } from '../../../types';
import { calculatePlayerRating } from '../../../lib/ratingSystem';
import { PlayerRating } from '../../../types/aiAnalysis';

interface UsePlayerRatingsProps {
  players: Player[];
  playerSeasons: PlayerSeason[];
  matches: Match[];
  stats: PlayerStat[];
  injuries: Injury[];
  seasons: Season[];
  globalSeasonId: string;
}

/**
 * Hook para calcular los ratings de los jugadores filtrados por temporada.
 */
export function usePlayerRatings({
  players,
  playerSeasons,
  matches,
  stats,
  injuries,
  seasons,
  globalSeasonId
}: UsePlayerRatingsProps) {
  
  const filteredPlayers = React.useMemo(() => {
    if (globalSeasonId === 'all') return players;
    const seasonPlayerIds = playerSeasons
      .filter(ps => ps.seasonId === globalSeasonId)
      .map(ps => ps.playerId);
    return players.filter(p => seasonPlayerIds.includes(p.id));
  }, [players, playerSeasons, globalSeasonId]);

  const allPlayerRatings = React.useMemo(() => {
    return filteredPlayers.map(p => {
      // Necesitamos el breakdown para calculos posteriores más precisos
      const result = calculatePlayerRating(matches, injuries, stats, p, globalSeasonId, seasons);
      return {
        id: p.id,
        rating: result.notaFinal,
        breakdown: result // Guardamos el objeto completo para utilidades
      };
    });
  }, [filteredPlayers, matches, injuries, stats, globalSeasonId, seasons]);

  return {
    filteredPlayers,
    allPlayerRatings
  };
}
