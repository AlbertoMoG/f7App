import type { Injury, Match, Player, PlayerSeason, PlayerStat, Season } from '../types';
import { calculatePlayerRating, type PlayerRatingReport } from './ratingSystem';
import { buildSynergyMap, getSynergyKey, type SynergyData } from './synergyCalculator';

export interface PositionStrengthRow {
  position: string;
  count: number;
  avgBaremo: number;
}

export interface LowReliabilityPlayer {
  playerId: string;
  displayName: string;
  position: string;
  notaFinal: number;
  factorFiabilidad: number;
  partidosComputables: number;
}

export interface SynergyPairHighlight {
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  winRate: number;
  matchCount: number;
  isLethal: boolean;
}

export interface PlantillaIaSnapshot {
  rosterSize: number;
  teamAvgBaremo: number;
  stdDevBaremo: number;
  byPosition: PositionStrengthRow[];
  lowReliability: LowReliabilityPlayer[];
  synergyPairs: SynergyPairHighlight[];
}

function displayName(p: Player): string {
  return (p.alias?.trim() || `${p.firstName} ${p.lastName}`).trim();
}

function rosterForSeason(
  players: Player[],
  playerSeasons: PlayerSeason[],
  seasonId: string
): Player[] {
  const ids = new Set(
    seasonId === 'all'
      ? playerSeasons.map((ps) => ps.playerId)
      : playerSeasons.filter((ps) => ps.seasonId === seasonId).map((ps) => ps.playerId)
  );
  return players.filter((p) => ids.has(p.id));
}

/** Desviación típica del baremo; 0 si hay menos de 2 jugadores. */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, x) => a + x, 0) / values.length;
  const v = values.reduce((a, x) => a + (x - m) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

export function computePlantillaIaSnapshot(
  players: Player[],
  playerSeasons: PlayerSeason[],
  matches: Match[],
  stats: PlayerStat[],
  injuries: Injury[],
  seasons: Season[],
  globalSeasonId: string,
  synergyMap: Map<string, SynergyData>
): PlantillaIaSnapshot {
  const roster = rosterForSeason(players, playerSeasons, globalSeasonId);
  const reports: { player: Player; r: PlayerRatingReport }[] = roster.map((player) => ({
    player,
    r: calculatePlayerRating(matches, injuries, stats, player, globalSeasonId, seasons),
  }));

  const notas = reports.map((x) => x.r.notaFinal);
  const teamAvgBaremo =
    notas.length > 0 ? notas.reduce((a, x) => a + x, 0) / notas.length : 0;
  const stdDevBaremo = stdDev(notas);

  const byPosMap = new Map<string, { sum: number; n: number }>();
  for (const { player, r } of reports) {
    const pos = player.position;
    const cur = byPosMap.get(pos) || { sum: 0, n: 0 };
    cur.sum += r.notaFinal;
    cur.n += 1;
    byPosMap.set(pos, cur);
  }
  const positionOrder = ['Portero', 'Defensa', 'Medio', 'Delantero'];
  const byPosition: PositionStrengthRow[] = positionOrder
    .filter((pos) => byPosMap.has(pos))
    .map((position) => {
      const { sum, n } = byPosMap.get(position)!;
      return { position, count: n, avgBaremo: sum / n };
    });

  const lowReliability: LowReliabilityPlayer[] = reports
    .filter(
      ({ r }) => r.factorFiabilidad < 0.72 || r.partidosComputables <= 3 || r.partidosComputables === 0
    )
    .map(({ player, r }) => ({
      playerId: player.id,
      displayName: displayName(player),
      position: player.position,
      notaFinal: r.notaFinal,
      factorFiabilidad: r.factorFiabilidad,
      partidosComputables: r.partidosComputables,
    }))
    .sort((a, b) => a.factorFiabilidad - b.factorFiabilidad || a.partidosComputables - b.partidosComputables);

  const idSet = new Set(roster.map((p) => p.id));
  const idToPlayer = Object.fromEntries(roster.map((p) => [p.id, p])) as Record<string, Player>;
  const pairs: SynergyPairHighlight[] = [];
  const ids = roster.map((p) => p.id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!;
      const b = ids[j]!;
      const data = synergyMap.get(getSynergyKey(a, b));
      if (!data || data.matchCount < 2) continue;
      if (!idSet.has(a) || !idSet.has(b)) continue;
      const pa = idToPlayer[a];
      const pb = idToPlayer[b];
      if (!pa || !pb) continue;
      pairs.push({
        playerAId: a,
        playerBId: b,
        playerAName: displayName(pa),
        playerBName: displayName(pb),
        winRate: data.winRate,
        matchCount: data.matchCount,
        isLethal: data.isLethal,
      });
    }
  }
  pairs.sort((x, y) => {
    if (x.isLethal !== y.isLethal) return x.isLethal ? -1 : 1;
    if (y.winRate !== x.winRate) return y.winRate - x.winRate;
    return y.matchCount - x.matchCount;
  });

  return {
    rosterSize: roster.length,
    teamAvgBaremo,
    stdDevBaremo,
    byPosition,
    lowReliability: lowReliability.slice(0, 12),
    synergyPairs: pairs.slice(0, 8),
  };
}
