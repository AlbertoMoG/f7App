import React from 'react';
import { Match, Opponent } from '../../../types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Trophy,
  Target,
  History,
  CheckCircle2,
  XCircle,
  Shield,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

const PAGE_SIZE = 6;
const CALIBRATION_MATCH_COUNT = 5;
const BIAS_LEARNING_RATE = 0.4;

interface AIVsFootballTabProps {
  matches: Match[];
  opponents: Opponent[];
  globalSeasonId: string;
}

export const AIVsFootballTab = React.memo(function AIVsFootballTab({
  matches,
  opponents,
  globalSeasonId,
}: AIVsFootballTabProps) {
  const [page, setPage] = React.useState(0);

  const completedMatches = React.useMemo(() => {
    return matches
      .filter((m) => {
        const isAtSeason = globalSeasonId === 'all' || m.seasonId === globalSeasonId;
        return m.status === 'completed' && isAtSeason && m.savedPrediction;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, globalSeasonId]);

  React.useEffect(() => { setPage(0); }, [completedMatches]);

  const stats = React.useMemo(() => {
    const total = completedMatches.length;
    let exactScores = 0;
    let correctOutcomes = 0;
    let totalGoalError = 0;

    const byConfidence: Record<'Alta' | 'Media' | 'Baja', { correct: number; total: number }> = {
      Alta: { correct: 0, total: 0 },
      Media: { correct: 0, total: 0 },
      Baja: { correct: 0, total: 0 },
    };

    completedMatches.forEach((m) => {
      const pred = m.savedPrediction!;
      const actual = { team: m.scoreTeam || 0, opponent: m.scoreOpponent || 0 };

      if (pred.team === actual.team && pred.opponent === actual.opponent) exactScores++;

      const predOutcome = pred.team > pred.opponent ? 'win' : pred.team < pred.opponent ? 'loss' : 'draw';
      const actualOutcome = actual.team > actual.opponent ? 'win' : actual.team < actual.opponent ? 'loss' : 'draw';
      const isCorrect = predOutcome === actualOutcome;
      if (isCorrect) correctOutcomes++;

      totalGoalError += (Math.abs(pred.team - actual.team) + Math.abs(pred.opponent - actual.opponent)) / 2;

      // Compute confidence level based on prior H2H count at match time
      const matchDate = new Date(m.date).getTime();
      const priorH2H = matches.filter(
        (x) =>
          x.opponentId === m.opponentId &&
          x.status === 'completed' &&
          new Date(x.date).getTime() < matchDate &&
          x.savedPrediction
      ).length;
      const confidence: 'Alta' | 'Media' | 'Baja' =
        priorH2H > 2 ? 'Alta' : priorH2H > 0 ? 'Media' : 'Baja';
      byConfidence[confidence].total++;
      if (isCorrect) byConfidence[confidence].correct++;
    });

    // Bias computation (mirrors usePredictions bias logic)
    let biasGF = 0;
    let biasGC = 0;
    const recentN = Math.min(CALIBRATION_MATCH_COUNT, completedMatches.length);
    if (recentN > 0) {
      completedMatches.slice(0, recentN).forEach((m) => {
        biasGF += (m.scoreTeam || 0) - m.savedPrediction!.team;
        biasGC += (m.scoreOpponent || 0) - m.savedPrediction!.opponent;
      });
      biasGF = (biasGF / recentN) * BIAS_LEARNING_RATE;
      biasGC = (biasGC / recentN) * BIAS_LEARNING_RATE;
    }

    return {
      total,
      exactRate: total > 0 ? Math.round((exactScores / total) * 100) : 0,
      outcomeRate: total > 0 ? Math.round((correctOutcomes / total) * 100) : 0,
      avgGoalError: total > 0 ? Math.round((totalGoalError / total) * 10) / 10 : 0,
      byConfidence,
      biasGF: Math.round(biasGF * 10) / 10,
      biasGC: Math.round(biasGC * 10) / 10,
    };
  }, [completedMatches, matches]);

  const evolutionData = React.useMemo(() => {
    const sorted = [...completedMatches].reverse();
    let correct = 0;
    return sorted.map((m, i) => {
      const pred = m.savedPrediction!;
      const predOutcome = pred.team > pred.opponent ? 'win' : pred.team < pred.opponent ? 'loss' : 'draw';
      const actualOutcome = (m.scoreTeam || 0) > (m.scoreOpponent || 0) ? 'win' : (m.scoreTeam || 0) < (m.scoreOpponent || 0) ? 'loss' : 'draw';
      if (predOutcome === actualOutcome) correct++;
      return {
        n: i + 1,
        label: format(new Date(m.date), 'dd/MM', { locale: es }),
        accuracy: Math.round((correct / (i + 1)) * 100),
      };
    });
  }, [completedMatches]);

  const totalPages = Math.ceil(completedMatches.length / PAGE_SIZE);
  const pageMatches = completedMatches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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

  const confidenceLevels: Array<{ key: 'Alta' | 'Media' | 'Baja'; label: string; color: string }> = [
    { key: 'Alta', label: 'Confianza Alta', color: 'text-emerald-600' },
    { key: 'Media', label: 'Confianza Media', color: 'text-amber-600' },
    { key: 'Baja', label: 'Confianza Baja', color: 'text-rose-600' },
  ];

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-emerald-600 border-none p-5 text-white shadow-lg shadow-emerald-100 rounded-3xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <History size={16} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Analizados</span>
          </div>
          <div className="text-3xl font-black">{stats.total}</div>
        </Card>

        <Card className="bg-slate-900 border-none p-5 text-white shadow-xl rounded-3xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
              <Target size={16} className="text-emerald-400" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Acierto 1X2</span>
          </div>
          <div className="text-3xl font-black text-emerald-400">{stats.outcomeRate}%</div>
        </Card>

        <Card className="bg-white border border-gray-100 p-5 shadow-sm rounded-3xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-emerald-50 rounded-lg">
              <Trophy size={16} className="text-emerald-600" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Resultado Exacto</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{stats.exactRate}%</div>
        </Card>

        <Card className="bg-white border border-gray-100 p-5 shadow-sm rounded-3xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-amber-50 rounded-lg">
              <TrendingUp size={16} className="text-amber-600" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Error Medio Goles</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{stats.avgGoalError}</div>
        </Card>
      </div>

      {/* Accuracy by Confidence + Bias */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card className="border border-gray-100 p-6 rounded-3xl shadow-sm">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Acierto por Confianza</h3>
          <div className="space-y-3">
            {confidenceLevels.map(({ key, label, color }) => {
              const d = stats.byConfidence[key];
              const rate = d.total > 0 ? Math.round((d.correct / d.total) * 100) : null;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className={cn('text-[10px] font-black uppercase w-28 shrink-0', color)}>{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        key === 'Alta' ? 'bg-emerald-500' : key === 'Media' ? 'bg-amber-400' : 'bg-rose-400'
                      )}
                      style={{ width: `${rate ?? 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-gray-700 w-14 text-right">
                    {rate != null ? `${rate}%` : '—'}{' '}
                    <span className="text-gray-400 font-medium">({d.total})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="border border-gray-100 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={14} className="text-amber-500" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sesgo del Modelo</h3>
          </div>
          <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
            Corrección aplicada a los últimos {Math.min(CALIBRATION_MATCH_COUNT, completedMatches.length)} partidos (tasa {BIAS_LEARNING_RATE * 100}%).
            Un sesgo positivo indica que la IA infraestimaba; negativo que sobreestimaba.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-2xl p-4 text-center">
              <div className={cn('text-2xl font-black', stats.biasGF > 0 ? 'text-emerald-600' : stats.biasGF < 0 ? 'text-rose-600' : 'text-gray-400')}>
                {stats.biasGF > 0 ? '+' : ''}{stats.biasGF}
              </div>
              <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 mt-1">Sesgo GF</div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 text-center">
              <div className={cn('text-2xl font-black', stats.biasGC > 0 ? 'text-rose-600' : stats.biasGC < 0 ? 'text-emerald-600' : 'text-gray-400')}>
                {stats.biasGC > 0 ? '+' : ''}{stats.biasGC}
              </div>
              <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 mt-1">Sesgo GC</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Accuracy Evolution Chart */}
      {evolutionData.length >= 3 && (
        <Card className="border border-gray-100 p-6 rounded-3xl shadow-sm">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-5">Evolución del Acierto (acumulado)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={evolutionData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <RechartsTooltip
                contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                formatter={(v: number) => [`${v}%`, 'Acierto 1X2']}
              />
              <ReferenceLine y={50} stroke="#e5e7eb" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Comparison List with Pagination */}
      <div className="space-y-4">
        <div className="flex items-center justify-between ml-2">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">Historial de Calibración</h3>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
              <span>{page + 1} / {totalPages}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {pageMatches.map((match) => {
            const opponent = opponents.find((o) => o.id === match.opponentId);
            const pred = match.savedPrediction!;
            const actual = { team: match.scoreTeam || 0, opponent: match.scoreOpponent || 0 };

            const isExact = pred.team === actual.team && pred.opponent === actual.opponent;
            const predOutcome = pred.team > pred.opponent ? 'win' : pred.team < pred.opponent ? 'loss' : 'draw';
            const actualOutcome = actual.team > actual.opponent ? 'win' : actual.team < actual.opponent ? 'loss' : 'draw';
            const isOutcomeCorrect = predOutcome === actualOutcome;

            return (
              <div
                key={match.id}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-6"
              >
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
