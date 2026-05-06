/**
 * standingsProjection.ts
 *
 * Lógica pura (sin dependencias de React) para calcular la proyección
 * final de la clasificación de liga usando regresión a la media, forma
 * reciente y señales de confianza según partidos jugados.
 */

import type { LeagueFixture } from '../types';
import {
  PROJECTION_REGRESSION_GAMES,
  PROJECTION_FORM_WINDOW,
  PROJECTION_FORM_WEIGHT,
} from './predictionConstants';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface StandingsRowInput {
  opponentId: string;
  name: string;
  shieldUrl?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface ProjectedTeam extends StandingsRowInput {
  /** Posición real actual (1-based, en la tabla actual antes de proyección) */
  currentRank: number;
  /** Puntos proyectados al final de la temporada */
  projectedPoints: number;
  /** Goles a favor proyectados */
  projectedGF: number;
  /** Goles en contra proyectados */
  projectedGC: number;
  /** Total de partidos jugados al final (basado en (N-1)*2 o fixtures reales) */
  projectedPlayed: number;
  /** Posición estimada en la clasificación final (1-based) */
  projectedRank: number;
  /** Diferencia de posición: currentRank − projectedRank (>0 = sube, <0 = baja) */
  rankChange: number;
  /** Nivel de confianza de la estimación según partidos jugados */
  confidence: 'alta' | 'media' | 'baja';
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

/**
 * Devuelve los últimos N fixtures completados de un equipo en la temporada,
 * ordenados del más reciente al más antiguo.
 */
function getRecentTeamFixtures(
  teamId: string,
  seasonId: string,
  leagueFixtures: LeagueFixture[],
  n: number,
): LeagueFixture[] {
  return leagueFixtures
    .filter(
      (f) =>
        f.seasonId === seasonId &&
        f.status === 'completed' &&
        f.scoreHome != null &&
        f.scoreAway != null &&
        (f.homeOpponentId === teamId || f.awayOpponentId === teamId),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, n);
}

/** Puntos obtenidos por `teamId` en un fixture completado. */
function pointsFromFixture(f: LeagueFixture, teamId: string): number {
  const isHome = f.homeOpponentId === teamId;
  const myGoals  = isHome ? f.scoreHome! : f.scoreAway!;
  const oppGoals = isHome ? f.scoreAway! : f.scoreHome!;
  if (myGoals > oppGoals) return 3;
  if (myGoals === oppGoals) return 1;
  return 0;
}

/** Nivel de confianza según partidos jugados. */
function confidenceLevel(played: number): ProjectedTeam['confidence'] {
  if (played >= PROJECTION_REGRESSION_GAMES) return 'alta';
  if (played >= 4) return 'media';
  return 'baja';
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Calcula la proyección final de la clasificación.
 *
 * Mejoras sobre el método anterior:
 *  1. Regresión a la media también aplicada a GF y GC (no solo a PPM).
 *  2. Denominador de regresión configurable (PROJECTION_REGRESSION_GAMES = 8).
 *  3. Factor de forma reciente: últimos PROJECTION_FORM_WINDOW partidos via leagueFixtures.
 *  4. Indicador de cambio de posición (currentRank vs projectedRank).
 *  5. Badge de confianza según partidos jugados.
 *
 * @param fullStandings   Array de equipos ya ordenado por clasificación actual (1.º = índice 0).
 * @param leagueFixtures  Fixtures neutrales de liga (para calcular forma reciente).
 * @param seasonId        Temporada activa.
 */
export function computeProjectedStandings(
  fullStandings: StandingsRowInput[],
  leagueFixtures: LeagueFixture[] = [],
  seasonId = '',
): ProjectedTeam[] {
  const totalTeams = fullStandings.length;
  if (totalTeams === 0) return [];

  const totalLeagueMatches = (totalTeams - 1) * 2; // ida y vuelta

  // Medias globales de liga
  const totalPlayedAll  = fullStandings.reduce((acc, t) => acc + t.played, 0);
  const totalPointsAll  = fullStandings.reduce((acc, t) => acc + t.points, 0);
  const totalGFAll      = fullStandings.reduce((acc, t) => acc + t.goalsFor, 0);
  const totalGCAll      = fullStandings.reduce((acc, t) => acc + t.goalsAgainst, 0);

  const globalPPM  = totalPlayedAll > 0 ? totalPointsAll / totalPlayedAll : 1.3;
  const leagueGFPM = totalPlayedAll > 0 ? totalGFAll     / totalPlayedAll : 1.5;
  const leagueGCPM = totalPlayedAll > 0 ? totalGCAll     / totalPlayedAll : 1.5;

  // Primera pasada: calcular puntos proyectados (sin rankChange todavía)
  const withProjection = fullStandings.map((team, idx) => {
    const currentRank = idx + 1;
    const played = team.played;

    // Peso de regresión: 0 (0 partidos) → 1 (≥ PROJECTION_REGRESSION_GAMES partidos)
    const weight = Math.min(1, played / PROJECTION_REGRESSION_GAMES);

    // PPM y medias de goles del equipo
    const teamPPM = played > 0 ? team.points    / played : globalPPM;
    const gfpm    = played > 0 ? team.goalsFor  / played : leagueGFPM;
    const gcpm    = played > 0 ? team.goalsAgainst / played : leagueGCPM;

    // Regresión a la media (PPM y goles)
    const expectedPPM  = teamPPM * weight + globalPPM  * (1 - weight);
    const expectedGFPM = gfpm    * weight + leagueGFPM * (1 - weight);
    const expectedGCPM = gcpm    * weight + leagueGCPM * (1 - weight);

    // Forma reciente via leagueFixtures
    let finalExpectedPPM = expectedPPM;
    if (seasonId && leagueFixtures.length > 0) {
      const recent = getRecentTeamFixtures(team.opponentId, seasonId, leagueFixtures, PROJECTION_FORM_WINDOW);
      if (recent.length >= 2) {
        const recentPPM =
          recent.reduce((acc, f) => acc + pointsFromFixture(f, team.opponentId), 0) / recent.length;
        finalExpectedPPM =
          expectedPPM * (1 - PROJECTION_FORM_WEIGHT) + recentPPM * PROJECTION_FORM_WEIGHT;
      }
    }

    const remMatches = Math.max(0, totalLeagueMatches - played);

    const projectedPoints = Math.round(team.points  + finalExpectedPPM * remMatches);
    const projectedGF     = Math.round(team.goalsFor     + expectedGFPM * remMatches);
    const projectedGC     = Math.round(team.goalsAgainst + expectedGCPM * remMatches);

    return {
      ...team,
      currentRank,
      projectedPoints,
      projectedGF,
      projectedGC,
      projectedPlayed: totalLeagueMatches,
      projectedRank: 0,   // se rellena en la segunda pasada
      rankChange: 0,       // ídem
      confidence: confidenceLevel(played),
    } satisfies ProjectedTeam;
  });

  // Ordenar por proyección (puntos → DG → GF) y asignar projectedRank
  const sorted = [...withProjection].sort((a, b) => {
    if (b.projectedPoints !== a.projectedPoints) return b.projectedPoints - a.projectedPoints;
    const aDG = a.projectedGF - a.projectedGC;
    const bDG = b.projectedGF - b.projectedGC;
    if (bDG !== aDG) return bDG - aDG;
    return b.projectedGF - a.projectedGF;
  });

  sorted.forEach((row, idx) => {
    row.projectedRank = idx + 1;
    row.rankChange    = row.currentRank - row.projectedRank; // >0 = sube
  });

  return sorted;
}
