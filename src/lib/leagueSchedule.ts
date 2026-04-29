import type { Match } from '../types';

/** Dedup: one home + one away league fixture per opponent per season. */
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
      m.type === 'league' &&
      (isHome ? m.isHome !== false : m.isHome === false)
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
  const fixtures: { opponentId: string; isHome: boolean }[] = [];
  for (const opp of sorted) {
    if (!hasLeagueLeg(matches, seasonId, opp, true)) {
      fixtures.push({ opponentId: opp, isHome: true });
    }
  }
  for (const opp of sorted) {
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
