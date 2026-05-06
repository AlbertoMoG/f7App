import type { LeagueFixture, Match, Opponent, StandingsEntry, Team } from '../types';
import type { LeagueStandingStats } from './leagueStandingsAggregate';
import { getOpponentLeagueForm, getRivalLeagueIndexData, type RivalLeagueIndexData } from './opponentForm';
import { getPpgForStrength, medianGroupPpg } from './opponentStrength';
import { compareLeagueFixturesRecentFirst } from './leagueFixtureOrder';
import {
  OPPONENT_FORM_TREND_CLAMP,
  OPPONENT_LEAGUE_FORM_WINDOW,
  RIVAL_STREAK_THRESHOLD,
} from './predictionConstants';

export type RivalThreatLevel = 'Alto' | 'Medio' | 'Bajo';

export interface RivalThreatRow {
  opponentId: string;
  name: string;
  shieldUrl?: string;
  threatScore: number;
  level: RivalThreatLevel;
  reasons: string[];
  h2hPlayed: number;
  h2hRecord: string;
  h2hGf: number;
  h2hGa: number;
  formLine: string | null;
  streakLine: string | null;
  tableLine: string | null;
  ppgLine: string | null;
  /** Numeric form trend (use instead of parsing formLine) */
  formData: { attackTrend: number; defenseTrend: number; recentN: number } | null;
  /** Numeric streak breakdown (use instead of parsing streakLine) */
  streakData: { w: number; d: number; l: number; n: number } | null;
  /** Numeric table stats (use instead of parsing tableLine) */
  tableData: { pts: number; gf: number; ga: number } | null;
  /** Numeric PPG data (use instead of parsing ppgLine) */
  ppgData: { ppg: number; medianPpg: number } | null;
  hasUpcoming: boolean;
  /** `managed` = tu equipo gestionado; mismo esquema de columnas, score = ritmo competitivo. */
  rowKind?: 'rival' | 'managed';
  /** Índice ataque/defensa vs media de liga + racha consecutiva (null si no hay datos suficientes) */
  leagueIndexData: RivalLeagueIndexData | null;
}

function medianPointsStandalone(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : ((s[mid - 1]! + s[mid]!) / 2);
}

function myTeamLeagueMatches(
  matches: Match[],
  seasonId: string,
  teamId: string
): Match[] {
  return matches.filter(
    (m) =>
      m.seasonId === seasonId &&
      m.teamId === teamId &&
      m.type === 'league' &&
      m.status === 'completed' &&
      m.scoreTeam != null &&
      m.scoreOpponent != null
  );
}

function aggregateMyTeamLeague(
  matches: Match[],
  seasonId: string,
  teamId: string
): { played: number; w: number; d: number; l: number; gf: number; ga: number } {
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  const ms = myTeamLeagueMatches(matches, seasonId, teamId);
  for (const m of ms) {
    const st = m.scoreTeam ?? 0;
    const so = m.scoreOpponent ?? 0;
    gf += st;
    ga += so;
    if (st > so) w++;
    else if (st < so) l++;
    else d++;
  }
  return { played: ms.length, w, d, l, gf, ga };
}

function leagueMatchStreakMyTeamLine(
  matches: Match[],
  seasonId: string,
  teamId: string,
  max = 5
): string | null {
  const ms = myTeamLeagueMatches(matches, seasonId, teamId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, max);
  if (ms.length === 0) return null;
  let w = 0;
  let d = 0;
  let l = 0;
  for (const m of ms) {
    const st = m.scoreTeam ?? 0;
    const so = m.scoreOpponent ?? 0;
    if (st > so) w++;
    else if (st < so) l++;
    else d++;
  }
  return `${w}V-${d}E-${l}D (últ. ${ms.length})`;
}

function myTeamPpgStandingsAware(
  seasonId: string,
  teamId: string,
  matches: Match[],
  standings: StandingsEntry[]
): number {
  const st = standings.find((s) => s.seasonId === seasonId && s.opponentId === 'my-team');
  if (st && st.played >= 1) return st.points / st.played;
  const agg = aggregateMyTeamLeague(matches, seasonId, teamId);
  if (agg.played <= 0) return 1.2;
  const pts = agg.w * 3 + agg.d;
  return pts / agg.played;
}

