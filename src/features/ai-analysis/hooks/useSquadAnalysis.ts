import React from 'react';
import { Player, Match, PlayerStat, PlayerSeason, Injury, LeagueFixture, StandingsEntry } from '../../../types';
import { buildSynergyMap } from '../../../lib/synergyCalculator';
import { evaluateSquad } from '../../../lib/squadEvaluator';
import { calculatePlayerDelta } from '../../../lib/deltaCalculator';
import { SquadAnalysisResult, PlayerRating } from '../../../types/aiAnalysis';

interface UseSquadAnalysisProps {
  players: Player[];
  playerSeasons: PlayerSeason[];
  matches: Match[];
  stats: PlayerStat[];
  injuries: Injury[];
  globalSeasonId: string;
  allPlayerRatings: PlayerRating[];
  leagueFixtures?: LeagueFixture[];
  standings?: StandingsEntry[];
}

export function useSquadAnalysis({
  players,
  playerSeasons,
  matches,
  stats,
  injuries,
  globalSeasonId,
  allPlayerRatings,
  leagueFixtures = [],
  standings = [],
}: UseSquadAnalysisProps) {
  const [analyzedLimit, setAnalyzedLimit] = React.useState(5);

  // Memoize synergyMap separately so it only recomputes when matches/stats change,
  // not when allPlayerRatings or other deps change.
  const synergyMap = React.useMemo(() => buildSynergyMap(matches, stats), [matches, stats]);

  const squadAnalysis = React.useMemo(() => {
    const analysisMap = new Map<string, SquadAnalysisResult>();

    // 2. Jugadores en racha
    const inFormPlayers = new Set<string>();

    // 3. Jugadores clave
    const keyPlayerIds = allPlayerRatings
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5)
      .map(p => p.id);

    const teamAvgBaremo = allPlayerRatings.reduce((acc, p) => acc + p.rating, 0) / (allPlayerRatings.length || 1);

    // 4. Analizar cada partido (Mínimo 5 convocados según requerimiento)
    const matchesToAnalyze = matches.filter(m => {
      const matchStats = stats.filter(s => s.matchId === m.id && s.attendance === 'attending');
      return matchStats.length >= 5;
    });

    matchesToAnalyze.forEach(match => {
      const matchStats = stats.filter(s => s.matchId === match.id && s.attendance === 'attending');
      const attendingPlayerIds = matchStats.map(s => s.playerId);
      const attendingPlayers = players.filter(p => attendingPlayerIds.includes(p.id));

      // Evaluación base
      const result = evaluateSquad(
        attendingPlayers,
        match,
        allPlayerRatings,
        synergyMap,
        teamAvgBaremo,
        matches,
        inFormPlayers,
        keyPlayerIds,
        leagueFixtures,
        standings
      );

      // Mejoras incrementales
      const otherEligiblePlayers = players.filter(p => 
        !attendingPlayerIds.includes(p.id) &&
        playerSeasons.some(ps => ps.playerId === p.id && ps.seasonId === match.seasonId)
      );

      result.improvements = otherEligiblePlayers.map(p => {
        return {
          player: p,
          ...calculatePlayerDelta(p, attendingPlayers, result.score, result, synergyMap, allPlayerRatings, teamAvgBaremo)
        };
      }).filter(imp => imp.scoreIncrease > 0)
      .sort((a, b) => b.scoreIncrease - a.scoreIncrease)
      .slice(0, 3);

      analysisMap.set(match.id, result);
    });

    return analysisMap;
  }, [players, playerSeasons, matches, stats, allPlayerRatings, globalSeasonId, leagueFixtures, standings, synergyMap]);

  return {
    squadAnalysis,
    analyzedLimit,
    setAnalyzedLimit
  };
}
