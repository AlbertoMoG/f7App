import type { LeagueFixture, StandingsEntry } from '../types';
import {
  OPPONENT_LEAGUE_FORM_WINDOW,
  OPPONENT_FORM_TREND_CLAMP,
} from './predictionConstants';
import { strengthWeightForOpponent } from './opponentStrength';
import { compareLeagueFixturesRecentFirst } from './leagueFixtureOrder';

export type OpponentLeagueForm = {
  attackTrend: number;
  defenseTrend: number;
  sampleGames: number;
  recentN: number;
};

function goalsFromPerspective(
  f: LeagueFixture,
  opponentId: string
): { gf: number; gc: number } | null {
  if (f.status !== 'completed' || f.scoreHome == null || f.scoreAway == null) return null;
  if (f.homeOpponentId === opponentId) return { gf: f.scoreHome, gc: f.scoreAway };
  if (f.awayOpponentId === opponentId) return { gf: f.scoreAway, gc: f.scoreHome };
  return null;
}

type RelevantRow = { f: LeagueFixture; g: { gf: number; gc: number } };

function weightedMeans(
  slice: RelevantRow[],
  subjectId: string,
  seasonId: string,
  standings: StandingsEntry[] | undefined,
  leagueFixtures: LeagueFixture[]
): { avgGf: number; avgGc: number } {
  if (slice.length === 0) return { avgGf: 0, avgGc: 0 };
  if (!standings?.length) {
    return {
      avgGf: slice.reduce((a, x) => a + x.g.gf, 0) / slice.length,
      avgGc: slice.reduce((a, x) => a + x.g.gc, 0) / slice.length,
    };
  }
  let wSum = 0;
  let wgGf = 0;
  let wgGc = 0;
  for (const x of slice) {
    const other =
      x.f.homeOpponentId === subjectId ? x.f.awayOpponentId : x.f.homeOpponentId;
    const w = strengthWeightForOpponent(other, seasonId, standings, leagueFixtures);
    wgGf += x.g.gf * w;
    wgGc += x.g.gc * w;
    wSum += w;
  }
  if (wSum <= 0) {
    return {
      avgGf: slice.reduce((a, x) => a + x.g.gf, 0) / slice.length,
      avgGc: slice.reduce((a, x) => a + x.g.gc, 0) / slice.length,
    };
  }
  return { avgGf: wgGf / wSum, avgGc: wgGc / wSum };
}

/**
 * Compara goles a favor/en contra del rival en sus últimos partidos de liga (neutra)
 * frente a su media en la misma temporada. attackTrend > 1 = marca más últimamente.
 * Con `standings`, cada partido pesa según la fortaleza (PPG) del rival enfrentado.
 */
export function getOpponentLeagueForm(
  opponentId: string,
  seasonId: string,
  leagueFixtures: LeagueFixture[],
  windowSize = OPPONENT_LEAGUE_FORM_WINDOW,
  standings?: StandingsEntry[]
): OpponentLeagueForm {
  const relevant = leagueFixtures
    .filter(
      (f) =>
        f.seasonId === seasonId &&
        (f.homeOpponentId === opponentId || f.awayOpponentId === opponentId)
    )
    .map((f) => ({ f, g: goalsFromPerspective(f, opponentId) }))
    .filter((x): x is RelevantRow => x.g !== null)
    .sort((a, b) => compareLeagueFixturesRecentFirst(a.f, b.f));

  if (relevant.length === 0) {
    return {
      attackTrend: 1,
      defenseTrend: 1,
      sampleGames: 0,
      recentN: 0,
    };
  }

  const seasonMeans = weightedMeans(
    relevant,
    opponentId,
    seasonId,
    standings,
    leagueFixtures
  );
  const recentSlice = relevant.slice(0, Math.min(windowSize, relevant.length));
  const recentMeans = weightedMeans(
    recentSlice,
    opponentId,
    seasonId,
    standings,
    leagueFixtures
  );

  const rawAttack =
    seasonMeans.avgGf > 0.01 ? recentMeans.avgGf / seasonMeans.avgGf : 1;
  const rawDefense =
    seasonMeans.avgGc > 0.01 ? recentMeans.avgGc / seasonMeans.avgGc : 1;

  return {
    attackTrend: Math.min(
      OPPONENT_FORM_TREND_CLAMP.MAX,
      Math.max(OPPONENT_FORM_TREND_CLAMP.MIN, rawAttack)
    ),
    defenseTrend: Math.min(
      OPPONENT_FORM_TREND_CLAMP.MAX,
      Math.max(OPPONENT_FORM_TREND_CLAMP.MIN, rawDefense)
    ),
    sampleGames: relevant.length,
    recentN: recentSlice.length,
  };
}

const MIN_GAMES_FOR_FORM = 2;

/**
 * Aplica forma del rival a modificadores de goles esperados (predicción).
 * Más ataque reciente del rival → sube goles encajados esperados (modifier GC).
 * Más goles encajados por el rival recientemente → sube nuestros goles a favor esperados (modifier GF).
 */
export function applyLeagueFormToPredictionModifiers(
  opponentId: string,
  seasonId: string,
  leagueFixtures: LeagueFixture[],
  totalModifierGF: number,
  totalModifierGC: number,
  reasons: string[],
  standings?: StandingsEntry[]
): { totalModifierGF: number; totalModifierGC: number } {
  const form = getOpponentLeagueForm(
    opponentId,
    seasonId,
    leagueFixtures,
    OPPONENT_LEAGUE_FORM_WINDOW,
    standings
  );
  if (form.sampleGames < MIN_GAMES_FOR_FORM) {
    return { totalModifierGF, totalModifierGC };
  }
  const strength = Math.min(1, Math.max(0, (form.sampleGames - 1) / 4));
  const atkBlend = 1 + (form.attackTrend - 1) * strength;
  const defBlend = 1 + (form.defenseTrend - 1) * strength;
  const nextGF = totalModifierGF * defBlend;
  const nextGC = totalModifierGC * atkBlend;

  if (form.attackTrend > 1.02) {
    reasons.push(
      `Rival en racha ofensiva en liga (${form.recentN} últ. part. vs media temporada).`
    );
  } else if (form.attackTrend < 0.98) {
    reasons.push(`Rival con menos gol en sus últimos partidos de liga.`);
  }
  if (form.defenseTrend > 1.02) {
    reasons.push(`Rival encaja más últimamente en liga (oportunidad ofensiva).`);
  } else   if (form.defenseTrend < 0.98) {
    reasons.push(`Rival más sólido atrás en sus últimos partidos de liga.`);
  }

  return { totalModifierGF: nextGF, totalModifierGC: nextGC };
}
