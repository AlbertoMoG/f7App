import React from 'react';
import type {
  Field,
  Injury,
  LeagueFixture,
  Match,
  Opponent,
  Player,
  PlayerSeason,
  PlayerStat,
  Position,
  Season,
  StandingsEntry,
} from '@/types';
import { calculatePlayerRating } from '@/lib/ratingSystem';
import {
  buildBaremoPositionStudy,
  rankPositionLinesByStrength,
  type BaremoRowInput,
  type PositionBaremoFilledStudy,
  type PositionBaremoStudy,
} from '@/lib/baremoPositionStudy';
import { pickIdealBaremoSeven, type IdealBaremoSevenResult } from '@/lib/baremoIdealSeven';
import { buildValoracionPredictionSquad, type ValoracionPredictionSquadResult } from '@/lib/valoracionPredictionSquad';
import { buildValoracionPositionHints } from '@/lib/valoracionPositionHints';
import { usePlayerRatings } from '@/features/ai-analysis/hooks/usePlayerRatings';
import { usePredictions } from '@/features/ai-analysis/hooks/usePredictions';
import { squadMeanBaremo } from '@/lib/optimalRecommendedSquad';
import { buildIdealVsRealComparison, rosterPlayersAttendingMatch, type IdealVsRealComparison } from '@/lib/idealVsRealConvocatoria';

const POSITION_ORDER: Position[] = ['Portero', 'Defensa', 'Medio', 'Delantero'];

export type BaremoTableRowModel = BaremoRowInput;

const SHORT_LINE: Record<Position, string> = {
  Portero: 'POR',
  Defensa: 'DEF',
  Medio: 'MED',
  Delantero: 'DEL',
};

export interface UseBaremoValoracionPositionStudyParams {
  /** Jugadores usados como “lista”: filtros Plantilla en Valoración IA; plantilla de temporada en Laboratorio. */
  listPlayers: Player[];
  teamPlayers: Player[];
  playerSeasons: PlayerSeason[];
  matches: Match[];
  stats: PlayerStat[];
  seasons: Season[];
  injuries: Injury[];
  opponents: Opponent[];
  standings: StandingsEntry[];
  fields: Field[];
  leagueFixtures?: LeagueFixture[];
  globalSeasonId: string;
}

export interface PositionChartBarPoint {
  positionIndex: number;
  label: string;
  media: number;
  techo: number;
}

export interface UseBaremoValoracionPositionStudyResult {
  scheduledNext: Match | null;
  rows: BaremoTableRowModel[];
  teamAvgBaremo: number;
  positionStudies: PositionBaremoStudy[];
  lineStrengthRank: string[];
  idealSeven: IdealBaremoSevenResult;
  idealDeltaVsList: number;
  valoracionPrediction: ValoracionPredictionSquadResult;
  idealVsReal: IdealVsRealComparison | null;
  predDeltaVsFiltered: number;
  improvementHints: string[];
  positionChartBars: PositionChartBarPoint[];
}

