import type { Injury, Match, Player, PlayerSeason, PlayerStat, Season } from '@/types';
import type { PlayerRating } from '@/types/aiAnalysis';
import { calculatePlayerRating } from '@/lib/ratingSystem';
import { buildSynergyMap } from '@/lib/synergyCalculator';
import {
  buildOptimalRecommendedSquadAutoOutfield,
  squadMeanBaremo,
} from '@/lib/optimalRecommendedSquad';

export type ValoracionPredictionSquadResult = {
  ok: boolean;
  message?: string;
  squad: Player[];
  notes: string[];
  outfieldSlots: number;
  predGF: number;
  predGC: number;
  seasonIdUsed: string;
  matchId?: string;
  /** Media baremo jugadores elegibles temporada (pool). */
  rosterAvgBaremo: number;
  /** Media baremo de la convocatoria modelo IA. */
  squadMeanBaremo: number;
  allPlayerRatings: PlayerRating[];
  /** True si viene del mismo resultado que Inteligencia IA (λ y squad del pipeline). */
  pipelineSynced?: boolean;
};

/**
 * Convocatoria alineada con el motor de predicciones (`usePredictions`):
 * sinergias, formación 2-3-1, cupo 10–12 campo, disponibilidad al próximo partido si existe.
 */
export function buildValoracionPredictionSquad(params: {
  teamPlayers: Player[];
  playerSeasons: PlayerSeason[];
  matches: Match[];
  stats: PlayerStat[];
  injuries: Injury[];
  seasons: Season[];
  globalSeasonId: string;
}): ValoracionPredictionSquadResult {
  const { teamPlayers, playerSeasons, matches, stats, injuries, seasons, globalSeasonId } = params;

  let seasonIdUsed: string | null = globalSeasonId !== 'all' ? globalSeasonId : null;

  const scheduledForNav = matches
    .filter((m) => m.status === 'scheduled' && (globalSeasonId === 'all' || m.seasonId === globalSeasonId))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextMatch = scheduledForNav[0];

  if (!seasonIdUsed && nextMatch) seasonIdUsed = nextMatch.seasonId;
  if (!seasonIdUsed) {
    const sid = playerSeasons[0]?.seasonId ?? null;
    seasonIdUsed = sid;
  }
  if (!seasonIdUsed) {
    return {
      ok: false,
      message: 'No hay temporada definida para calcular la convocatoria modelo.',
      squad: [],
      notes: [],
      outfieldSlots: 10,
      predGF: 1.5,
      predGC: 1.5,
      seasonIdUsed: '',
      rosterAvgBaremo: 70,
      squadMeanBaremo: 70,
      allPlayerRatings: [],
      pipelineSynced: false,
    };
  }

  const rosterIds = new Set(playerSeasons.filter((ps) => ps.seasonId === seasonIdUsed).map((ps) => ps.playerId));
  const rosterPlayers = teamPlayers.filter((p) => rosterIds.has(p.id));

  const allPlayerRatings: PlayerRating[] = rosterPlayers.map((p) => {
    const r = calculatePlayerRating(matches, injuries, stats, p, seasonIdUsed!, seasons);
    return { id: p.id, rating: r.notaFinal };
  });

  const rosterAvgBaremo =
    allPlayerRatings.length > 0
      ? allPlayerRatings.reduce((a, pr) => a + pr.rating, 0) / allPlayerRatings.length
      : 70;

  const scored = matches.filter(
    (m) => m.status === 'completed' && m.scoreTeam != null && m.scoreOpponent != null
  );
  let baseline = scored.filter((m) => m.type === 'league');
  if (baseline.length === 0) baseline = scored;
  if (nextMatch) {
    const sameSeason = baseline.filter((m) => m.seasonId === nextMatch.seasonId);
    if (sameSeason.length >= 3) baseline = sameSeason;
  }

  const predGF =
    baseline.length > 0
      ? baseline.reduce((a, m) => a + (m.scoreTeam ?? 0), 0) / baseline.length
      : 1.5;
  const predGC =
    baseline.length > 0
      ? baseline.reduce((a, m) => a + (m.scoreOpponent ?? 0), 0) / baseline.length
      : 1.5;

  const synergyMap = buildSynergyMap(matches, stats);

  const { squad, notes, outfieldSlots } = buildOptimalRecommendedSquadAutoOutfield({
    players: rosterPlayers,
    playerSeasons,
    seasonId: seasonIdUsed,
    matchId: nextMatch?.id,
    stats,
    injuries,
    allPlayerRatings,
    teamAvgBaremo: rosterAvgBaremo,
    synergyMap,
    formation: '2-3-1',
    predGF,
    predGC,
  });

  const avgSquad = squadMeanBaremo(squad, allPlayerRatings, rosterAvgBaremo);

  return {
    ok: true,
    squad,
    notes,
    outfieldSlots,
    predGF,
    predGC,
    seasonIdUsed,
    matchId: nextMatch?.id,
    rosterAvgBaremo,
    squadMeanBaremo: avgSquad,
    allPlayerRatings,
    pipelineSynced: false,
  };
}
