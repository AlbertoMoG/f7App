import React from 'react';
import { Match, Opponent, Season, Field } from '../../../types';
import { MatchPrediction } from '../../../types/aiAnalysis';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Shield, Calendar, MapPin, Target, TrendingUp, Sparkles, Navigation, Clock, ExternalLink, Brain, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMatchDate } from '@/lib/matchDisplayLabel';

interface PredictionCardProps {
  match: Match;
  teamShieldUrl?: string;
  teamName?: string;
  opponent: Opponent | undefined;
  season: Season | undefined;
  field: Field | undefined;
  prediction: MatchPrediction | undefined;
  attendingCount?: number;
  onNavigateToMatch?: (id: string) => void;
  onOpenRecommended: (id: string) => void;
}

export const PredictionCard = React.memo(function PredictionCard({
  match,
  teamShieldUrl,
  teamName,
  opponent,
  season,
  field,
  prediction,
  attendingCount = 0,
  onNavigateToMatch,
  onOpenRecommended
}: PredictionCardProps) {
  if (attendingCount < 5) {
    return (
      <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all group rounded-2xl bg-white flex flex-col h-full">
        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="bg-gray-50/50 p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white border-gray-200 text-gray-500 text-[10px] h-5 font-black uppercase">
                    {match.type === 'league' ? `Jornada ${match.round}` : match.type === 'cup' ? 'Copa' : 'Amistoso'}
                </Badge>
                {match.isHome && <Badge className="bg-emerald-500 text-white text-[9px] h-5 border-none font-black uppercase">Casa</Badge>}
            </div>
            <div className="flex items-center gap-1.5 opacity-50">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Confianza</span>
              <Badge className="text-[10px] font-black border-none h-5 px-2 bg-gray-100 text-gray-400">
                ---
              </Badge>
            </div>
          </div>
          <div className="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100">
              <Brain size={24} className="text-gray-300" />
            </div>
            <div>
              <p className="text-[12px] font-black text-gray-700 uppercase mb-1">Datos Insuficientes</p>
              <p className="text-[10px] text-gray-500 mx-auto max-w-[200px] leading-relaxed">
                El modelo predictivo requiere al menos <strong>5 jugadores</strong> convocados para calcular proyecciones y sinergias (actualmente {attendingCount}).
              </p>
            </div>
            {onNavigateToMatch && (
              <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateToMatch(match.id)}
                  className="mt-2 text-[10px] font-bold uppercase tracking-wider h-8"
              >
                  Ir al partido
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!prediction) return null;

  return (
    <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all group rounded-2xl bg-white">
      <CardContent className="p-0">
        {/* Header con Badge de Confianza */}
        <div className="bg-gray-50/50 p-4 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white border-gray-200 text-gray-500 text-[10px] h-5 font-black uppercase">
                    {match.type === 'league' ? `Jornada ${match.round}` : match.type === 'cup' ? 'Copa' : 'Amistoso'}
                </Badge>
                {match.isHome && <Badge className="bg-emerald-500 text-white text-[9px] h-5 border-none font-black uppercase">Casa</Badge>}
            </div>
            <Tooltip>
              <TooltipTrigger render={<div className="flex items-center gap-1.5 cursor-help" />}>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Confianza</span>
                <Badge className={cn(
                    "text-[10px] font-black border-none h-5 px-2",
                    prediction.confidence === 'Alta' ? "bg-emerald-100 text-emerald-700" :
                    prediction.confidence === 'Media' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                )}>
                    {prediction.confidence}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px] text-xs leading-snug p-3 space-y-1.5">
                <p><strong>Alta</strong> — más de 2 enfrentamientos previos H2H. La IA ajusta el peso del historial directo hasta un 60%.</p>
                <p><strong>Media</strong> — 1–2 partidos H2H previos. Mezcla entre histórico y media global de goles.</p>
                <p><strong>Baja</strong> — sin historial H2H. Predicción basada exclusivamente en promedios, baremo de plantilla y forma de liga.</p>
              </TooltipContent>
            </Tooltip>
        </div>

        <div className="p-5">
            {/* Marcador Predicho */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 shadow-inner overflow-hidden">
                        {teamShieldUrl ? (
                            <img src={teamShieldUrl} alt={teamName || "Mi Equipo"} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                        ) : (
                            <Shield className="text-gray-300" size={32} />
                        )}
                    </div>
                    <span className="text-[10px] font-black text-gray-400 uppercase text-center truncate w-full">{teamName || 'Mi Equipo'}</span>
                </div>

                <div className="flex flex-col items-center px-4">
                    <div className="flex items-center gap-3 font-black text-3xl tabular-nums">
                        <span className="text-gray-900">{prediction.team}</span>
                        <span className="text-gray-200">-</span>
                        <span className="text-gray-900">{prediction.opponent}</span>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 shadow-inner overflow-hidden">
                        {opponent?.shieldUrl ? (
                            <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                        ) : (
                            <Shield className="text-gray-300" size={32} />
                        )}
                    </div>
                    <span className="text-[10px] font-black text-gray-400 uppercase text-center truncate w-full">{opponent?.name || 'Rival'}</span>
                </div>
            </div>

            {/* Probabilidades */}
            <div className="space-y-3 mb-6 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                    <span>V / E / D</span>
                    <div className="flex items-center gap-1">
                      <span>Probabilidad</span>
                      <Tooltip>
                        <TooltipTrigger render={<button type="button" className="inline-flex text-gray-300 hover:text-gray-400 focus:outline-none" />}>
                          <Info size={10} />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[230px] text-xs leading-snug p-2.5">
                          Calculadas con distribución de Poisson independiente sobre los goles predichos (GF y GC). Normalizadas para sumar el 100%.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${prediction.probabilities.win}%` }} />
                    <div className="h-full bg-amber-400 transition-all" style={{ width: `${prediction.probabilities.draw}%` }} />
                    <div className="h-full bg-red-400 transition-all" style={{ width: `${prediction.probabilities.loss}%` }} />
                </div>
                <div className="flex justify-between text-[11px] font-black tabular-nums">
                    <span className="text-emerald-600">{prediction.probabilities.win.toFixed(0)}%</span>
                    <span className="text-amber-600">{prediction.probabilities.draw.toFixed(0)}%</span>
                    <span className="text-red-500">{prediction.probabilities.loss.toFixed(0)}%</span>
                </div>
            </div>

            {/* Factores Clave (Justificación) */}
            <div className="mb-6">
                <div className="flex items-center gap-1.5 mb-2 px-1">
                    <Target size={12} className="text-indigo-500" />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Factores Determinantes</span>
                    <Tooltip>
                      <TooltipTrigger render={<button type="button" className="inline-flex text-gray-300 hover:text-gray-400 focus:outline-none" />}>
                        <Info size={11} />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[280px] text-xs leading-snug p-3 space-y-1">
                        <p className="font-semibold">El modelo aplica 10 señales en secuencia:</p>
                        <ol className="list-decimal pl-4 space-y-0.5 text-[11px]">
                          <li>Historial H2H ponderado dinámicamente</li>
                          <li>Fortaleza de plantilla vs media del equipo</li>
                          <li>Balance táctico (portero, defensas, delanteros)</li>
                          <li>Sinergias letales entre jugadores</li>
                          <li>Jugadores clave ausentes</li>
                          <li>Diferencial en clasificación</li>
                          <li>Franja de edad media</li>
                          <li>Inercia (últimos 3 partidos)</li>
                          <li>Forma reciente del rival en liga del grupo</li>
                          <li>Índice ataque/defensa del rival vs media de liga + racha</li>
                        </ol>
                        <p className="text-[10px] text-gray-400 mt-1">Resultado final corregido con calibración automática sobre los últimos 5 partidos completados.</p>
                      </TooltipContent>
                    </Tooltip>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {prediction.reasons.map((reason, i) => (
                        <div key={i} className="px-2.5 py-1 bg-white border border-gray-100 rounded-lg shadow-sm text-[10px] font-bold text-gray-600 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-200" />
                            {reason}
                        </div>
                    ))}
                    {prediction.reasons.length === 0 && (
                        <span className="text-[10px] text-gray-400 italic px-1">Analizando variables adicionales...</span>
                    )}
                </div>
            </div>

            {/* Detalles Rápidos */}
            <div className="grid grid-cols-2 gap-2 mb-6">
                <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                        <Calendar size={14} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] font-black text-gray-400 uppercase leading-none mb-0.5">Fecha</p>
                        <p className="text-[10px] font-bold text-gray-700 truncate">{formatMatchDate(match, 'listMedium')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                        <Clock size={14} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] font-black text-gray-400 uppercase leading-none mb-0.5">Hora</p>
                        <p className="text-[10px] font-bold text-gray-700 truncate">{formatMatchDate(match, 'listTime')}</p>
                    </div>
                </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-2">
                <Button 
                    onClick={() => onOpenRecommended(match.id)}
                    title="Convocatoria táctica (10), formación y rival según el modelo"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-black text-xs uppercase tracking-wider gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Sparkles size={16} />
                    <span>Mejor convocatoria</span>
                </Button>
                {onNavigateToMatch && (
                    <Button 
                        variant="outline"
                        size="icon"
                        onClick={() => onNavigateToMatch(match.id)}
                        className="w-11 h-11 border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                        <ExternalLink size={18} />
                    </Button>
                )}
            </div>
        </div>
      </CardContent>
    </Card>
  );
});
