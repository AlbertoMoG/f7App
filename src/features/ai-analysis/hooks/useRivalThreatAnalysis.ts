import React from 'react';
import type { LeagueFixture, Match, Opponent, StandingsEntry, Team } from '../../../types';
import { aggregateLeagueStandingsFromResults } from '../../../lib/leagueStandingsAggregate';
import {
  computeMyTeamThreatRow,
  computeRivalThreatRows,
} from '../../../lib/rivalThreatScore';
import type { RivalThreatRow } from '../../../lib/rivalThreatScore';

export function useRivalThreatAnalysis(
  seasonId: string,
  team: Team | null,
  opponents: Opponent[],
  matches: Match[],
  standings: StandingsEntry[],
  leagueFixtures: LeagueFixture[]
): { rows: RivalThreatRow[]; managedTeamRow: RivalThreatRow | null } {
  return React.useMemo(() => {
    const leagueStandingsAgg = aggregateLeagueStandingsFromResults(
      seasonId,
      team,
      opponents,
      matches,
      leagueFixtures
    );
    const rows = computeRivalThreatRows(
      seasonId,
      opponents,
      matches,
      standings,
      leagueFixtures,
      leagueStandingsAgg
    );
    const managedTeamRow =
      computeMyTeamThreatRow(seasonId, team, matches, standings, leagueFixtures, leagueStandingsAgg) ??
      null;
    return { rows, managedTeamRow };
  }, [seasonId, team, opponents, matches, standings, leagueFixtures]);
}
export type { RivalThreatRow };
