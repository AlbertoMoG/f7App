import { Match, PlayerStat } from '../types';
import { SYNERGY_WIN_RATE_THRESHOLD, SYNERGY_MIN_MATCHES } from './predictionConstants';

export interface SynergyData {
  isLethal: boolean;
  winRate: number;
  matchCount: number;
}

/**
 * Obtiene la clave canónica para un par de IDs de jugadores.
 */
export function getSynergyKey(id1: string, id2: string): string {
  return id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
}

/**
 * Pre-calcula un mapa de sinergias para todos los pares de jugadores.
 * Complejidad: O(M * P^2) donde M es partidos y P jugadores por partido.
 */
export function buildSynergyMap(
  matches: Match[],
  stats: PlayerStat[],
  threshold: number = SYNERGY_WIN_RATE_THRESHOLD,
  minMatches: number = SYNERGY_MIN_MATCHES
): Map<string, SynergyData> {
  
  // Paso 1: Índice de asistencia por partido
  const attendanceByMatch = new Map<string, Set<string>>();
  stats.forEach(s => {
    if (s.attendance !== 'attending') return;
    if (!attendanceByMatch.has(s.matchId)) {
      attendanceByMatch.set(s.matchId, new Set());
    }
    attendanceByMatch.get(s.matchId)!.add(s.playerId);
  });

  // Paso 2: Registrar pares que jugaron juntos en partidos completados
  const pairStats = new Map<string, { played: number; won: number }>();
  
  matches.forEach(m => {
    if (m.status !== 'completed' || m.scoreTeam == null || m.scoreOpponent == null) return;
    
    const attending = attendanceByMatch.get(m.id);
    if (!attending || attending.size < 2) return;
    
    const ids = Array.from(attending);
    const isWin = m.scoreTeam > m.scoreOpponent;
    
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = getSynergyKey(ids[i], ids[j]);
        
        const current = pairStats.get(key) ?? { played: 0, won: 0 };
        pairStats.set(key, {
          played: current.played + 1,
          won: current.won + (isWin ? 1 : 0),
        });
      }
    }
  });

  // Paso 3: Construir el mapa final con los que superan el umbral
  const synergyMap = new Map<string, SynergyData>();
  
  pairStats.forEach((value, key) => {
    if (value.played >= minMatches) {
      const winRate = value.won / value.played;
      synergyMap.set(key, {
        isLethal: winRate >= threshold,
        winRate,
        matchCount: value.played,
      });
    }
  });

  return synergyMap;
}
