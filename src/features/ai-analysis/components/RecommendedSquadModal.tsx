import React from 'react';
import { Match, Opponent, Player, PlayerSeason, PlayerStat, Injury } from '../../../types';
import { MatchPrediction, PlayerRating } from '../../../types/aiAnalysis';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Trophy, Shield, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildOptimalRecommendedSquad,
  LINEUP_FORMATION_OPTIONS,
  type LineupFormationId,
  getFormationLineMinimums,
  pickOutfieldSlotsForHighestSquadBaremo,
  OUTFIELD_SLOT_OPTIONS,
  squadMeanBaremo,
} from '../../../lib/optimalRecommendedSquad';
import type { SynergyData } from '../../../lib/synergyCalculator';

interface RecommendedSquadModalProps {
  matchId: string | null;
  onClose: () => void;
  matches: Match[];
  opponents: Opponent[];
  predictions: Map<string, MatchPrediction>;
  teamShieldUrl?: string;
  teamName?: string;
  players: Player[];
  playerSeasons: PlayerSeason[];
  stats: PlayerStat[];
  injuries: Injury[];
  allPlayerRatings: PlayerRating[];
  synergyMap: Map<string, SynergyData>;
  /** Cuando no hay predicción (p.ej. menos de 5 convocados): λ GF/GC para sesgar el builder. */
  fallbackModelLambdas?: { gf: number; gc: number };
}

