import type { LeagueFixture } from '../types';

export function parseRoundNumber(round: string | null | undefined): number {
  return parseInt(round?.replace(/\D/g, '') || '0', 10);
}

/** Orden calendario: jornada ascendente, luego texto de round, luego par local-visitante. */
export function compareLeagueFixturesCalendarOrder(a: LeagueFixture, b: LeagueFixture): number {
  const ja = parseRoundNumber(a.round);
  const jb = parseRoundNumber(b.round);
  if (ja !== jb) return ja - jb;
  const ra = (a.round ?? '').localeCompare(b.round ?? '', 'es');
  if (ra !== 0) return ra;
  return `${a.homeOpponentId}|${a.awayOpponentId}`.localeCompare(
    `${b.homeOpponentId}|${b.awayOpponentId}`
  );
}

/** Más reciente primero: jornada mayor primero; desempate fecha y luego ids. */
export function compareLeagueFixturesRecentFirst(a: LeagueFixture, b: LeagueFixture): number {
  const ja = parseRoundNumber(a.round);
  const jb = parseRoundNumber(b.round);
  if (jb !== ja) return jb - ja;
  const da = new Date(a.date).getTime();
  const db = new Date(b.date).getTime();
  if (db !== da) return db - da;
  return `${b.homeOpponentId}|${b.awayOpponentId}`.localeCompare(
    `${a.homeOpponentId}|${a.awayOpponentId}`
  );
}
