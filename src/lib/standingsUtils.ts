import { Match, StandingsEntry } from '../types';

/**
 * Obtiene estadísticas de clasificación para un oponente específico.
 */
export function getStandingsStats(
  seasonId: string,
  opponentId: string,
  matches: Match[],
  standings: StandingsEntry[]
): { played: number; goalsFor: number; goalsAgainst: number; points: number } {
  // Primero intentar desde standings pre-calculados (Firestore)
  const entry = standings.find(s => s.seasonId === seasonId && s.opponentId === opponentId);
  if (entry) {
    return {
      played: entry.played,
      goalsFor: entry.goalsFor,
      goalsAgainst: entry.goalsAgainst,
      points: entry.points
    };
  }

  // Si no hay, calcular desde el histórico de la temporada actual
  const seasonMatches = matches.filter(m => 
    m.seasonId === seasonId && 
    'scoreTeam' in m && m.scoreTeam != null && 
    m.opponentId === opponentId
  );

  return seasonMatches.reduce((acc, m) => ({
    played: acc.played + 1,
    goalsFor: acc.goalsFor + (m.scoreOpponent || 0),
    goalsAgainst: acc.goalsAgainst + (m.scoreTeam || 0),
    points: acc.points + ((m.scoreOpponent || 0) > (m.scoreTeam || 0) ? 3 : (m.scoreOpponent === m.scoreTeam ? 1 : 0))
  }), { played: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
}