export const RecommendedSquadModal = React.memo(function RecommendedSquadModal({
  matchId,
  onClose,
  matches,
  opponents,
  predictions,
  teamShieldUrl,
  teamName,
  players,
  playerSeasons,
  stats,
  injuries,
  allPlayerRatings,
  synergyMap,
  fallbackModelLambdas = { gf: 1.5, gc: 1.5 },
}: RecommendedSquadModalProps) {
  const [formation, setFormation] = React.useState<LineupFormationId>('2-3-1');
  const [outfieldSlots, setOutfieldSlots] = React.useState<number>(11);

  const match = React.useMemo(() => matches.find((m) => m.id === matchId), [matches, matchId]);
  const opponent = React.useMemo(
    () => opponents.find((o) => o.id === match?.opponentId),
    [opponents, match]
  );
  const prediction = React.useMemo(
    () => (matchId ? predictions.get(matchId) : undefined),
    [predictions, matchId]
  );

  const modelGF = prediction?.modelPredGF ?? fallbackModelLambdas.gf;
  const modelGC = prediction?.modelPredGC ?? fallbackModelLambdas.gc;

  const teamAvgBaremo = React.useMemo(() => {
    if (allPlayerRatings.length === 0) return 70;
    return allPlayerRatings.reduce((a, r) => a + r.rating, 0) / allPlayerRatings.length;
  }, [allPlayerRatings]);

  React.useEffect(() => {
    if (!matchId) return;
    const m = matches.find((x) => x.id === matchId);
    if (!m) return;
    setFormation('2-3-1');
    const predRow = predictions.get(matchId);
    const gf = predRow?.modelPredGF ?? fallbackModelLambdas.gf;
    const gc = predRow?.modelPredGC ?? fallbackModelLambdas.gc;
    const n = pickOutfieldSlotsForHighestSquadBaremo({
      players,
      playerSeasons,
      seasonId: m.seasonId,
      matchId: m.id,
      stats,
      injuries,
      allPlayerRatings,
      teamAvgBaremo,
      synergyMap,
      formation: '2-3-1',
      predGF: gf,
      predGC: gc,
    });
    setOutfieldSlots(n);
     
  }, [matchId]);

  const built = React.useMemo(() => {
    if (!match) return null;
    return buildOptimalRecommendedSquad({
      players,
      playerSeasons,
      seasonId: match.seasonId,
      matchId: match.id,
      stats,
      injuries,
      allPlayerRatings,
      teamAvgBaremo,
      synergyMap,
      formation,
      outfieldSlots,
      predGF: modelGF,
      predGC: modelGC,
    });
  }, [
    match,
    modelGF,
    modelGC,
    players,
    playerSeasons,
    stats,
    injuries,
    allPlayerRatings,
    teamAvgBaremo,
    synergyMap,
    formation,
    outfieldSlots,
  ]);

  const lineMin = getFormationLineMinimums(formation);

  if (!match) return null;

  const squad = built?.squad ?? [];
  const outfieldInSquad = squad.filter((p) => p.position !== 'Portero').length;
  const hasGk = squad.some((p) => p.position === 'Portero');
  const squadBaremoAvg =
    squad.length > 0 ? squadMeanBaremo(squad, allPlayerRatings, teamAvgBaremo) : 0;

  return (
    <Dialog open={!!matchId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shrink-0 relative">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            {teamShieldUrl ? (
              <img
                src={teamShieldUrl}
                alt=""
                className="w-32 h-32 object-contain grayscale brightness-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Shield size={120} />
            )}
          </div>
          <DialogHeader className="relative z-10 text-left">
            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Sparkles className="text-emerald-200 fill-emerald-200" size={24} />
              Convocatoria ideal {teamName ? `· ${teamName}` : ''}
            </DialogTitle>
            <DialogDescription className="text-emerald-50 text-sm mt-1">
              vs {opponent?.name || 'Rival'} · 10–12 jugadores de campo + 1 portero · Según formación y modelo
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-400 tracking-widest">
                <LayoutGrid size={14} />
                <span>Sistema táctico</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Formación (líneas de campo)
                  </Label>
                  <Select
                    value={formation}
                    onValueChange={(v) => setFormation(v as LineupFormationId)}
                  >
                    <SelectTrigger className="rounded-xl bg-white">
                      <SelectValue placeholder="Formación">{formation}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {LINEUP_FORMATION_OPTIONS.map((f) => {
                        const m = getFormationLineMinimums(f);
                        return (
                          <SelectItem key={f} value={f}>
                            {f} (def {m.def} · med {m.mid} · del {m.fwd})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Jugadores de campo (sin portero)
                  </Label>
                  <Select
                    value={String(outfieldSlots)}
                    onValueChange={(v) => setOutfieldSlots(Number(v))}
                  >
                    <SelectTrigger className="rounded-xl bg-white">
                      <SelectValue placeholder="Cupo">{outfieldSlots}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {OUTFIELD_SLOT_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} en campo
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-[9px] font-bold uppercase h-8 rounded-lg border-gray-200"
                    onClick={() => {
                      if (!match) return;
                      setOutfieldSlots(
                        pickOutfieldSlotsForHighestSquadBaremo({
                          players,
                          playerSeasons,
                          seasonId: match.seasonId,
                          matchId: match.id,
                          stats,
                          injuries,
                          allPlayerRatings,
                          teamAvgBaremo,
                          synergyMap,
                          formation,
                          predGF: modelGF,
                          predGC: modelGC,
                        })
                      );
                    }}
                  >
                    Mejor baremo (10–12)
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Mínimos en campo por sistema: {lineMin.def} def · {lineMin.mid} med · {lineMin.fwd} del. Los huecos hasta{' '}
                {outfieldSlots} los completa baremo + sinergias (modelo {modelGF.toFixed(2)} GF / {modelGC.toFixed(2)} GC).
                {prediction &&
                  formation === '2-3-1' &&
                  outfieldSlots === prediction.recommendedOutfieldSlots && (
                    <span className="text-emerald-600 font-bold">
                      {' '}
                      Coincide con la convocatoria de la tarjeta de predicción.
                    </span>
                  )}
              </p>
            </div>

            {prediction ? (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-xs font-black uppercase text-gray-400 tracking-widest">
                  <Trophy size={14} />
                  <span>Impacto global del partido (convocatoria actual)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-[9px] font-black uppercase text-emerald-600 mb-1">
                      Victoria (actual)
                    </p>
                    <p className="text-2xl font-black text-emerald-700 tabular-nums">
                      {prediction.probabilities.win.toFixed(0)}%
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-[9px] font-black uppercase text-amber-700 mb-1">Empate (actual)</p>
                    <p className="text-2xl font-black text-amber-800 tabular-nums">
                      {prediction.probabilities.draw.toFixed(0)}%
                    </p>
                  </div>
                  <div className="p-3 bg-violet-50 rounded-xl border border-violet-100">
                    <p className="text-[9px] font-black uppercase text-violet-700 mb-1">Puntuar (V + E)</p>
                    <p className="text-2xl font-black text-violet-800 tabular-nums">
                      {Math.min(100, prediction.probabilities.win + prediction.probabilities.draw).toFixed(0)}%
                    </p>
                    <p className="text-[9px] text-violet-600/90 mt-1 leading-tight">
                      Prob. de sumar al menos 1 pt
                    </p>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-[9px] font-black uppercase text-blue-600 mb-1">Marcador más probable</p>
                  <p className="text-2xl font-black text-blue-700 tabular-nums">
                    {prediction.team} - {prediction.opponent}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
                  <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                    <span className="font-black text-emerald-600 uppercase mr-1">Criterios:</span>
                    Lesionados excluidos; bajas y justificadas del partido excluidas; dudas penalizadas ligeramente.
                    Se priorizan sinergias letales al completar el banquillo táctico.
                  </p>
                  {built?.notes.map((n, i) => (
                    <p
                      key={i}
                      className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5"
                    >
                      {n}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                  <span className="font-black text-amber-600 uppercase mr-1">Modelo parcial:</span>
                  Aún no hay predicción completa (se suelen necesitar al menos 5 convocados). El sesgo táctico usa
                  las medias históricas de goles del equipo ({modelGF.toFixed(2)} GF / {modelGC.toFixed(2)} GC).
                  Completa la convocatoria en el partido para alinear con el análisis del rival.
                </p>
                {built?.notes.map((n, i) => (
                  <p
                    key={i}
                    className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5"
                  >
                    {n}
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  Convocatoria: {outfieldInSquad}/{outfieldSlots} campo
                  {hasGk ? ' + portero' : ' · sin portero'}
                  {squad.length > 0 ? ` (${squad.length} total)` : ''}
                </span>
                {squad.length > 0 && (
                  <span className="text-gray-400 font-bold normal-case tracking-normal tabular-nums">
                    Baremo medio {squadBaremoAvg.toFixed(1)}
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {squad.map((player, idx) => (
                  <div
                    key={player.id}
                    className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3"
                  >
                    <span className="text-xs font-black text-gray-200 w-4">{idx + 1}</span>
                    <Avatar className="h-10 w-10 rounded-lg shrink-0 border border-gray-50">
                      <AvatarImage
                        src={player.photoUrl}
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <AvatarFallback className="bg-gray-100 text-gray-500 text-xs font-bold">
                        {player.firstName[0]}
                        {player.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {player.alias || player.firstName}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] h-4 px-1.5 font-bold border-none',
                          player.position === 'Portero'
                            ? 'bg-amber-100 text-amber-500'
                            : player.position === 'Defensa'
                              ? 'bg-blue-100 text-blue-500'
                              : player.position === 'Medio'
                                ? 'bg-emerald-100 text-emerald-500'
                                : 'bg-red-100 text-red-500'
                        )}
                      >
                        {player.position}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11"
            onClick={onClose}
          >
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