function myTeamRecentFormFromMatches(
  matches: Match[],
  seasonId: string,
  teamId: string
): { attackTrend: number; defenseTrend: number; samples: number; recentN: number } | null {
  const list = [...myTeamLeagueMatches(matches, seasonId, teamId)].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  if (list.length === 0) return null;

  let seasonGF = 0;
  let seasonGC = 0;
  const nSeason = list.length;
  for (const m of list) {
    seasonGF += m.scoreTeam ?? 0;
    seasonGC += m.scoreOpponent ?? 0;
  }
  const recentSlice = list.slice(
    0,
    Math.min(OPPONENT_LEAGUE_FORM_WINDOW, list.length)
  );
  let rGF = 0;
  let rGC = 0;
  const rN = recentSlice.length;
  for (const m of recentSlice) {
    rGF += m.scoreTeam ?? 0;
    rGC += m.scoreOpponent ?? 0;
  }
  const seasonAvgGF = seasonGF / nSeason;
  const seasonAvgGC = seasonGC / nSeason;
  const rawAttack = seasonAvgGF > 0.01 ? rGF / rN / seasonAvgGF : 1;
  const rawDefense = seasonAvgGC > 0.01 ? rGC / rN / seasonAvgGC : 1;
  return {
    attackTrend: Math.min(
      OPPONENT_FORM_TREND_CLAMP.MAX,
      Math.max(OPPONENT_FORM_TREND_CLAMP.MIN, rawAttack)
    ),
    defenseTrend: Math.min(
      OPPONENT_FORM_TREND_CLAMP.MAX,
      Math.max(OPPONENT_FORM_TREND_CLAMP.MIN, rawDefense)
    ),
    samples: list.length,
    recentN: rN,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function levelFromScore(score: number): RivalThreatLevel {
  if (score >= 68) return 'Alto';
  if (score >= 42) return 'Medio';
  return 'Bajo';
}

function h2hLeague(
  matches: Match[],
  seasonId: string,
  opponentId: string
): { played: number; w: number; d: number; l: number; gf: number; ga: number } {
  const ms = matches.filter(
    (m) =>
      m.seasonId === seasonId &&
      m.opponentId === opponentId &&
      m.type === 'league' &&
      m.status === 'completed' &&
      m.scoreTeam != null &&
      m.scoreOpponent != null
  );
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  for (const m of ms) {
    gf += m.scoreTeam ?? 0;
    ga += m.scoreOpponent ?? 0;
    if ((m.scoreTeam ?? 0) > (m.scoreOpponent ?? 0)) w++;
    else if ((m.scoreTeam ?? 0) < (m.scoreOpponent ?? 0)) l++;
    else d++;
  }
  return { played: ms.length, w, d, l, gf, ga };
}

function goalsOppInFixture(f: LeagueFixture, oppId: string): {
  gf: number;
  gc: number;
  won: boolean;
  draw: boolean;
} | null {
  if (f.status !== 'completed' || f.scoreHome == null || f.scoreAway == null) return null;
  if (f.homeOpponentId === oppId) {
    const gf = f.scoreHome;
    const gc = f.scoreAway;
    const won = gf > gc;
    const draw = gf === gc;
    return { gf, gc, won, draw };
  }
  if (f.awayOpponentId === oppId) {
    const gf = f.scoreAway;
    const gc = f.scoreHome;
    const won = gf > gc;
    const draw = gf === gc;
    return { gf, gc, won, draw };
  }
  return null;
}

/** Últimos partidos de liga neutra: datos numéricos de racha */
function leagueStreakData(
  oppId: string,
  seasonId: string,
  fixtures: LeagueFixture[],
  max = 5
): { w: number; d: number; l: number; n: number } | null {
  const rows = fixtures
    .filter(
      (f) =>
        f.seasonId === seasonId &&
        (f.homeOpponentId === oppId || f.awayOpponentId === oppId) &&
        f.status === 'completed' &&
        f.scoreHome != null &&
        f.scoreAway != null
    )
    .sort((a, b) => compareLeagueFixturesRecentFirst(a, b))
    .slice(0, max)
    .map((f) => goalsOppInFixture(f, oppId))
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (rows.length === 0) return null;
  let w = 0;
  let d = 0;
  let l = 0;
  for (const r of rows) {
    if (r.won) w++;
    else if (r.draw) d++;
    else l++;
  }
  return { w, d, l, n: rows.length };
}

function leagueStreakLine(oppId: string, seasonId: string, fixtures: LeagueFixture[], max = 5): string | null {
  const data = leagueStreakData(oppId, seasonId, fixtures, max);
  if (!data) return null;
  return `${data.w}V-${data.d}E-${data.l}D (últ. ${data.n})`;
}

function collectRivalIds(
  seasonId: string,
  opponents: Opponent[],
  matches: Match[],
  leagueFixtures: LeagueFixture[]
): string[] {
  const ids = new Set<string>();
  opponents
    .filter((o) => o.seasonIds?.includes(seasonId))
    .forEach((o) => ids.add(o.id));
  matches
    .filter((m) => m.seasonId === seasonId && m.type === 'league')
    .forEach((m) => ids.add(m.opponentId));
  leagueFixtures
    .filter((f) => f.seasonId === seasonId)
    .forEach((f) => {
      ids.add(f.homeOpponentId);
      ids.add(f.awayOpponentId);
    });
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function formatTableLinePtsGFGA(pts: number, gf: number, ga: number): string {
  return `${pts} pts · ${gf}-${ga} GF-GC`;
}

/** Texto para columna «Tabla»: fila standings en Firestore o agregado liga (partidos + fixtures). */
function standingsOrAggregateTableLine(
  doc: StandingsEntry | undefined,
  agg: LeagueStandingStats | undefined
): string | null {
  if (doc && doc.played > 0) {
    return formatTableLinePtsGFGA(doc.points ?? 0, doc.goalsFor ?? 0, doc.goalsAgainst ?? 0);
  }
  if (agg && agg.played > 0) {
    return formatTableLinePtsGFGA(agg.points, agg.goalsFor, agg.goalsAgainst);
  }
  return null;
}

export function computeRivalThreatRows(
  seasonId: string,
  opponents: Opponent[],
  matches: Match[],
  standings: StandingsEntry[],
  leagueFixtures: LeagueFixture[],
  leagueStandingsAgg: Map<string, LeagueStandingStats>
): RivalThreatRow[] {
  if (!seasonId) return [];

  const rivalIds = collectRivalIds(seasonId, opponents, matches, leagueFixtures);
  const medianPpg = medianGroupPpg(seasonId, standings, leagueFixtures);
  const myEntry = standings.find((s) => s.seasonId === seasonId && s.opponentId === 'my-team');
  const myPoints = myEntry?.points ?? null;

  const rows: RivalThreatRow[] = [];

  for (const opponentId of rivalIds) {
    const opp = opponents.find((o) => o.id === opponentId);
    const name = opp?.name ?? opponentId;
    const shieldUrl = opp?.shieldUrl;

    const h2h = h2hLeague(matches, seasonId, opponentId);
    const form = getOpponentLeagueForm(
      opponentId,
      seasonId,
      leagueFixtures,
      OPPONENT_LEAGUE_FORM_WINDOW,
      standings
    );
    const ppg = getPpgForStrength(opponentId, seasonId, standings, leagueFixtures);
    const oppStand = standings.find(
      (s) => s.seasonId === seasonId && s.opponentId === opponentId
    );
    const oppPoints = oppStand?.points ?? null;

    const hasUpcoming = matches.some(
      (m) =>
        m.seasonId === seasonId &&
        m.opponentId === opponentId &&
        m.status === 'scheduled' &&
        (m.type === 'league' || m.type == null)
    );

    let score = 50;
    const reasons: string[] = [];

    if (h2h.played > 0) {
      const oppWinRate = h2h.l / h2h.played;
      const ourWinRate = h2h.w / h2h.played;
      score += clamp((oppWinRate - ourWinRate) * 28, -14, 22);
      const avgGf = h2h.gf / h2h.played;
      const avgGa = h2h.ga / h2h.played;
      score += clamp((avgGa - avgGf) * 4, -10, 14);
      if (h2h.l > h2h.w) {
        reasons.push('Te han superado más veces en liga directa.');
      } else if (h2h.w > h2h.l) {
        reasons.push('Historial H2H favorable para tu equipo.');
      }
      if (avgGa > avgGf + 0.35) {
        reasons.push('Te marcan más de media en los enfrentamientos.');
      }
    } else {
      reasons.push('Sin partidos de liga cerrados entre vosotros aún.');
    }

    if (form.sampleGames >= 2) {
      const atk = form.attackTrend;
      const def = form.defenseTrend;
      score += clamp((atk - 1) * 55, -6, 14);
      score += clamp((1 - def) * 20, -6, 6);
      if (atk > 1.03) {
        reasons.push('Buena racha ofensiva en la liga del grupo.');
      }
      if (def > 1.03) {
        reasons.push('Encajan más últimamente (puedes generar ocasiones).');
      } else if (def < 0.97) {
        reasons.push('Defensa del grupo más sólida en sus últimos partidos.');
      }
    }

    if (myPoints != null && oppPoints != null) {
      const diff = oppPoints - myPoints;
      score += clamp(diff * 0.35, -12, 18);
      if (diff >= 4) {
        reasons.push('Por encima en la tabla de clasificación.');
      } else if (diff <= -4) {
        reasons.push('Por debajo en la tabla respecto a tu equipo.');
      }
    }

    if (medianPpg > 0.05) {
      const ratio = ppg / medianPpg;
      if (ratio > 1.04) {
        score += clamp((ratio - 1) * 35, 0, 12);
        reasons.push('Ritmo de puntos alto comparado con el grupo.');
      } else if (ratio < 0.92) {
        score -= clamp((1 - ratio) * 25, 0, 10);
        reasons.push('Ritmo de puntos bajo en el contexto del grupo.');
      }
    }

    if (hasUpcoming) {
      score += 3;
      reasons.push('Tenéis partido pendiente contra ellos.');
    }

    // Índice de liga: ataque/defensa relativo + racha consecutiva
    const leagueIndex = getRivalLeagueIndexData(opponentId, seasonId, leagueFixtures);
    if (leagueIndex) {
      const { attackIndex, defenseIndex, consecutiveWins, consecutiveLosses } = leagueIndex;
      // attackIndex > 1 → rival mete más que la media → más peligroso
      score += clamp((attackIndex - 1) * 12, -8, 10);
      // defenseIndex < 1 → rival encaja menos → más peligroso defensivamente
      score += clamp((1 - defenseIndex) * 8, -6, 8);
      if (attackIndex > 1.1) {
        reasons.push(`Promedio goleador superior a la media de liga (${leagueIndex.rivalAvgGF.toFixed(1)} vs ${leagueIndex.leagueAvgGoals.toFixed(1)}).`);
      } else if (attackIndex < 0.9) {
        reasons.push(`Bajo promedio goleador en liga (${leagueIndex.rivalAvgGF.toFixed(1)} vs ${leagueIndex.leagueAvgGoals.toFixed(1)}).`);
      }
      if (defenseIndex < 0.9) {
        reasons.push(`Encaja menos que la media en liga (defensa sólida).`);
      } else if (defenseIndex > 1.1) {
        reasons.push(`Encaja más que la media en liga (defensiva vulnerable).`);
      }
      if (consecutiveWins >= RIVAL_STREAK_THRESHOLD) {
        score += 5;
        reasons.push(`En racha de ${consecutiveWins} victorias consecutivas.`);
      } else if (consecutiveLosses >= RIVAL_STREAK_THRESHOLD) {
        score -= 5;
        reasons.push(`En racha de ${consecutiveLosses} derrotas consecutivas (momento bajo).`);
      }
    }

    score = Math.round(clamp(score, 0, 100));
    const level = levelFromScore(score);

    const h2hRecord = `${h2h.w}V-${h2h.d}E-${h2h.l}D`;

    let formLine: string | null = null;
    let formData: RivalThreatRow['formData'] = null;
    if (form.sampleGames >= 2) {
      formLine = `Ataque ${form.attackTrend >= 1 ? '↑' : '↓'} · Encaje ${form.defenseTrend >= 1 ? '↑' : '↓'} (${form.recentN} últ.)`;
      formData = { attackTrend: form.attackTrend, defenseTrend: form.defenseTrend, recentN: form.recentN };
    }

    const rawStreakData = leagueStreakData(opponentId, seasonId, leagueFixtures);
    const streakLine = rawStreakData ? `${rawStreakData.w}V-${rawStreakData.d}E-${rawStreakData.l}D (últ. ${rawStreakData.n})` : null;

    let tableLine: string | null = standingsOrAggregateTableLine(
      oppStand,
      leagueStandingsAgg.get(opponentId)
    );
    let tableData: RivalThreatRow['tableData'] = null;
    if (oppStand && oppStand.played > 0) {
      tableData = { pts: oppStand.points ?? 0, gf: oppStand.goalsFor ?? 0, ga: oppStand.goalsAgainst ?? 0 };
    } else {
      const agg = leagueStandingsAgg.get(opponentId);
      if (agg && agg.played > 0) tableData = { pts: agg.points, gf: agg.goalsFor, ga: agg.goalsAgainst };
    }

    let ppgLine: string | null = null;
    let ppgData: RivalThreatRow['ppgData'] = null;
    if (medianPpg > 0.05) {
      ppgLine = `PPG ${ppg.toFixed(2)} (mediana grupo ${medianPpg.toFixed(2)})`;
      ppgData = { ppg, medianPpg };
    }

    rows.push({
      opponentId,
      name,
      shieldUrl,
      threatScore: score,
      level,
      reasons: reasons.slice(0, 5),
      h2hPlayed: h2h.played,
      h2hRecord,
      h2hGf: h2h.gf,
      h2hGa: h2h.ga,
      formLine,
      streakLine,
      tableLine,
      ppgLine,
      formData,
      streakData: rawStreakData,
      tableData,
      ppgData,
      hasUpcoming,
      leagueIndexData: leagueIndex ?? null,
    });
  }

  return rows.sort((a, b) => b.threatScore - a.threatScore);
}

/**
 * Una fila con la misma estructura que un rival pero para tu equipo:
 * PJ totales vs rivales en liga, forma/racha desde «mis» partidos, tabla y PPG,
 * índice 0–100 de ritmo competitivo (no «peligro» del rival).
 */
export function computeMyTeamThreatRow(
  seasonId: string,
  team: Team | null,
  matches: Match[],
  standings: StandingsEntry[],
  leagueFixtures: LeagueFixture[],
  leagueStandingsAgg: Map<string, LeagueStandingStats>
): RivalThreatRow | null {
  if (!seasonId || !team) return null;

  const agg = aggregateMyTeamLeague(matches, seasonId, team.id);
  const medianPpg = medianGroupPpg(seasonId, standings, leagueFixtures);
  const myPpg = myTeamPpgStandingsAware(seasonId, team.id, matches, standings);
  const myEntry = standings.find((s) => s.seasonId === seasonId && s.opponentId === 'my-team');

  const rivalPointsVals = standings
    .filter((s) => s.seasonId === seasonId && s.opponentId !== 'my-team')
    .map((s) => s.points ?? 0);
  const medianPts =
    rivalPointsVals.length > 0 ? medianPointsStandalone(rivalPointsVals) : null;

  const formSignals = myTeamRecentFormFromMatches(matches, seasonId, team.id);

  let score = 48;
  const reasons: string[] = [];

  if (agg.played > 0) {
    const wr = agg.w / agg.played;
    score += clamp((wr - 0.33) * 42, -10, 24);
    if (wr >= 0.55) reasons.push('Buen balance de victorias en tus partidos de liga.');
    else if (wr <= 0.35 && agg.played >= 4) reasons.push('Margen para mejorar el balance en tus partidos de liga.');
  } else {
    reasons.push('Aún sin partidos de liga cerrados en «Mis partidos».');
  }

  if (formSignals && formSignals.samples >= 2) {
    score += clamp((formSignals.attackTrend - 1) * 55, -6, 14);
    score += clamp((1 - formSignals.defenseTrend) * 20, -6, 6);
    if (formSignals.attackTrend > 1.03) reasons.push('Anotando por encima de tu media reciente.');
    if (formSignals.defenseTrend > 1.03)
      reasons.push('Encajan más últimamente (trabajar solidez defensiva).');
    else if (formSignals.defenseTrend < 0.97) reasons.push('Encaje reciente mejor que tu media.');
  }

  const myPoints = myEntry?.points ?? null;
  if (myPoints != null && medianPts != null && rivalPointsVals.length >= 2) {
    const diff = myPoints - medianPts;
    score += clamp(diff * 0.3, -14, 16);
    if (diff >= 4) reasons.push('Por encima de la mediana de puntos entre rivales (tabla).');
    else if (diff <= -4) reasons.push('Por debajo de la mediana de puntos entre rivales.');
  }

  if (medianPpg > 0.05) {
    const ratio = myPpg / medianPpg;
    if (ratio > 1.04) {
      score += clamp((ratio - 1) * 35, 0, 13);
      reasons.push('Ritmo de puntos mejor que la mediana del grupo.');
    } else if (ratio < 0.92) {
      score -= clamp((1 - ratio) * 25, 0, 11);
      reasons.push('Por debajo de la mediana de ritmo puntos/partido del grupo.');
    }
  }

  const hasUpcoming = matches.some(
    (m) =>
      m.seasonId === seasonId &&
      m.teamId === team.id &&
      m.status === 'scheduled' &&
      (m.type === 'league' || m.type == null)
  );
  if (hasUpcoming) {
    score += 3;
    reasons.push('Te queda liga pendiente contra algún rival.');
  }

  score = Math.round(clamp(score, 0, 100));
  const level = levelFromScore(score);

  const h2hRecord =
    agg.played > 0 ? `${agg.w}V-${agg.d}E-${agg.l}D` : '—';

  let formLine: string | null = null;
  let formData: RivalThreatRow['formData'] = null;
  if (formSignals && formSignals.samples >= 2) {
    formLine = `Ataque ${formSignals.attackTrend >= 1 ? '↑' : '↓'} · Encaje ${formSignals.defenseTrend >= 1 ? '↑' : '↓'} (${formSignals.recentN} últ.)`;
    formData = { attackTrend: formSignals.attackTrend, defenseTrend: formSignals.defenseTrend, recentN: formSignals.recentN };
  }

  const tableLine = standingsOrAggregateTableLine(myEntry, leagueStandingsAgg.get('my-team'));
  let tableData: RivalThreatRow['tableData'] = null;
  if (myEntry && myEntry.played > 0) {
    tableData = { pts: myEntry.points ?? 0, gf: myEntry.goalsFor ?? 0, ga: myEntry.goalsAgainst ?? 0 };
  } else {
    const agg2 = leagueStandingsAgg.get('my-team');
    if (agg2 && agg2.played > 0) tableData = { pts: agg2.points, gf: agg2.goalsFor, ga: agg2.goalsAgainst };
  }

  let ppgLine: string | null = null;
  let ppgData: RivalThreatRow['ppgData'] = null;
  if (medianPpg > 0.05) {
    ppgLine = `PPG ${myPpg.toFixed(2)} (mediana grupo ${medianPpg.toFixed(2)})`;
    ppgData = { ppg: myPpg, medianPpg };
  }

  const myStreakStr = leagueMatchStreakMyTeamLine(matches, seasonId, team.id);
  const myStreakData: RivalThreatRow['streakData'] = myStreakStr
    ? (() => {
        const m = myStreakStr.match(/^(\d+)V-(\d+)E-(\d+)D \(últ\. (\d+)\)$/);
        return m ? { w: +m[1], d: +m[2], l: +m[3], n: +m[4] } : null;
      })()
    : null;

  return {
    opponentId: 'my-team',
    name: team.name,
    shieldUrl: team.shieldUrl,
    threatScore: score,
    level,
    reasons: reasons.slice(0, 5),
    h2hPlayed: agg.played,
    h2hRecord,
    h2hGf: agg.gf,
    h2hGa: agg.ga,
    formLine,
    streakLine: myStreakStr,
    tableLine,
    ppgLine,
    formData,
    streakData: myStreakData,
    tableData,
    ppgData,
    hasUpcoming,
    leagueIndexData: null,
    rowKind: 'managed',
  };
}
