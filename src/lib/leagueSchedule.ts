import type { Match } from '../types';
import { isLeagueMatchForStandings } from './leagueStandingsAggregate';
import { opponentIdsWithAmbiguousLeagueLeg } from './leagueMatchLegValidation';

/**
 * Dedup: una pierna local y una visitante explícitas por rival y temporada.
 * Solo cuenta `isHome === true` / `isHome === false` (no se asume local por `undefined`).
 */
export function hasLeagueLeg(
  matches: Match[],
  seasonId: string,
  opponentId: string,
  isHome: boolean
): boolean {
  return matches.some(
    (m) =>
      m.seasonId === seasonId &&
      m.opponentId === opponentId &&
      isLeagueMatchForStandings(m) &&
      (isHome ? m.isHome === true : m.isHome === false)
  );
}

export type LeagueMatchSeed = {
  teamId: string;
  seasonId: string;
  opponentId: string;
  date: string;
  status: 'scheduled';
  type: 'league';
  round: string;
  isHome: boolean;
};

/**
 * Builds ida (home) + vuelta (away) league matches not already present.
 * Jornadas are assigned sequentially; dates spaced weekly from Aug 1 of season start year.
 */
export function buildMissingIdaYVueltaMatches(
  teamId: string,
  seasonId: string,
  opponentIds: string[],
  seasonStartYear: number,
  matches: Match[]
): LeagueMatchSeed[] {
  const sorted = [...new Set(opponentIds)].sort((a, b) => a.localeCompare(b));
  const ambiguous = new Set(opponentIdsWithAmbiguousLeagueLeg(matches, seasonId, sorted));
  const fixtures: { opponentId: string; isHome: boolean }[] = [];
  for (const opp of sorted) {
    if (ambiguous.has(opp)) continue;
    if (!hasLeagueLeg(matches, seasonId, opp, true)) {
      fixtures.push({ opponentId: opp, isHome: true });
    }
  }
  for (const opp of sorted) {
    if (ambiguous.has(opp)) continue;
    if (!hasLeagueLeg(matches, seasonId, opp, false)) {
      fixtures.push({ opponentId: opp, isHome: false });
    }
  }

  const base = new Date(seasonStartYear, 7, 1);
  return fixtures.map((f, idx) => {
    const d = new Date(base);
    d.setDate(d.getDate() + idx * 7);
    return {
      teamId,
      seasonId,
      opponentId: f.opponentId,
      date: d.toISOString(),
      status: 'scheduled' as const,
      type: 'league' as const,
      round: `Jornada ${idx + 1}`,
      isHome: f.isHome,
    };
  });
}
