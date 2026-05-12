import type { Field, Lineup, Opponent, Player, Season } from '@/types';

/** O(1) lookup by document id (stable Map instance per call — memoize at call site). */
export function toPlayerMap(players: Player[]): Map<string, Player> {
  return new Map(players.map((p) => [p.id, p]));
}

export function toOpponentMap(opponents: Opponent[]): Map<string, Opponent> {
  return new Map(opponents.map((o) => [o.id, o]));
}

export function toSeasonMap(seasons: Season[]): Map<string, Season> {
  return new Map(seasons.map((s) => [s.id, s]));
}

export function toFieldMap(fields: Field[]): Map<string, Field> {
  return new Map(fields.map((f) => [f.id, f]));
}

/** MatchId -> first lineup with that matchId (if multiple, first wins — same as .find). */
export function toLineupByMatchIdMap(lineups: Lineup[]): Map<string, Lineup> {
  const m = new Map<string, Lineup>();
  for (const l of lineups) {
    if (l.matchId && !m.has(l.matchId)) m.set(l.matchId, l);
  }
  return m;
}
