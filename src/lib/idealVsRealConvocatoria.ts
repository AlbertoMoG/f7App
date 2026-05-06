import type { Player, PlayerStat } from '@/types';
import type { PlayerRating } from '@/types/aiAnalysis';
import { posOrder } from '@/types/aiAnalysis';

function sortPitchOrder(a: Player, b: Player): number {
  const po = posOrder[a.position] - posOrder[b.position];
  if (po !== 0) return po;
  return a.number - b.number;
}

function meanBaremo(players: Player[], ratings: PlayerRating[], fb: number): number {
  if (players.length === 0) return 0;
  return (
    players.reduce((acc, p) => acc + (ratings.find((r) => r.id === p.id)?.rating ?? fb), 0) / players.length
  );
}

export type IdealVsRealComparison = {
  ideal: Player[];
  real: Player[];
  inBoth: Player[];
  onlyIdeal: Player[];
  onlyReal: Player[];
  avgIdeal: number;
  avgReal: number;
  avgOverlap: number;
  deltaAvgIdealMinusReal: number;
};

export function rosterPlayersAttendingMatch(
  rosterPlayers: Player[],
  stats: PlayerStat[],
  matchId: string | undefined
): Player[] {
  if (!matchId) return [];
  const ids = new Set(
    stats.filter((s) => s.matchId === matchId && s.attendance === 'attending').map((s) => s.playerId)
  );
  return rosterPlayers.filter((p) => ids.has(p.id)).sort(sortPitchOrder);
}

export function buildIdealVsRealComparison(
  ideal: Player[],
  real: Player[],
  ratings: PlayerRating[],
  rosterAvgFallback: number
): IdealVsRealComparison {
  const idealIds = new Set(ideal.map((p) => p.id));
  const realIds = new Set(real.map((p) => p.id));
  const inBoth = ideal.filter((p) => realIds.has(p.id)).sort(sortPitchOrder);
  const onlyIdeal = ideal.filter((p) => !realIds.has(p.id)).sort(sortPitchOrder);
  const onlyReal = real.filter((p) => !idealIds.has(p.id)).sort(sortPitchOrder);
  const avgIdeal = meanBaremo(ideal, ratings, rosterAvgFallback);
  const avgReal = meanBaremo(real, ratings, rosterAvgFallback);
  return {
    ideal,
    real: [...real].sort(sortPitchOrder),
    inBoth,
    onlyIdeal,
    onlyReal,
    avgIdeal,
    avgReal,
    avgOverlap: meanBaremo(inBoth, ratings, rosterAvgFallback),
    deltaAvgIdealMinusReal: avgIdeal - avgReal,
  };
}
