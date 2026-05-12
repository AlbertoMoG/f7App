import type { Match } from '../types';
import { isLeagueMatchForStandings } from './leagueStandingsAggregate';

/** Rivales con al menos un partido de liga sin `isHome` explícito (true/false). */
export function opponentIdsWithAmbiguousLeagueLeg(
  matches: Match[],
  seasonId: string,
  opponentIds: string[]
): string[] {
  const allowed = new Set(opponentIds);
  const ambiguous = new Set<string>();
  for (const m of matches) {
    if (m.seasonId !== seasonId || !isLeagueMatchForStandings(m)) continue;
    if (!allowed.has(m.opponentId)) continue;
    if (m.isHome !== true && m.isHome !== false) ambiguous.add(m.opponentId);
  }
  return [...ambiguous];
}

/** Mismo rival + misma pierna explícita en un partido que cuenta como liga (tabla / agregados). */
export function findConflictingLeagueLeg(
  matches: Match[],
  cand: {
    seasonId: string;
    opponentId: string;
    isHome: boolean | null | undefined;
    excludeMatchId?: string;
  }
): Match | undefined {
  if (cand.isHome !== true && cand.isHome !== false) return undefined;
  return matches.find(
    (m) =>
      m.id !== cand.excludeMatchId &&
      m.seasonId === cand.seasonId &&
      m.opponentId === cand.opponentId &&
      isLeagueMatchForStandings(m) &&
      m.isHome === cand.isHome
  );
}
