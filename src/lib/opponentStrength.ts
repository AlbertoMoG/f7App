import type { LeagueFixture, StandingsEntry } from '../types';
import { OPPONENT_STRENGTH_WEIGHT_CLAMP } from './predictionConstants';

/** Puntos por partido desde solo `leagueFixtures` (sin partidos del equipo usuario). */
export function ppgFromLeagueFixturesOnly(
  oppId: string,
  seasonId: string,
  fixtures: LeagueFixture[]
): number | null {
  let pts = 0;
  let pld = 0;
  for (const f of fixtures) {
    if (f.seasonId !== seasonId || f.status !== 'completed') continue;
    if (f.scoreHome == null || f.scoreAway == null) continue;
    if (f.homeOpponentId === oppId) {
      pld++;
      if (f.scoreHome > f.scoreAway) pts += 3;
      else if (f.scoreHome === f.scoreAway) pts += 1;
    } else if (f.awayOpponentId === oppId) {
      pld++;
      if (f.scoreAway > f.scoreHome) pts += 3;
      else if (f.scoreHome === f.scoreAway) pts += 1;
    }
  }
  return pld > 0 ? pts / pld : null;
}

export function getPpgForStrength(
  oppId: string,
  seasonId: string,
  standings: StandingsEntry[],
  leagueFixtures: LeagueFixture[]
): number {
  const st = standings.find((s) => s.seasonId === seasonId && s.opponentId === oppId);
  if (st && st.played >= 1) return st.points / st.played;
  const fx = ppgFromLeagueFixturesOnly(oppId, seasonId, leagueFixtures);
  if (fx != null) return fx;
  return 1.2;
}

function medianSorted(values: number[]): number {
  if (values.length === 0) return 1.2;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** IDs que aparecen en la liga neutra de la temporada. */
export function opponentIdsFromLeagueFixtures(
  seasonId: string,
  leagueFixtures: LeagueFixture[]
): Set<string> {
  const ids = new Set<string>();
  for (const f of leagueFixtures) {
    if (f.seasonId !== seasonId) continue;
    ids.add(f.homeOpponentId);
    ids.add(f.awayOpponentId);
  }
  return ids;
}

/**
 * Mediana de PPG del grupo (tabla + fixtures) para normalizar fortaleza del rival de turno.
 */
export function medianGroupPpg(
  seasonId: string,
  standings: StandingsEntry[],
  leagueFixtures: LeagueFixture[]
): number {
  const ids = opponentIdsFromLeagueFixtures(seasonId, leagueFixtures);
  for (const s of standings) {
    if (s.seasonId === seasonId && s.opponentId !== 'my-team') ids.add(s.opponentId);
  }
  const ppgs: number[] = [];
  for (const id of ids) {
    ppgs.push(getPpgForStrength(id, seasonId, standings, leagueFixtures));
  }
  return medianSorted(ppgs);
}

export function strengthWeightForOpponent(
  otherOppId: string,
  seasonId: string,
  standings: StandingsEntry[],
  leagueFixtures: LeagueFixture[]
): number {
  const median = medianGroupPpg(seasonId, standings, leagueFixtures);
  const ppg = getPpgForStrength(otherOppId, seasonId, standings, leagueFixtures);
  const ratio = median > 0.05 ? ppg / median : 1;
  const raw = 0.82 + 0.36 * Math.min(1.5, Math.max(0.5, ratio));
  return Math.min(
    OPPONENT_STRENGTH_WEIGHT_CLAMP.MAX,
    Math.max(OPPONENT_STRENGTH_WEIGHT_CLAMP.MIN, raw)
  );
}
