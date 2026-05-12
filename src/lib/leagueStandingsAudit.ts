import type { LeagueFixture, Match, Opponent, StandingsEntry, Team } from '../types';
import {
  aggregateLeagueStandingsFromResults,
  collectStandingsParticipantIds,
  dedupeLeagueMatchesForAggregate,
  isFinishedLeagueFixture,
  isFinishedLeagueMatch,
  leagueMatchStandingsDedupeKey,
} from './leagueStandingsAggregate';

export type LeagueStandingsAuditIssue = {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  detail?: string;
};

export type LeagueStandingsAuditResult = {
  seasonId: string;
  teamCount: number;
  maxPlayedPerTeam: number;
  issues: LeagueStandingsAuditIssue[];
  duplicateFinishedMatchGroups: number;
  duplicateFinishedFixtureGroups: number;
  manualStandingsRowCount: number;
};

export function standingsEntryHasManualAdjustment(s: StandingsEntry): boolean {
  return (
    (s.played ?? 0) > 0 ||
    (s.won ?? 0) > 0 ||
    (s.drawn ?? 0) > 0 ||
    (s.lost ?? 0) > 0 ||
    (s.goalsFor ?? 0) > 0 ||
    (s.goalsAgainst ?? 0) > 0 ||
    (s.points ?? 0) > 0
  );
}

/**
 * Comprueba duplicados, topes teóricos (todos contra todos a doble) y ajustes manuales en `standings`.
 * No modifica datos.
 */
