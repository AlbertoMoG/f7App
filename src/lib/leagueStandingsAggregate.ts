import type { LeagueFixture, Match, Opponent, Team } from '../types';

/**
 * Liga en “mis partidos”: excluye amistoso/copa.
 * Incluye `type === 'league'` y, por compatibilidad, `type` ausente si hay jornada (calendario de liga).
 */
export function isLeagueMatchForStandings(m: Match): boolean {
  if (m.type === 'friendly' || m.type === 'cup') return false;
  if (m.type === 'league') return true;
  if (m.type == null) {
    const r = m.round != null ? String(m.round).trim() : '';
    return r.length > 0;
  }
  return false;
}

/** Partido de liga contabilizable en clasificación: cerrado y con marcador completo. */
export function isFinishedLeagueMatch(m: Match): boolean {
  if (!isLeagueMatchForStandings(m)) return false;
  if (m.status !== 'completed') return false;
  return m.scoreTeam != null && m.scoreOpponent != null;
}

/** Enfrentamiento entre equipos contabilizable en clasificación. */
export function isFinishedLeagueFixture(f: LeagueFixture): boolean {
  if (f.status !== 'completed') return false;
  return f.scoreHome != null && f.scoreAway != null;
}

function matchHasFinalScore(m: Match): boolean {
  return isFinishedLeagueMatch(m);
}

function fixtureHasFinalScore(f: LeagueFixture): boolean {
  return isFinishedLeagueFixture(f);
}

/** Una fila por par (local, visitante): prioriza marcador cerrado y doc más reciente. */
function dedupeLeagueFixturesForAggregate(fixtures: LeagueFixture[], seasonId: string): LeagueFixture[] {
  const sorted = [...fixtures]
    .filter((f) => f.seasonId === seasonId)
    .sort((a, b) => {
      const ac = fixtureHasFinalScore(a) ? 1 : 0;
      const bc = fixtureHasFinalScore(b) ? 1 : 0;
      if (bc !== ac) return bc - ac;
      return b.id.localeCompare(a.id);
    });
  const seen = new Set<string>();
  const out: LeagueFixture[] = [];
  for (const f of sorted) {
    const key = `${f.homeOpponentId}\0${f.awayOpponentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/** Un partido por temporada, rival y pierna (local/visitante) para no sumar duplicados en Firestore. */
function dedupeLeagueMatchesForAggregate(matches: Match[], seasonId: string): Match[] {
  const sorted = [...matches]
    .filter((m) => m.seasonId === seasonId && isLeagueMatchForStandings(m))
    .sort((a, b) => {
      const ac = matchHasFinalScore(a) ? 1 : 0;
      const bc = matchHasFinalScore(b) ? 1 : 0;
      if (bc !== ac) return bc - ac;
      return b.id.localeCompare(a.id);
    });
  const seen = new Set<string>();
  const out: Match[] = [];
  for (const m of sorted) {
    const leg = m.isHome === false ? 'away' : 'home';
    const key = `${m.opponentId}\0${leg}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export type LeagueStandingStats = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

export function emptyLeagueStandingStats(): LeagueStandingStats {
  return {
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

function addMatchResult(s: LeagueStandingStats, goalsFor: number, goalsAgainst: number) {
  s.played++;
  s.goalsFor += goalsFor;
  s.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) s.won++;
  else if (goalsFor < goalsAgainst) s.lost++;
  else s.drawn++;
  s.points = s.won * 3 + s.drawn;
}

/**
 * Estadísticas de liga por equipo: solo partidos `type === 'league'` completados
 * en "mis partidos" y en `leagueFixtures` (liga entre equipos del grupo).
 */
export function aggregateLeagueStandingsFromResults(
  seasonId: string,
  team: Team | null,
  opponents: Opponent[],
  matches: Match[],
  leagueFixtures: LeagueFixture[]
): Map<string, LeagueStandingStats> {
  const map = new Map<string, LeagueStandingStats>();

  const ensure = (id: string): LeagueStandingStats => {
    let x = map.get(id);
    if (!x) {
      x = emptyLeagueStandingStats();
      map.set(id, x);
    }
    return x;
  };

  const fixturesForSeason = dedupeLeagueFixturesForAggregate(leagueFixtures, seasonId);
  for (const f of fixturesForSeason) {
    if (!isFinishedLeagueFixture(f)) continue;
    const home = ensure(f.homeOpponentId);
    const away = ensure(f.awayOpponentId);
    addMatchResult(home, f.scoreHome, f.scoreAway);
    addMatchResult(away, f.scoreAway, f.scoreHome);
  }

  const matchesForSeason = dedupeLeagueMatchesForAggregate(matches, seasonId);
  for (const m of matchesForSeason) {
    if (!isFinishedLeagueMatch(m)) continue;
    if (!team) continue;
    if (m.teamId && m.teamId !== team.id) continue;
    const mine = ensure('my-team');
    const opp = ensure(m.opponentId);
    addMatchResult(mine, m.scoreTeam, m.scoreOpponent);
    addMatchResult(opp, m.scoreOpponent, m.scoreTeam);
  }

  return map;
}

/** Ids que deben poder aparecer en la tabla (temporada). */
export function collectStandingsParticipantIds(
  seasonId: string,
  team: Team | null,
  opponents: Opponent[],
  matches: Match[],
  leagueFixtures: LeagueFixture[],
  standingsOpponentIds: string[]
): string[] {
  const ids = new Set<string>();
  if (team) ids.add('my-team');
  opponents
    .filter((o) => o.seasonIds?.includes(seasonId))
    .forEach((o) => ids.add(o.id));
  leagueFixtures
    .filter((f) => f.seasonId === seasonId)
    .forEach((f) => {
      ids.add(f.homeOpponentId);
      ids.add(f.awayOpponentId);
    });
  matches
    .filter((m) => m.seasonId === seasonId && isLeagueMatchForStandings(m))
    .forEach((m) => ids.add(m.opponentId));
  standingsOpponentIds.forEach((id) => ids.add(id));
  return [...ids].filter((id) => id !== 'my-team' || team).sort((a, b) => {
    if (a === 'my-team') return -1;
    if (b === 'my-team') return 1;
    return a.localeCompare(b);
  });
}
