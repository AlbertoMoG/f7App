import React from 'react';
import { Match, Opponent } from '../../../types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Trophy, 
  Target, 
  History, 
  CheckCircle2, 
  XCircle, 
  MinusCircle,
  Brain,
  Shield,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIVsFootballTabProps {
  matches: Match[];
  opponents: Opponent[];
  globalSeasonId: string;
}

export const AIVsFootballTab = React.memo(function AIVsFootballTab({
  matches,
  opponents,
  globalSeasonId
}: AIVsFootballTabProps) {
  const completedMatches = React.useMemo(() => {
    return matches
      .filter(m => {
        const isAtSeason = globalSeasonId === 'all' || m.seasonId === globalSeasonId;
        return m.status === 'completed' && isAtSeason && m.savedPrediction;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, globalSeasonId]);

  if (completedMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
          <History className="text-gray-300" size={40} />
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-900">Sin historial comparativo</h3>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">
            Las predicciones se guardan automáticamente al finalizar nuevos partidos.
          </p>
        </div>
      </div>
    );
  }

  const stats = React.useMemo(() => {
    let exactScores = 0;
    let correctOutcomes = 0;
    let total = completedMatches.length;

    completedMatches.forEach(m => {
      if (!m.savedPrediction) return;
      
      const pred = m.savedPrediction;
      const actual = { team: m.scoreTeam || 0, opponent: m.scoreOpponent || 0 };
      
      if (pred.team === actual.team && pred.opponent === actual.opponent) {
        exactScores++;
      }
      
      const predOutcome = pred.team > pred.opponent ? 'win' : pred.team < pred.opponent ? 'loss' : 'draw';
      const actualOutcome = actual.team > actual.opponent ? 'win' : actual.team < actual.opponent ? 'loss' : 'draw';
      
      if (predOutcome === actualOutcome) {
        correctOutcomes++;
      }
    });

    return {
      exactRate: total > 0 ? Math.round((exactScores / total) * 100) : 0,
      outcomeRate: total > 0 ? Math.round((correctOutcomes / total) * 100) : 0,
      total
    };
  }, [completedMatches]);

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-emerald-600 border-none p-6 text-white shadow-lg shadow-emerald-100 rounded-3xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-xl">
              <History size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Partidos Analizados</span>
          </div>
          <div className="text-4xl font-black">{stats.total}</div>
        </Card>

        <Card className="bg-slate-900 border-none p-6 text-white shadow-xl rounded-3xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <Target size={20} className="text-emerald-400" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Acierto Ganador (1X2)</span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-4xl font-black text-emerald-400">{stats.outcomeRate}%</div>
            <div className="text-[10px] font-bold opacity-60">de efectividad</div>
          </div>
        </Card>

        <Card className="bg-white border-none p-6 shadow-sm rounded-3xl border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Trophy size={20} className="text-emerald-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Resultados Exactos</span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-4xl font-black text-gray-900">{stats.exactRate}%</div>
            <div className="text-[10px] font-bold text-gray-400">precisión total</div>
          </div>
        </Card>
      </div>

      {/* Comparison List */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2">Historial de Calibración</h3>
        <div className="grid grid-cols-1 gap-4">
          {completedMatches.map((match) => {
            const opponent = opponents.find(o => o.id === match.opponentId);
            const pred = match.savedPrediction!;
            const actual = { team: match.scoreTeam || 0, opponent: match.scoreOpponent || 0 }; // FIX: m should be match
            
            const isExact = pred.team === actual.team && pred.opponent === actual.opponent;
            const predOutcome = pred.team > pred.opponent ? 'win' : pred.team < pred.opponent ? 'loss' : 'draw';
            const actualOutcome = actual.team > actual.opponent ? 'win' : actual.team < actual.opponent ? 'loss' : 'draw';
            const isOutcomeCorrect = predOutcome === actualOutcome;

            return (
              <div 
                key={match.id}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-6"
              >
                {/* Match Header */}
                <div className="flex items-center gap-4 min-w-[200px] w-full md:w-auto">
                   <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                     {opponent?.shieldUrl ? (
                       <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                     ) : (
                       <Shield size={24} className="text-gray-300" />
                     )}
                   </div>
                   <div className="min-w-0">
                     <p className="font-black text-gray-900 truncate uppercase text-sm">{opponent?.name || 'Rival'}</p>
                     <div className="flex items-center gap-2 mt-0.5">
                       <Badge variant="outline" className="h-4 px-1.5 bg-gray-50 border-gray-100 text-gray-400 font-bold text-[8px] uppercase">
                         J{match.round}
                       </Badge>
                       <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                         <Calendar size={10} /> {format(new Date(match.date), 'dd MMM yy', { locale: es })}
                       </p>
                     </div>
                   </div>
                </div>

                {/* Score Comparison */}
                <div className="flex-1 flex items-center justify-center gap-12 bg-gray-50/50 p-4 rounded-2xl border border-gray-50 w-full md:w-auto">
                   <div className="text-center space-y-1">
                     <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Predicción IA</p>
                     <div className="text-xl font-mono font-black text-slate-400">
                        {pred.team} - {pred.opponent}
                     </div>
                   </div>
                   
                   <div className="h-8 w-px bg-gray-200" />

                   <div className="text-center space-y-1">
                     <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Resultado Real</p>
                     <div className="text-2xl font-mono font-black text-emerald-600">
                        {match.scoreTeam} - {match.scoreOpponent}
                     </div>
                   </div>
                </div>

                {/* Accuracy Badges */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                   {isExact ? (
                     <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-100">
                       <Trophy size={14} />
                       Resultado Exacto
                     </div>
                   ) : isOutcomeCorrect ? (
                     <div className="flex items-center gap-2 bg-white text-emerald-600 border-2 border-emerald-600 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider">
                       <CheckCircle2 size={14} />
                       Pronóstico Acertado
                     </div>
                   ) : (
                     <div className="flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider">
                       <XCircle size={14} />
                       Desviación IA
                     </div>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