export function auditLeagueStandingsData(params: {
  seasonId: string;
  team: Team | null;
  opponents: Opponent[];
  matches: Match[];
  leagueFixtures: LeagueFixture[];
  standings: StandingsEntry[];
}): LeagueStandingsAuditResult {
  const { seasonId, team, opponents, matches, leagueFixtures, standings } = params;
  const issues: LeagueStandingsAuditIssue[] = [];

  if (!seasonId) {
    return {
      seasonId,
      teamCount: 0,
      maxPlayedPerTeam: 0,
      issues: [
        {
          severity: 'warning',
          code: 'NO_SEASON',
          message: 'No hay temporada seleccionada para auditar.',
        },
      ],
      duplicateFinishedMatchGroups: 0,
      duplicateFinishedFixtureGroups: 0,
      manualStandingsRowCount: 0,
    };
  }

  const standingsIdsThisSeason = standings
    .filter((s) => s.seasonId === seasonId)
    .map((s) => s.opponentId);
  const participantIds = collectStandingsParticipantIds(
    seasonId,
    team,
    opponents,
    matches,
    leagueFixtures,
    standingsIdsThisSeason
  );

  const teamCount = participantIds.length;
  const maxPlayedPerTeam = teamCount >= 2 ? 2 * (teamCount - 1) : 0;

  const computed = aggregateLeagueStandingsFromResults(
    seasonId,
    team,
    opponents,
    matches,
    leagueFixtures
  );

  const matchKeyToIds = new Map<string, string[]>();
  for (const m of matches) {
    if (m.seasonId !== seasonId || !isFinishedLeagueMatch(m)) continue;
    if (team && m.teamId && m.teamId !== team.id) continue;
    const key = leagueMatchStandingsDedupeKey(m);
    const list = matchKeyToIds.get(key) ?? [];
    list.push(m.id);
    matchKeyToIds.set(key, list);
  }

  let duplicateFinishedMatchGroups = 0;
  for (const [, ids] of matchKeyToIds) {
    if (ids.length > 1) {
      duplicateFinishedMatchGroups++;
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_LEAGUE_MATCH',
        message: `${ids.length} partidos finalizados duplican el mismo rival y pierna (local/visitante).`,
        detail: `IDs: ${ids.join(', ')}`,
      });
    }
  }

  const fixKeyToIds = new Map<string, string[]>();
  for (const f of leagueFixtures) {
    if (f.seasonId !== seasonId || !isFinishedLeagueFixture(f)) continue;
    const key = `${f.homeOpponentId}\0${f.awayOpponentId}`;
    const list = fixKeyToIds.get(key) ?? [];
    list.push(f.id);
    fixKeyToIds.set(key, list);
  }

  let duplicateFinishedFixtureGroups = 0;
  for (const [, ids] of fixKeyToIds) {
    if (ids.length > 1) {
      duplicateFinishedFixtureGroups++;
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_LEAGUE_FIXTURE',
        message: `${ids.length} enfrentamientos finalizados duplican el mismo par local–visitante.`,
        detail: `IDs: ${ids.join(', ')}`,
      });
    }
  }

  const manualRows = standings.filter(
    (s) => s.seasonId === seasonId && standingsEntryHasManualAdjustment(s)
  );
  const manualStandingsRowCount = manualRows.length;

  if (manualStandingsRowCount > 0) {
    const sample = manualRows
      .slice(0, 12)
      .map((r) => {
        const id = r.opponentId === 'my-team' ? 'tu-equipo' : r.opponentId;
        return `${id} (+${r.played} PJ)`;
      })
      .join('; ');
    issues.push({
      severity: 'warning',
      code: 'MANUAL_STANDINGS',
      message: `${manualStandingsRowCount} fila(s) en standings con ajuste manual distinto de cero (se suman al cálculo automático).`,
      detail: manualRows.length > 12 ? `${sample}; …` : sample,
    });
  }

  if (maxPlayedPerTeam > 0) {
    for (const id of participantIds) {
      const auto = computed.get(id);
      const ap = auto?.played ?? 0;
      if (ap > maxPlayedPerTeam) {
        issues.push({
          severity: 'error',
          code: 'AUTO_PLAYED_OVER_CAP',
          message: `PJ calculados (${ap}) superan el máximo teórico (${maxPlayedPerTeam}) para un calendario todos contra todos a doble.`,
          detail: `Participante: ${id}`,
        });
      }
      const entry = standings.find((s) => s.seasonId === seasonId && s.opponentId === id);
      const mp = entry?.played ?? 0;
      const total = ap + mp;
      if (total > maxPlayedPerTeam) {
        issues.push({
          severity: 'error',
          code: 'TOTAL_PLAYED_OVER_CAP',
          message: `PJ en tabla (${total} = ${ap} auto + ${mp} manual) superan el máximo teórico (${maxPlayedPerTeam}).`,
          detail: `Participante: ${id}`,
        });
      }
    }
  }

  if (team) {
    const rawMyFinished = matches.filter(
      (m) =>
        m.seasonId === seasonId &&
        isFinishedLeagueMatch(m) &&
        (!m.teamId || m.teamId === team.id)
    ).length;
    const dedupedMyFinished = dedupeLeagueMatchesForAggregate(matches, seasonId).filter(
      (m) =>
        isFinishedLeagueMatch(m) && (!m.teamId || m.teamId === team.id)
    ).length;
    const autoMyPlayed = computed.get('my-team')?.played ?? 0;

    if (dedupedMyFinished !== autoMyPlayed) {
      issues.push({
        severity: 'error',
        code: 'MY_TEAM_PJ_INTERNAL_MISMATCH',
        message: `Incoherencia: PJ automáticos de tu equipo (${autoMyPlayed}) no coinciden con partidos de liga deduplicados (${dedupedMyFinished}).`,
        detail: 'Revisa el código de agregación o datos corruptos.',
      });
    } else if (rawMyFinished > dedupedMyFinished) {
      issues.push({
        severity: 'warning',
        code: 'LEAGUE_DEDUP_COLLAPSED',
        message: `Hay ${rawMyFinished} partidos de liga finalizados en Mis Partidos pero la tabla usa ${dedupedMyFinished} tras agrupar (misma clave rival+pierna, o un partido por id si falta isHome).`,
        detail: `${rawMyFinished - dedupedMyFinished} encuentro(s) no suman PJ extra: suelen ser duplicados de la misma pierna.`,
      });
    } else if (rawMyFinished > 0 && duplicateFinishedMatchGroups === 0) {
      issues.push({
        severity: 'warning',
        code: 'MY_TEAM_LEAGUE_ALIGNED',
        message: `Coherencia: tus ${dedupedMyFinished} partido(s) de liga cerrado(s) con marcador se contabilizan en el cálculo automático (PJ tu equipo = ${autoMyPlayed}).`,
      });
    }
  }

  const hasError = issues.some((i) => i.severity === 'error');
  if (!hasError && issues.length === 0) {
    issues.push({
      severity: 'warning',
      code: 'OK',
      message:
        'No se detectaron incoherencias ni ajustes manuales. Si la tabla sigue rara, revisa rivales duplicados o temporadas mezcladas en Firestore.',
    });
  }

  return {
    seasonId,
    teamCount,
    maxPlayedPerTeam,
    issues,
    duplicateFinishedMatchGroups,
    duplicateFinishedFixtureGroups,
    manualStandingsRowCount,
  };
}
