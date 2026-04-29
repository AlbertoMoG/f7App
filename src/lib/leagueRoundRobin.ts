import type { LeagueFixture } from '../types';

export function hasLeagueFixture(
  fixtures: LeagueFixture[],
  seasonId: string,
  homeId: string,
  awayId: string
): boolean {
  return fixtures.some(
    (f) =>
      f.seasonId === seasonId &&
      f.homeOpponentId === homeId &&
      f.awayOpponentId === awayId
  );
}

export type LeagueFixtureSeed = {
  teamId: string;
  seasonId: string;
  homeOpponentId: string;
  awayOpponentId: string;
  date: string;
  status: 'scheduled';
  round: string;
};

/** Ida y vuelta entre todos los pares de rivales; solo crea huecos que no existan ya. */
export function buildMissingRoundRobinFixtures(
  teamId: string,
  seasonId: string,
  opponentIds: string[],
  seasonStartYear: number,
  existing: LeagueFixture[]
): LeagueFixtureSeed[] {
  const sorted = [...new Set(opponentIds)].sort((a, b) => a.localeCompare(b));
  const rows: Omit<LeagueFixtureSeed, 'date' | 'round'>[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (!hasLeagueFixture(existing, seasonId, a, b)) {
        rows.push({
          teamId,
          seasonId,
          homeOpponentId: a,
          awayOpponentId: b,
          status: 'scheduled',
        });
      }
      if (!hasLeagueFixture(existing, seasonId, b, a)) {
        rows.push({
          teamId,
          seasonId,
          homeOpponentId: b,
          awayOpponentId: a,
          status: 'scheduled',
        });
      }
    }
  }
  /** Solo cumple reglas Firestore; la UI ordena por jornada, no por fecha. */
  const placeholderDate = new Date(seasonStartYear, 7, 1).toISOString();
  return rows.map((row, idx) => ({
    ...row,
    date: placeholderDate,
    round: `Jornada ${idx + 1}`,
  }));
}