export function useBaremoValoracionPositionStudy({
  listPlayers,
  teamPlayers,
  playerSeasons,
  matches,
  stats,
  seasons,
  injuries,
  opponents,
  standings,
  fields,
  leagueFixtures = [],
  globalSeasonId,
}: UseBaremoValoracionPositionStudyParams): UseBaremoValoracionPositionStudyResult {
  const scheduledNext = React.useMemo(() => {
    const scheduled = matches
      .filter((m) => m.status === 'scheduled' && (globalSeasonId === 'all' || m.seasonId === globalSeasonId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return scheduled[0] ?? null;
  }, [matches, globalSeasonId]);

  const { allPlayerRatings } = usePlayerRatings({
    players: teamPlayers,
    playerSeasons,
    matches,
    stats,
    injuries,
    seasons,
    globalSeasonId,
  });

  const predictions = usePredictions({
    players: teamPlayers,
    playerSeasons,
    matches,
    stats,
    opponents,
    seasons,
    fields,
    injuries,
    globalSeasonId,
    standings,
    allPlayerRatings,
    leagueFixtures,
  });

  const rows = React.useMemo((): BaremoTableRowModel[] => {
    const data = listPlayers.map((player) => {
      const r = calculatePlayerRating(matches, injuries, stats, player, globalSeasonId, seasons);
      return {
        player,
        notaFinal: r.notaFinal,
        compromiso: r.notaCompromiso,
        desempeno: r.notaDesempeno,
        fiabilidad: r.factorFiabilidad,
        partidos: r.partidosComputables,
      };
    });
    const teamAvg = data.length > 0 ? data.reduce((a, x) => a + x.notaFinal, 0) / data.length : 0;
    return data.map((x) => ({
      ...x,
      delta: x.notaFinal - teamAvg,
      teamAvg,
    }));
  }, [listPlayers, matches, stats, seasons, injuries, globalSeasonId]);

  const positionStudies = React.useMemo(() => buildBaremoPositionStudy(rows), [rows]);

  const lineStrengthRank = React.useMemo(
    () => rankPositionLinesByStrength(positionStudies),
    [positionStudies]
  );

  const teamAvgBaremo = rows[0]?.teamAvg ?? 0;

  const idealSeven = React.useMemo(() => pickIdealBaremoSeven(rows), [rows]);

  const idealDeltaVsList = idealSeven.avgBaremo - teamAvgBaremo;

  const valoracionPrediction = React.useMemo(() => {
    const rosterAvgBaremoCompute =
      allPlayerRatings.length > 0
        ? allPlayerRatings.reduce((a, p) => a + p.rating, 0) / allPlayerRatings.length
        : 70;

    const focusPred = scheduledNext ? predictions.get(scheduledNext.id) : undefined;
    if (scheduledNext && focusPred && focusPred.recommendedSquad.length > 0) {
      return {
        ok: true,
        message: undefined,
        squad: focusPred.recommendedSquad,
        notes: focusPred.reasons,
        outfieldSlots: focusPred.recommendedOutfieldSlots,
        predGF: focusPred.modelPredGF,
        predGC: focusPred.modelPredGC,
        seasonIdUsed: scheduledNext.seasonId,
        matchId: scheduledNext.id,
        rosterAvgBaremo: rosterAvgBaremoCompute,
        squadMeanBaremo: squadMeanBaremo(focusPred.recommendedSquad, allPlayerRatings, rosterAvgBaremoCompute),
        allPlayerRatings,
        pipelineSynced: true,
      };
    }

    return buildValoracionPredictionSquad({
      teamPlayers,
      playerSeasons,
      matches,
      stats,
      injuries,
      seasons,
      globalSeasonId,
    });
  }, [
    scheduledNext,
    predictions,
    allPlayerRatings,
    teamPlayers,
    playerSeasons,
    matches,
    stats,
    injuries,
    seasons,
    globalSeasonId,
  ]);

  const idealVsReal = React.useMemo(() => {
    if (!valoracionPrediction.ok || !valoracionPrediction.matchId || valoracionPrediction.squad.length === 0) {
      return null;
    }
    const real = rosterPlayersAttendingMatch(teamPlayers, stats, valoracionPrediction.matchId);
    return buildIdealVsRealComparison(
      valoracionPrediction.squad,
      real,
      valoracionPrediction.allPlayerRatings,
      valoracionPrediction.rosterAvgBaremo
    );
  }, [valoracionPrediction, teamPlayers, stats]);

  const predDeltaVsFiltered =
    valoracionPrediction.ok && valoracionPrediction.squad.length > 0
      ? valoracionPrediction.squadMeanBaremo - teamAvgBaremo
      : 0;

  const improvementHints = React.useMemo(() => {
    const filled = positionStudies.filter((x): x is PositionBaremoFilledStudy => !x.empty);
    const extras = valoracionPrediction.ok
      ? valoracionPrediction.notes
      : valoracionPrediction.message
        ? [valoracionPrediction.message]
        : [];
    return buildValoracionPositionHints(filled, extras);
  }, [positionStudies, valoracionPrediction]);

  const positionChartBars = React.useMemo(
    () =>
      positionStudies
        .filter((s): s is PositionBaremoFilledStudy => !s.empty)
        .map((s) => ({
          positionIndex: POSITION_ORDER.indexOf(s.position),
          label: SHORT_LINE[s.position],
          media: Number(s.avgNotaFinal.toFixed(2)),
          techo: Number(s.maxBaremo.toFixed(2)),
        }))
        .sort((a, b) => a.positionIndex - b.positionIndex),
    [positionStudies]
  );

  return {
    scheduledNext,
    rows,
    teamAvgBaremo,
    positionStudies,
    lineStrengthRank,
    idealSeven,
    idealDeltaVsList,
    valoracionPrediction,
    idealVsReal,
    predDeltaVsFiltered,
    improvementHints,
    positionChartBars,
  };
}
