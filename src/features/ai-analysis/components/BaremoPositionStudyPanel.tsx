import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeftRight,
  Award,
  BarChart3,
  Crosshair,
  Lightbulb,
  Shield,
  Sparkles,
  Sword,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  Legend,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { Match, Position, Player } from '@/types';
import type { PositionBaremoFilledStudy, PositionBaremoStudy } from '@/lib/baremoPositionStudy';
import type { IdealBaremoSevenResult } from '@/lib/baremoIdealSeven';
import type { ValoracionPredictionSquadResult } from '@/lib/valoracionPredictionSquad';
import type { IdealVsRealComparison } from '@/lib/idealVsRealConvocatoria';
import type {
  BaremoTableRowModel,
  PositionChartBarPoint,
} from '@/features/ai-analysis/hooks/useBaremoValoracionPositionStudy';

const positionIcons: Record<Position, typeof Shield> = {
  Portero: Shield,
  Defensa: Shield,
  Medio: Sword,
  Delantero: Crosshair,
};

const positionColors: Record<Position, string> = {
  Portero: 'bg-yellow-100 text-yellow-700',
  Defensa: 'bg-blue-100 text-blue-700',
  Medio: 'bg-emerald-100 text-emerald-700',
  Delantero: 'bg-red-100 text-red-700',
};

const CHART_MEDIA_COLORS = ['#EAB308', '#3B82F6', '#10B981', '#EF4444'];
const CHART_TECHO_FILL = '#94a3b8';

const SHORT_LINE: Record<Position, string> = {
  Portero: 'POR',
  Defensa: 'DEF',
  Medio: 'MED',
  Delantero: 'DEL',
};

export interface BaremoPositionStudyPanelProps {
  rowsCount: number;
  teamAvgBaremo: number;
  lineStrengthRank: string[];
  valoracionPrediction: ValoracionPredictionSquadResult;
  scheduledNext: Match | null;
  idealVsReal: IdealVsRealComparison | null;
  predDeltaVsFiltered: number;
  improvementHints: string[];
  positionChartBars: PositionChartBarPoint[];
  positionStudies: PositionBaremoStudy[];
  idealSeven: IdealBaremoSevenResult;
  idealDeltaVsList: number;
  /** Texto primera caja izquierda (media de lista de estudio por demarcación). */
  listSummaryTitle?: string;
  /** Subtítulo bajo la media (# jugadores). */
  listSummaryHint?: string;
  /** Frase de contexto tras “compared with …”. */
  listComparisonNote?: string;
  /** Sufijo del badge “Modelo ±X vs …”. */
  modelDeltaVsLabel?: string;
}

