import type { LeagueFixture, StandingsEntry } from '../types';
import {
  OPPONENT_LEAGUE_FORM_WINDOW,
  OPPONENT_FORM_TREND_CLAMP,
  RIVAL_LEAGUE_INDEX_WEIGHT,
  RIVAL_WIN_STREAK_GC_BOOST,
  RIVAL_LOSS_STREAK_GF_BOOST,
  RIVAL_STREAK_THRESHOLD,
  MIN_RIVAL_FIXTURES_FOR_INDEX,
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

/**
 * Datos crudos del índice ataque/defensa del rival vs media de liga + racha consecutiva.
 * Exportado para uso en rivalThreatScore.ts y en el motor de predicción.
 */
export interface RivalLeagueIndexData {
  /** Media de goles a favor del rival en sus fixtures de liga de la temporada */
  rivalAvgGF: number;
  /** Media de goles en contra del rival en sus fixtures de liga de la temporada */
  rivalAvgGA: number;
  /** Media de goles por equipo por partido en toda la liga */
  leagueAvgGoals: number;
  /** rivalAvgGF / leagueAvgGoals  (>1 = atacan más que la media) */
  attackIndex: number;
  /** rivalAvgGA / leagueAvgGoals  (>1 = encajan más que la media) */
  defenseIndex: number;
  /** Victorias consecutivas contadas desde el partido más reciente (0 si la racha se cortó) */
  consecutiveWins: number;
  /** Derrotas consecutivas contadas desde el partido más reciente (0 si la racha se cortó) */
  consecutiveLosses: number;
  /** Número de fixtures del rival usados para el cálculo */
  sampleGames: number;
}

/**
 * Calcula el índice de ataque/defensa del rival vs la media de goles de liga
 * y la racha de victorias/derrotas consecutivas más reciente.
 * Devuelve null si no hay suficientes datos (MIN_RIVAL_FIXTURES_FOR_INDEX).
 */
export function getRivalLeagueIndexData(
  opponentId: string,
  seasonId: string,
  leagueFixtures: LeagueFixture[],
): RivalLeagueIndexData | null {
  const completedInSeason = leagueFixtures.filter(
    f =>
      f.seasonId === seasonId &&
      f.status === 'completed' &&
      f.scoreHome != null &&
      f.scoreAway != null,
  );

  if (completedInSeason.length < MIN_RIVAL_FIXTURES_FOR_INDEX) return null;

  const rivalFixtures = completedInSeason.filter(
    f => f.homeOpponentId === opponentId || f.awayOpponentId === opponentId,
  );

  if (rivalFixtures.length < MIN_RIVAL_FIXTURES_FOR_INDEX) return null;

  // Media de goles por equipo en toda la liga (home + away / 2 por fixture)
  const totalLeagueGoals = completedInSeason.reduce(
    (acc, f) => acc + f.scoreHome! + f.scoreAway!, 0,
  );
  const leagueAvgGoals = totalLeagueGoals / (2 * completedInSeason.length);

  // Medias GF y GA del rival
  const { totalGF, totalGA } = rivalFixtures.reduce(
    (acc, f) => {
      if (f.homeOpponentId === opponentId) {
        return { totalGF: acc.totalGF + f.scoreHome!, totalGA: acc.totalGA + f.scoreAway! };
      }
      return { totalGF: acc.totalGF + f.scoreAway!, totalGA: acc.totalGA + f.scoreHome! };
    },
    { totalGF: 0, totalGA: 0 },
  );
  const rivalAvgGF = totalGF / rivalFixtures.length;
  const rivalAvgGA = totalGA / rivalFixtures.length;

  const attackIndex  = leagueAvgGoals > 0 ? rivalAvgGF / leagueAvgGoals : 1;
  const defenseIndex = leagueAvgGoals > 0 ? rivalAvgGA / leagueAvgGoals : 1;

  // Racha consecutiva desde el más reciente
  const sorted = [...rivalFixtures].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const isWin  = (f: LeagueFixture) =>
    f.homeOpponentId === opponentId ? f.scoreHome! > f.scoreAway! : f.scoreAway! > f.scoreHome!;
  const isLoss = (f: LeagueFixture) =>
    f.homeOpponentId === opponentId ? f.scoreHome! < f.scoreAway! : f.scoreAway! < f.scoreHome!;

  let consecutiveWins = 0;
  for (const f of sorted) {
    if (isWin(f)) consecutiveWins++;
    else break;
  }
  let consecutiveLosses = 0;
  for (const f of sorted) {
    if (isLoss(f)) consecutiveLosses++;
    else break;
  }

  return {
    rivalAvgGF, rivalAvgGA, leagueAvgGoals,
    attackIndex, defenseIndex,
    consecutiveWins, consecutiveLosses,
    sampleGames: rivalFixtures.length,
  };
}

/**
 * Aplica el índice de liga del rival a los modificadores de predicción (paso 10).
 * Señal ①: índice ataque/defensa vs media de liga.
 * Señal ②: racha consecutiva de victorias/derrotas (≥ RIVAL_STREAK_THRESHOLD).
 */
export function applyRivalLeagueIndexToModifiers(
  opponentId: string,
  seasonId: string,
  leagueFixtures: LeagueFixture[],
  totalModifierGF: number,
  totalModifierGC: number,
  reasons: string[],
): { totalModifierGF: number; totalModifierGC: number } {
  const data = getRivalLeagueIndexData(opponentId, seasonId, leagueFixtures);
  if (!data) return { totalModifierGF, totalModifierGC };

  const {
    attackIndex, defenseIndex, rivalAvgGF, rivalAvgGA,
    leagueAvgGoals, consecutiveWins, consecutiveLosses, sampleGames,
  } = data;

  // Señal ①
  totalModifierGC *= 1 + (attackIndex  - 1) * RIVAL_LEAGUE_INDEX_WEIGHT;
  totalModifierGF *= 1 + (defenseIndex - 1) * RIVAL_LEAGUE_INDEX_WEIGHT;

  if (attackIndex > 1.1) {
    reasons.push(`Rival goleador en liga (${rivalAvgGF.toFixed(1)} GF vs ${leagueAvgGoals.toFixed(1)} media).`);
  } else if (attackIndex < 0.9) {
    reasons.push(`Rival con escaso gol en liga (${rivalAvgGF.toFixed(1)} GF vs ${leagueAvgGoals.toFixed(1)} media).`);
  }
  if (defenseIndex > 1.1) {
    reasons.push(`Rival poroso en liga (${rivalAvgGA.toFixed(1)} GC vs ${leagueAvgGoals.toFixed(1)} media).`);
  } else if (defenseIndex < 0.9) {
    reasons.push(`Rival sólido defensivamente en liga (${rivalAvgGA.toFixed(1)} GC vs ${leagueAvgGoals.toFixed(1)} media).`);
  }

  // Señal ②
  if (sampleGames >= RIVAL_STREAK_THRESHOLD) {
    if (consecutiveWins >= RIVAL_STREAK_THRESHOLD) {
      totalModifierGC *= RIVAL_WIN_STREAK_GC_BOOST;
      reasons.push(`Rival en racha de ${consecutiveWins} victorias seguidas en liga.`);
    } else if (consecutiveLosses >= RIVAL_STREAK_THRESHOLD) {
      totalModifierGF *= RIVAL_LOSS_STREAK_GF_BOOST;
      reasons.push(`Rival en racha de ${consecutiveLosses} derrotas seguidas en liga.`);
    }
  }

  return { totalModifierGF, totalModifierGC };
}
