import React from 'react';
import { Match, PlayerStat, Opponent } from '../../../types';
import { SquadAnalysisResult } from '../../../types/aiAnalysis';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatMatchDate, getOpponentName } from '@/lib/matchDisplayLabel';
import { Users, Shield, Calendar, ExternalLink, Plus, Info } from 'lucide-react';
import { GRADE_COLORS } from '../../../lib/predictionConstants';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface SquadsTabProps {
  analyzedMatches: Match[];
  squadAnalysis: Map<string, SquadAnalysisResult>;
  stats: PlayerStat[];
  opponents: Opponent[];
  analyzedLimit: number;
  onSetLimit: (limit: number | ((prev: number) => number)) => void;
  onSelectMatch: (id: string) => void;
  onNavigateToMatch?: (id: string) => void;
  hasMoreToAnalyze: boolean;
  filteredMatchesCount: number;
}

export const SquadsTab = React.memo(function SquadsTab({
  analyzedMatches,
  squadAnalysis,
  stats,
  opponents,
  analyzedLimit,
  onSetLimit,
  onSelectMatch,
  onNavigateToMatch,
  hasMoreToAnalyze,
  filteredMatchesCount
}: SquadsTabProps) {
  const [viewMode, setViewMode] = React.useState<'table' | 'cards'>('table');

  const chartData = React.useMemo(() => {
    return [...analyzedMatches]
      .reverse()
      .map((match) => {
        const analysis = squadAnalysis.get(match.id);
        return {
          label: `J${match.round}`,
          score: analysis?.score ?? null,
          grade: analysis?.grade ?? null,
        };
      })
      .filter((d): d is typeof d & { score: number } => d.score != null);
  }, [analyzedMatches, squadAnalysis]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
           <Button
             variant="ghost"
             size="sm"
             onClick={() => setViewMode('table')}
             className={cn(
               "h-8 px-3 rounded-lg text-xs font-bold transition-all",
               viewMode === 'table' ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
             )}
           >
             Tabla
           </Button>
           <Button
             variant="ghost"
             size="sm"
             onClick={() => setViewMode('cards')}
             className={cn(
               "h-8 px-3 rounded-lg text-xs font-bold transition-all",
               viewMode === 'cards' ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
             )}
           >
             Tarjetas
           </Button>
        </div>
      </div>

      {chartData.length >= 3 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-1.5 mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Evolución del Baremo por Jornada</p>
            <Tooltip>
              <TooltipTrigger render={<button type="button" className="inline-flex text-gray-300 hover:text-gray-400 focus:outline-none" />}>
                <Info size={11} />
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px] text-xs leading-snug p-3 space-y-1">
                <p>Puntuación global de convocatoria (0–100) por jornada analizada, ordenadas cronológicamente.</p>
                <p>La línea de referencia superior (A) indica el umbral de calidad alta (≥75). La zona media (50) separa convocatorias aceptables de las deficientes.</p>
                <p className="text-gray-400">Solo se muestra con 3 o más jornadas analizadas.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <RechartsTooltip
                contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                formatter={(v: number) => [`${v}/100`, 'Baremo']}
              />
              <ReferenceLine y={75} stroke="#e5e7eb" strokeDasharray="4 4" label={{ value: 'A', position: 'right', fontSize: 9, fill: '#10b981' }} />
              <ReferenceLine y={50} stroke="#f0f0f0" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {viewMode === 'table' ? (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-4 py-2">Jornada</th>
                <th className="px-4 py-2">Rival</th>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2 text-center">
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Jugadores</span>
                    <Tooltip>
                      <TooltipTrigger render={<button type="button" className="inline-flex text-gray-300 hover:text-gray-400 focus:outline-none" />}>
                        <Info size={10} />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[200px] text-xs p-2 leading-snug">
                        Número de jugadores convocados (attendance = attending) para ese partido.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </th>
                <th className="px-4 py-2 text-center">
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Grado</span>
                    <Tooltip>
                      <TooltipTrigger render={<button type="button" className="inline-flex text-gray-300 hover:text-gray-400 focus:outline-none" />}>
                        <Info size={10} />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[240px] text-xs p-2.5 leading-snug space-y-1">
                        <p>Nota cualitativa de la convocatoria:</p>
                        <ul className="list-none space-y-0.5 text-[11px]">
                          <li><strong>S</strong> — élite (≥90 pts)</li>
                          <li><strong>A</strong> — alta calidad (75-89)</li>
                          <li><strong>B</strong> — por encima de la media (60-74)</li>
                          <li><strong>C</strong> — aceptable (45-59)</li>
                          <li><strong>D</strong> — deficiente (&lt;45)</li>
                        </ul>
                        <p className="text-gray-400">Basado en baremo medio, equilibrio posicional, sinergias y ausencias de jugadores clave.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </th>
                <th className="px-4 py-2 text-center">
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Puntuación</span>
                    <Tooltip>
                      <TooltipTrigger render={<button type="button" className="inline-flex text-gray-300 hover:text-gray-400 focus:outline-none" />}>
                        <Info size={10} />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[220px] text-xs p-2.5 leading-snug space-y-1">
                        <p>Puntuación numérica 0–100 de la convocatoria.</p>
                        <ul className="list-none space-y-0.5 text-[11px]">
                          <li className="text-emerald-600">≥75 — alta calidad</li>
                          <li className="text-amber-600">50–74 — media</li>
                          <li className="text-red-500">&lt;50 — baja calidad</li>
                        </ul>
                        <p className="text-gray-400">Haciendo clic en una fila se abre el detalle de la convocatoria con mejoras sugeridas.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </th>
                <th className="px-4 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {analyzedMatches.map((match) => {
                const analysis = squadAnalysis.get(match.id);
                if (!analysis) return null;
                const opponentName = getOpponentName(opponents, match.opponentId, 'Rival');
                const opponent = opponents.find((o) => o.id === match.opponentId);

                return (
                  <tr 
                    key={match.id} 
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectMatch(match.id)}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectMatch(match.id)}
                    className="group bg-white hover:bg-gray-50 transition-all cursor-pointer shadow-sm border border-transparent hover:border-gray-100 rounded-xl"
                  >
                    <td className="px-4 py-3 rounded-l-xl">
                      <Badge variant="outline" className="bg-gray-50 border-gray-100 text-gray-400 font-black text-[9px]">
                        J{match.round}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 min-w-[150px]">
                      <div className="flex items-center gap-2">
                         <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-100">
                           {opponent?.shieldUrl ? (
                             <img src={opponent.shieldUrl} alt={opponentName} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                           ) : (
                             <Shield size={14} className="text-gray-300" />
                           )}
                         </div>
                         <span className="font-bold text-gray-900 truncate">{opponentName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-medium text-gray-500">{formatMatchDate(match, 'listCompact')}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-black text-gray-700">{analysis.attendingCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black border",
                        GRADE_COLORS[`${analysis.grade}_DARK` as keyof typeof GRADE_COLORS]
                      )}>
                        {analysis.grade}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={cn(
                        "text-[10px] font-black border-none",
                        analysis.score >= 75 ? "bg-emerald-100 text-emerald-700" :
                        analysis.score >= 50 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {analysis.score}/100
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right rounded-r-xl">
                       <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-gray-300 group-hover:text-emerald-500">
                         <Plus size={18} />
                       </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {analyzedMatches.map(match => {
              const analysis = squadAnalysis.get(match.id);
              if (!analysis) return null;
              const opponent = opponents.find(o => o.id === match.opponentId);
              const opponentName = getOpponentName(opponents, match.opponentId, 'Rival');

              return (
                <div 
                  key={match.id} 
                  className="flex flex-col p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer relative group"
                  onClick={() => onSelectMatch(match.id)}
                >
                   <div className="absolute top-3 right-3 flex items-center gap-2">
                     {onNavigateToMatch && (
                       <Tooltip>
                         <TooltipTrigger render={<div />}>
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-7 w-7 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 focus:outline-none"
                             onClick={(e) => {
                               e.stopPropagation();
                               onNavigateToMatch(match.id);
                             }}
                           >
                             <ExternalLink size={14} />
                           </Button>
                         </TooltipTrigger>
                         <TooltipContent className="bg-[#141414] text-white text-[10px] py-1 px-2 rounded-lg border-none" side="left">
                           Ir a detalles del partido
                         </TooltipContent>
                       </Tooltip>
                     )}
                     <Badge className="bg-gray-50 text-gray-400 border-gray-100 text-[9px] font-black h-5 uppercase px-1.5 focus:outline-none pointer-events-none">
                       J{match.round}
                     </Badge>
                     <div className={cn(
                       "w-7 h-7 flex items-center justify-center font-black rounded-lg border text-sm shadow-sm",
                       GRADE_COLORS[`${analysis.grade}_DARK` as keyof typeof GRADE_COLORS]
                     )}>
                       {analysis.grade}
                     </div>
                   </div>

                   <div className="flex items-center gap-3 mb-4">
                     <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                       {opponent?.shieldUrl ? (
                         <img src={opponent.shieldUrl} alt={opponentName} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                       ) : (
                         <Shield size={24} className="text-gray-300" />
                       )}
                     </div>
                     <div className="min-w-0 flex-1">
                       <p className="font-bold text-gray-900 truncate pr-16">{opponentName}</p>
                       <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                         <Calendar size={10} /> {formatMatchDate(match, 'listMedium')}
                       </p>
                     </div>
                   </div>

                   <div className="mt-auto space-y-3">
                      <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-wider">
                         <span className="text-gray-400 flex items-center gap-1"><Users size={12}/>{analysis.attendingCount} Jug.</span>
                         <span className={cn(
                           analysis.score >= 75 ? "text-emerald-600" : analysis.score >= 50 ? "text-amber-500" : "text-red-500"
                         )}>Score {analysis.score}/100</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                         <div 
                           className={cn(
                             "h-full transition-all",
                             analysis.score >= 75 ? "bg-emerald-500" : analysis.score >= 50 ? "bg-amber-500" : "bg-red-500"
                           )} 
                           style={{ width: `${analysis.score}%` }} 
                         />
                      </div>
                   </div>
                </div>
              );
           })}
        </div>
      )}

      {hasMoreToAnalyze && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
            Mostrando {analyzedMatches.length} de {filteredMatchesCount} partidos
          </p>
          <Button 
            variant="outline" 
            onClick={() => onSetLimit(prev => prev + 5)}
            className="rounded-xl border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all font-bold gap-2 px-6 h-11"
          >
            <Plus size={16} />
            Cargar 5 jornadas anteriores
          </Button>
        </div>
      )}
    </div>
  );
});