export function BaremoPositionStudyPanel({
  rowsCount,
  teamAvgBaremo,
  lineStrengthRank,
  valoracionPrediction,
  scheduledNext,
  idealVsReal,
  predDeltaVsFiltered,
  improvementHints,
  positionChartBars,
  positionStudies,
  idealSeven,
  idealDeltaVsList,
  listSummaryTitle = 'Lista filtrada',
  listSummaryHint,
  listComparisonNote = 'Plantilla.',
  modelDeltaVsLabel = 'lista filtrada',
}: BaremoPositionStudyPanelProps) {
  const navigate = useNavigate();

  const resolvedListHint =
    listSummaryHint ?? `${rowsCount} jugadores en vista Plantilla`;

  const studyMiniPlayer = (row: BaremoTableRowModel, badge: string) => {
    const { player } = row;
    const initials = `${player.firstName?.[0] ?? ''}${player.lastName?.[0] ?? ''}`;
    return (
      <button
        type="button"
        className="w-full flex items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors"
        onClick={() => navigate(`/players/${player.id}`)}
      >
        <Avatar className="h-8 w-8 rounded-lg border border-gray-100 shrink-0">
          <AvatarImage src={player.photoUrl} className="object-cover" referrerPolicy="no-referrer" />
          <AvatarFallback className="rounded-lg bg-gray-100 text-gray-700 text-[9px] font-black">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black uppercase text-gray-400 tracking-wide">{badge}</div>
          <div className="text-xs font-bold text-gray-900 truncate">{player.alias?.trim() || player.firstName}</div>
          <div
            className={cn(
              'text-[11px] font-black tabular-nums',
              row.notaFinal >= 75 ? 'text-emerald-600' : row.notaFinal >= 60 ? 'text-blue-600' : 'text-gray-600'
            )}
          >
            {row.notaFinal.toFixed(1)}
          </div>
        </div>
      </button>
    );
  };

  const renderConvocatoriaCompareList = (list: Player[]) => {
    const pool = valoracionPrediction.allPlayerRatings;
    const fb = valoracionPrediction.rosterAvgBaremo;
    if (list.length === 0) {
      return <p className="text-[11px] text-gray-400 italic py-1">Nadie.</p>;
    }
    return (
      <ul className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
        {list.map((player) => {
          const initials = `${player.firstName?.[0] ?? ''}${player.lastName?.[0] ?? ''}`;
          const br = pool.find((r) => r.id === player.id)?.rating ?? fb;
          return (
            <li key={player.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/90 border border-transparent hover:border-gray-100 transition-colors"
                onClick={() => navigate(`/players/${player.id}`)}
              >
                <Avatar className="h-7 w-7 rounded-lg border border-gray-100 shrink-0">
                  <AvatarImage src={player.photoUrl} referrerPolicy="no-referrer" className="object-cover" />
                  <AvatarFallback className="text-[8px] font-black rounded-lg bg-gray-100">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-bold text-gray-900 truncate min-w-0 flex-1">
                  {player.alias?.trim() || player.firstName}
                </span>
                <Badge variant="outline" className="text-[9px] shrink-0 px-1 py-0 font-bold">
                  {SHORT_LINE[player.position]}
                </Badge>
                <span className="text-[11px] font-black tabular-nums text-emerald-700 shrink-0">{br.toFixed(1)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  if (rowsCount === 0) return null;

  return (
    <Card className="border-none shadow-md rounded-2xl overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="p-2 rounded-xl bg-violet-50 text-violet-700 shrink-0 self-start">
            <BarChart3 size={22} />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              Estudio por demarcación
              {lineStrengthRank.length > 1 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 normal-case tracking-normal">
                  <Award className="text-amber-500 shrink-0" size={14} />
                  <span className="truncate">Fuerza relativa: {lineStrengthRank.join(' → ')}</span>
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Misma convocatoria que el motor de <strong className="text-gray-800">Inteligencia IA</strong> (sinergias,
              disponibilidad al próximo partido, forma 2-3-1 y cupo 10–12), comparada con{' '}
              <strong className="text-gray-800">{listComparisonNote}</strong> Gráficos por línea y sugerencias de refuerzo.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50/90 to-emerald-50/35 px-4 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-white/60 border border-white/80 p-3">
              <p className="text-[10px] font-black uppercase text-violet-600 tracking-wide">{listSummaryTitle}</p>
              <p className="text-2xl font-black tabular-nums text-gray-900">{teamAvgBaremo.toFixed(1)}</p>
              <p className="text-[11px] text-gray-500">{resolvedListHint}</p>
            </div>

            <div className="rounded-xl bg-emerald-50/80 border border-emerald-100 p-3 flex flex-col gap-1">
              <p className="text-[10px] font-black uppercase text-emerald-800 tracking-wide flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-600 shrink-0" />
                Convocatoria modelo predicción
              </p>
              {valoracionPrediction.ok && valoracionPrediction.squad.length > 0 ? (
                <>
                  <p className="text-2xl font-black tabular-nums text-emerald-800">
                    {valoracionPrediction.squadMeanBaremo.toFixed(1)}
                  </p>
                  <p className="text-[11px] text-emerald-900/80">
                    {valoracionPrediction.squad.length} jug. · {valoracionPrediction.outfieldSlots} campo ·{' '}
                    {valoracionPrediction.pipelineSynced ? 'λ post-modificadores' : 'λ baseline liga'}{' '}
                    {valoracionPrediction.predGF.toFixed(2)} / {valoracionPrediction.predGC.toFixed(2)} GF/GC
                  </p>
                  {valoracionPrediction.pipelineSynced && (
                    <Badge className="w-fit mt-0.5 bg-indigo-100 text-indigo-900 text-[8px] font-black uppercase hover:bg-indigo-100 border-0">
                      Pipeline IA
                    </Badge>
                  )}
                  {scheduledNext && (
                    <p className="text-[10px] text-gray-600 font-semibold mt-1">
                      Próximo partido:{' '}
                      {new Date(scheduledNext.date).toLocaleString('es-ES', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}{' '}
                      · «real» = asistencia confirmada en ese partido.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-amber-900 py-2">
                    {valoracionPrediction.message ?? 'No se pudo armar la convocatoria modelo.'}
                  </p>
                </>
              )}
            </div>

            <div className="rounded-xl bg-white/60 border border-white/80 p-3">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-wide">Pool temporada</p>
              <p className="text-2xl font-black tabular-nums text-slate-900">
                {valoracionPrediction.ok ? valoracionPrediction.rosterAvgBaremo.toFixed(1) : '—'}
              </p>
              <p className="text-[11px] text-gray-500">Media baremo elegibles (misma base que predicción)</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-violet-100/80">
            <div className="flex flex-wrap gap-2">
              {valoracionPrediction.ok && valoracionPrediction.squad.length > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'font-black text-[10px]',
                    predDeltaVsFiltered >= 0 ? 'bg-emerald-600 text-white' : 'bg-orange-600 text-white'
                  )}
                >
                      Modelo {predDeltaVsFiltered >= 0 ? '+' : ''}
                      {predDeltaVsFiltered.toFixed(1)} vs {modelDeltaVsLabel}
                    </Badge>
              )}
              {valoracionPrediction.ok &&
                valoracionPrediction.squad.length > 0 &&
                Math.abs(valoracionPrediction.squadMeanBaremo - valoracionPrediction.rosterAvgBaremo) > 0.35 && (
                  <Badge variant="outline" className="text-[10px] font-bold border-slate-200 text-slate-700">
                    {valoracionPrediction.squadMeanBaremo >= valoracionPrediction.rosterAvgBaremo ? '+' : ''}
                    {(valoracionPrediction.squadMeanBaremo - valoracionPrediction.rosterAvgBaremo).toFixed(1)} vs pool
                  </Badge>
                )}
            </div>
            <div className="text-[11px] text-gray-600 font-medium">
              Referencia VII sólo-baremo:{' '}
              <span className="font-black text-gray-900 tabular-nums">
                {idealSeven.picked.length === 0 ? '—' : idealSeven.avgBaremo.toFixed(1)}
              </span>{' '}
              {idealSeven.picked.length > 0 && (
                <span className="text-emerald-700 font-semibold ml-1">
                  ({idealDeltaVsList >= 0 ? '+' : ''}
                  {idealDeltaVsList.toFixed(1)} vs lista · sin sinergias)
                </span>
              )}
              {!idealSeven.complete && idealSeven.missing.length > 0 && (
                <span className="block text-amber-800 mt-1">VII baremo incompleto: {idealSeven.missing.join(' · ')}</span>
              )}
            </div>
          </div>
        </div>

        {idealVsReal && valoracionPrediction.matchId && (
          <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/80 to-white px-4 py-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="text-sky-600 shrink-0" size={20} />
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight leading-tight">
                    Ideal modelo vs convocatoria real
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Comparado en el mismo partido (asistencias con estado <strong className="text-gray-700">presente</strong>
                    ).
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-bold tabular-nums">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 border-0 text-[10px]">
                  Modelo ∅ {idealVsReal.avgIdeal.toFixed(1)}
                </Badge>
                <Badge variant="secondary" className="bg-sky-100 text-sky-900 border-0 text-[10px]">
                  Real ∅ {idealVsReal.avgReal.toFixed(1)}
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn(
                    'border-0 text-[10px]',
                    idealVsReal.deltaAvgIdealMinusReal >= 0 ? 'bg-violet-100 text-violet-900' : 'bg-orange-100 text-orange-900'
                  )}
                >
                  Δ {idealVsReal.deltaAvgIdealMinusReal >= 0 ? '+' : ''}
                  {idealVsReal.deltaAvgIdealMinusReal.toFixed(1)}
                </Badge>
                <Badge variant="outline" className="text-[10px] text-gray-700">
                  Coincidencias {idealVsReal.inBoth.length}/{idealVsReal.ideal.length}
                </Badge>
              </div>
            </div>
            {idealVsReal.real.length === 0 ? (
              <p className="text-sm font-semibold text-amber-800 bg-amber-50/80 rounded-xl px-3 py-2 border border-amber-100">
                Todavía no hay altas confirmadas para este encuentro — la columna «real» está vacía.
              </p>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <div className="rounded-xl bg-white border border-emerald-100 p-3">
                <p className="text-[10px] font-black uppercase text-emerald-700 mb-2">Coincidencias</p>
                {renderConvocatoriaCompareList(idealVsReal.inBoth)}
              </div>
              <div className="rounded-xl bg-white border border-orange-100 p-3">
                <p className="text-[10px] font-black uppercase text-orange-700 mb-2">Sugeridos por IA sin alta</p>
                {renderConvocatoriaCompareList(idealVsReal.onlyIdeal)}
              </div>
              <div className="rounded-xl bg-white border border-sky-200 p-3">
                <p className="text-[10px] font-black uppercase text-sky-800 mb-2">Alta real fuera del modelo</p>
                {renderConvocatoriaCompareList(idealVsReal.onlyReal)}
              </div>
            </div>
          </div>
        )}

        {positionChartBars.length > 0 && (
          <div className="h-52 w-full rounded-xl border border-gray-100 bg-gray-50/40 p-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={positionChartBars}
                layout="vertical"
                margin={{ left: 2, right: 16, top: 4, bottom: 4 }}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={40}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 800, fill: '#4b5563' }}
                />
                <ReferenceLine
                  x={teamAvgBaremo}
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  ifOverflow="extendDomain"
                  label={{
                    value: 'Media lista',
                    position: 'insideBottomRight',
                    fill: '#6366f1',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: 4 }}
                  formatter={(value: string) => (value === 'media' ? 'Baremo medio' : 'Mejor línea')}
                />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                  }}
                  formatter={(v: number | string, name: string) =>
                    [`${Number(v).toFixed(1)}`, name === 'media' ? 'Medio línea' : 'Techo']
                  }
                />
                <Bar dataKey="media" name="media" radius={[0, 6, 6, 0]} barSize={14}>
                  {positionChartBars.map((e, i) => (
                    <Cell key={`baremo-media-${i}`} fill={CHART_MEDIA_COLORS[e.positionIndex] ?? '#64748b'} />
                  ))}
                </Bar>
                <Bar dataKey="techo" name="techo" fill={CHART_TECHO_FILL} radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {improvementHints.length > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/35 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="text-amber-600 shrink-0" size={18} />
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Áreas de mejora por posición</h3>
            </div>
            <ul className="space-y-2 text-[13px] text-gray-800 leading-snug list-disc pl-1 marker:text-amber-500">
              {improvementHints.map((hint, idx) => (
                <li key={idx}>{hint}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {positionStudies
            .filter((s): s is PositionBaremoFilledStudy => !s.empty)
            .map((study) => {
              const PosIcon = positionIcons[study.position];
              const rk = lineStrengthRank.indexOf(study.position) + 1;
              const nLines = lineStrengthRank.length;
              const isTopLine = nLines > 1 && rk === 1;
              const isBottomLine = nLines > 1 && rk === nLines;
              const teamAvg = study.best.teamAvg;
              return (
                <div
                  key={study.position}
                  className={cn(
                    'rounded-2xl border bg-white p-4 flex flex-col gap-3 shadow-sm',
                    isTopLine && 'ring-2 ring-emerald-200/80 border-emerald-100',
                    isBottomLine && !isTopLine && 'ring-1 ring-orange-100 border-orange-100'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn('p-2 rounded-xl shrink-0', positionColors[study.position])}>
                        <PosIcon size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 leading-tight">
                          {study.position}s
                        </p>
                        <p className="text-sm font-black text-gray-900 truncate">{study.count} jugadores</p>
                      </div>
                    </div>
                    {nLines > 1 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'shrink-0 text-[9px] font-black px-2 py-0.5 rounded-md border-0',
                          isTopLine && 'bg-emerald-600 text-white',
                          isBottomLine && !isTopLine && 'bg-orange-600 text-white',
                          !isTopLine && !isBottomLine && 'bg-gray-100 text-gray-600'
                        )}
                      >
                        #{rk}/{nLines}
                      </Badge>
                    )}
                  </div>

                  <div>
                    <div className="flex items-end justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Baremo medio</span>
                      <span
                        className={cn(
                          'text-2xl font-black tabular-nums leading-none',
                          study.avgNotaFinal >= 75
                            ? 'text-emerald-600'
                            : study.avgNotaFinal >= 60
                              ? 'text-blue-600'
                              : 'text-gray-700'
                        )}
                      >
                        {study.avgNotaFinal.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          study.avgNotaFinal >= 70 ? 'bg-emerald-500' : study.avgNotaFinal >= 55 ? 'bg-blue-400' : 'bg-gray-400'
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, study.avgNotaFinal))}%` }}
                      />
                    </div>
                  </div>

                  <div
                    className={cn(
                      'flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5',
                      study.deltaVsTeam >= 2 && 'bg-emerald-50 text-emerald-800',
                      study.deltaVsTeam <= -2 && 'bg-orange-50 text-orange-900',
                      study.deltaVsTeam > -2 && study.deltaVsTeam < 2 && 'bg-gray-50 text-gray-700'
                    )}
                  >
                    <span className="font-bold text-[10px] uppercase text-gray-500">Δ lista</span>
                    <span className="font-black tabular-nums">
                      {study.deltaVsTeam >= 0 ? '+' : ''}
                      {study.deltaVsTeam.toFixed(1)}
                      <span className="font-normal text-gray-400 ml-1">(glob. {teamAvg.toFixed(1)})</span>
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                    <div className="flex justify-between gap-1 border-b border-gray-50 pb-1">
                      <dt className="text-gray-500 font-medium">Comp. ∅</dt>
                      <dd className="font-bold tabular-nums text-gray-800">{study.avgCompromiso.toFixed(1)}</dd>
                    </div>
                    <div className="flex justify-between gap-1 border-b border-gray-50 pb-1">
                      <dt className="text-gray-500 font-medium">Desem. ∅</dt>
                      <dd className="font-bold tabular-nums text-gray-800">{study.avgDesempeno.toFixed(1)}</dd>
                    </div>
                    <div className="flex justify-between gap-1 border-b border-gray-50 pb-1">
                      <dt className="text-gray-500 font-medium">Fiab. ∅</dt>
                      <dd className="font-bold tabular-nums text-gray-800">{study.avgFiabilidad.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between gap-1 border-b border-gray-50 pb-1">
                      <dt className="text-gray-500 font-medium">Part. ∅</dt>
                      <dd className="font-bold tabular-nums text-gray-800">{study.avgPartidos.toFixed(1)}</dd>
                    </div>
                    <div className="col-span-2 flex justify-between gap-1 pt-0.5">
                      <dt className="text-gray-500 font-medium">Rango baremo</dt>
                      <dd className="font-bold tabular-nums text-gray-800">
                        {study.minBaremo.toFixed(1)} – {study.maxBaremo.toFixed(1)}{' '}
                        <span className="font-normal text-gray-400 text-[10px]"> (±{study.spreadBaremo.toFixed(1)}) </span>
                      </dd>
                    </div>
                  </dl>

                  {study.lowSampleCount > 0 && (
                    <Badge className="w-fit bg-amber-100 text-amber-900 text-[9px] font-black uppercase hover:bg-amber-100">
                      Baja muestra: {study.lowSampleCount}/{study.count}
                    </Badge>
                  )}

                  <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-gray-100">
                    {studyMiniPlayer(study.best, 'Mejor baremo')}
                    {study.count > 1 && study.best.player.id !== study.worst.player.id && studyMiniPlayer(study.worst, 'Colista')}
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
