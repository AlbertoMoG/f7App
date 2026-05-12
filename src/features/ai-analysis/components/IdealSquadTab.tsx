import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatMatchDate, getOpponentName, getSeasonName } from '@/lib/matchDisplayLabel';
import { Calendar, ExternalLink, Info, LayoutGrid, Sparkles } from 'lucide-react';
import type { Match, Opponent, PlayerStat, Season, Field } from '../../../types';
import type { MatchPrediction } from '../../../types/aiAnalysis';

export interface IdealSquadTabProps {
  scheduledMatches: Match[];
  stats: PlayerStat[];
  opponents: Opponent[];
  seasons: Season[];
  fields?: Field[];
  predictions: Map<string, MatchPrediction>;
  onOpenDetail: (matchId: string) => void;
  onNavigateToMatch?: (matchId: string) => void;
}

export const IdealSquadTab = React.memo(function IdealSquadTab({
  scheduledMatches,
  stats,
  opponents,
  seasons,
  fields,
  predictions,
  onOpenDetail,
  onNavigateToMatch,
}: IdealSquadTabProps) {
  return (
    <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="text-emerald-600 shrink-0" size={22} />
              Convocatoria ideal IA
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="p-1 bg-transparent hover:bg-gray-100 rounded-full transition-colors cursor-help">
                      <Info size={14} className="text-gray-300 hover:text-gray-400" />
                    </span>
                  }
                />
                <TooltipContent className="max-w-[280px] p-4 bg-[#141414] text-white border border-white/10 rounded-2xl text-xs leading-relaxed">
                  Entre 10 y 12 jugadores de campo (además del portero), mínimos por línea según la formación (2-3-1,
                  3-2-1…). Por defecto se elige el cupo que maximiza el baremo medio de la lista.
                  Se excluyen lesionados y bajas del partido; las sinergias influyen al completar la lista. El sesgo
                  defensivo/ofensivo usa el modelo predictivo del partido o, si aún no hay 5 convocados, las medias de
                  goles del equipo.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>
              Propuesta táctica por partido programado, alineada con el simulador de alineaciones.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {scheduledMatches.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">
            No hay partidos programados en el filtro de temporada actual.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scheduledMatches.map((match) => {
              const attendingCount = stats.filter(
                (s) => s.matchId === match.id && s.attendance === 'attending'
              ).length;
              const prediction = predictions.get(match.id);
              const rivalName = getOpponentName(opponents, match.opponentId, '—');
              const seasonName = getSeasonName(seasons, match.seasonId, { missingLabel: '' });
              const field = fields?.find((f) => f.id === match.fieldId);

              return (
                <div
                  key={match.id}
                  className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col"
                >
                  <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100 flex justify-between items-center gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <Badge
                        variant="outline"
                        className="bg-white border-gray-200 text-gray-500 text-[10px] h-5 font-black uppercase shrink-0"
                      >
                        {match.type === 'league'
                          ? `Jornada ${match.round}`
                          : match.type === 'cup'
                            ? 'Copa'
                            : 'Amistoso'}
                      </Badge>
                      {match.isHome && (
                        <Badge className="bg-emerald-500 text-white text-[9px] h-5 border-none font-black uppercase shrink-0">
                          Casa
                        </Badge>
                      )}
                    </div>
                    {!prediction && (
                      <Badge variant="outline" className="text-[9px] font-bold text-amber-700 border-amber-200 bg-amber-50 shrink-0">
                        Modelo parcial
                      </Badge>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">
                        Rival
                      </p>
                      <p className="text-sm font-bold text-gray-900 truncate">{rivalName}</p>
                      {seasonName ? (
                        <p className="text-[10px] text-gray-500 mt-0.5">{seasonName}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} className="text-gray-400 shrink-0" />
                        {formatMatchDate(match, 'listMediumWithTime')}
                      </span>
                      {field?.name && (
                        <span className="text-gray-400 truncate max-w-full">{field.name}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500">
                      Convocados (asistencia): <strong className="text-gray-700">{attendingCount}</strong>
                      {!prediction && attendingCount < 5 && (
                        <span className="text-amber-700"> · Añade 5+ para activar el modelo rival completo</span>
                      )}
                    </p>
                    <div className="flex gap-2 mt-auto pt-1">
                      <Button
                        className={cn(
                          'flex-1 rounded-xl h-10 font-black text-[10px] uppercase tracking-wider gap-2',
                          'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
                        )}
                        onClick={() => onOpenDetail(match.id)}
                      >
                        <Sparkles size={14} />
                        Configurar
                      </Button>
                      {onNavigateToMatch && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onNavigateToMatch(match.id)}
                          className="h-10 w-10 border-gray-200 text-gray-400 hover:text-blue-600 rounded-xl shrink-0"
                          aria-label="Ir al partido"
                        >
                          <ExternalLink size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
