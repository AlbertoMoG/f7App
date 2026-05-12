import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Activity, CloudLightning, GitBranch, LayoutGrid, Shield, Sparkles, Users, Zap } from 'lucide-react';
import type {
  Injury,
  LeagueFixture,
  Match,
  Opponent,
  Player,
  PlayerSeason,
  PlayerStat,
  Season,
  StandingsEntry,
  Team,
  Field,
} from '../../../types';
import { buildSynergyMap } from '../../../lib/synergyCalculator';
import { computePlantillaIaSnapshot } from '../../../lib/plantillaIaInsights';
import { usePlayerRatings } from '../hooks/usePlayerRatings';

import { useBaremoValoracionPositionStudy } from '../hooks/useBaremoValoracionPositionStudy';
import { BaremoPositionStudyPanel } from './BaremoPositionStudyPanel';

interface PlantillaIALabTabProps {
  team: Team | null;
  players: Player[];
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

export function PlantillaIALabTab({
  team,
  players,
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
}: PlantillaIALabTabProps) {
  const { filteredPlayers } = usePlayerRatings({
    players,
    playerSeasons,
    matches,
    stats,
    injuries,
    seasons,
    globalSeasonId,
  });

  const positionStudy = useBaremoValoracionPositionStudy({
    listPlayers: filteredPlayers,
    teamPlayers: players,
    playerSeasons,
    matches,
    stats,
    seasons,
    injuries,
    opponents,
    standings,
    fields,
    leagueFixtures,
    globalSeasonId,
  });

  const synergyMap = React.useMemo(() => buildSynergyMap(matches, stats), [matches, stats]);

  const snapshot = React.useMemo(
    () =>
      computePlantillaIaSnapshot(
        players,
        playerSeasons,
        matches,
        stats,
        injuries,
        seasons,
        globalSeasonId,
        synergyMap
      ),
    [
      players,
      playerSeasons,
      matches,
      stats,
      injuries,
      seasons,
      globalSeasonId,
      synergyMap,
    ]
  );

  const baremoBand = (n: number) =>
    n >= 75 ? 'text-emerald-600' : n >= 60 ? 'text-blue-600' : n >= 45 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0">
              <LayoutGrid size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-emerald-900">
                Laboratorio de plantilla
              </h2>
              <p className="text-sm text-gray-600 mt-1 max-w-xl">
                Métricas derivadas del sistema de baremo y de sinergias históricas (mismos datos que alimentan las
                predicciones). Temporada:{' '}
                <span className="font-bold text-gray-800">
                  {globalSeasonId === 'all'
                    ? 'todas'
                    : seasons.find((s) => s.id === globalSeasonId)?.name ?? '—'}
                </span>
                .
              </p>
            </div>
          </div>
          {team?.name && (
            <Badge variant="outline" className="text-[10px] font-black uppercase shrink-0">
              {team.name}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Users size={14} />
              Plantilla en análisis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black tabular-nums">{snapshot.rosterSize}</p>
            <p className="text-[11px] text-gray-500 mt-1">jugadores con ficha en el filtro actual</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Activity size={14} />
              Baremo medio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn('text-3xl font-black tabular-nums', baremoBand(snapshot.teamAvgBaremo))}>
              {snapshot.teamAvgBaremo.toFixed(1)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">nota final del motor (0–100)</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Dispersión σ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-violet-700 tabular-nums">
              {snapshot.stdDevBaremo.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">desigualdad del nivel entre convocados</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Zap size={14} />
              En estudio IA (baremo agregado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black tabular-nums">{filteredPlayers.length}</p>
            <p className="text-[11px] text-gray-500 mt-1">coincide con el subconjunto predictivo</p>
          </CardContent>
        </Card>
      </div>

      <BaremoPositionStudyPanel
        rowsCount={positionStudy.rows.length}
        teamAvgBaremo={positionStudy.teamAvgBaremo}
        lineStrengthRank={positionStudy.lineStrengthRank}
        valoracionPrediction={positionStudy.valoracionPrediction}
        scheduledNext={positionStudy.scheduledNext}
        idealVsReal={positionStudy.idealVsReal}
        predDeltaVsFiltered={positionStudy.predDeltaVsFiltered}
        improvementHints={positionStudy.improvementHints}
        positionChartBars={positionStudy.positionChartBars}
        positionStudies={positionStudy.positionStudies}
        idealSeven={positionStudy.idealSeven}
        idealDeltaVsList={positionStudy.idealDeltaVsList}
        listSummaryTitle="Plantilla (temporada)"
        listSummaryHint={`${filteredPlayers.length} jugadores en la temporada activa`}
        listComparisonNote="la plantilla de esta temporada."
        modelDeltaVsLabel="plantilla (temporada)"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <Sparkles className="text-amber-500 shrink-0" size={18} />
              Amuleto
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Jugador con mejor combinación de compromiso (convocatorias / asistencia) y puntos de baremo por partido
              cuando está en el campo. Requiere ≥4 partidos computables y ≥4 con asistencia declarada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.amuleto ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-lg font-black leading-tight">{snapshot.amuleto.displayName}</p>
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    {snapshot.amuleto.position}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  Índice {snapshot.amuleto.luckIndex.toFixed(3)} · compromiso{' '}
                  {snapshot.amuleto.notaCompromiso.toFixed(1)} · pts/partido {snapshot.amuleto.mediaPorPartido.toFixed(1)}{' '}
                  · {snapshot.amuleto.partidosAsistidos} asist. / {snapshot.amuleto.partidosComputables} comp.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay suficientes jugadores con muestra mínima en esta temporada.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-2xl overflow-hidden border-l-4 border-l-slate-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <CloudLightning className="text-slate-500 shrink-0" size={18} />
              Mala suerte
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Misma fórmula que el amuleto; destaca el menor índice entre jugadores elegibles (solo si hay dispersión
              real entre ellos).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.malaSuerte ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-lg font-black leading-tight">{snapshot.malaSuerte.displayName}</p>
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    {snapshot.malaSuerte.position}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  Índice {snapshot.malaSuerte.luckIndex.toFixed(3)} · compromiso{' '}
                  {snapshot.malaSuerte.notaCompromiso.toFixed(1)} · pts/partido{' '}
                  {snapshot.malaSuerte.mediaPorPartido.toFixed(1)} · {snapshot.malaSuerte.partidosAsistidos} asist. /{' '}
                  {snapshot.malaSuerte.partidosComputables} comp.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {snapshot.amuleto
                  ? 'Todos los elegibles van parejos, o solo hay un jugador con muestra suficiente.'
                  : 'Sin datos para contrastar.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield size={18} className="text-blue-500" />
              Media de baremos por posición
            </CardTitle>
            <CardDescription>
              Nota final (0–100) del motor, promediada por demarcación. Comparada con la media de toda la plantilla en
              el mismo filtro de temporada.
            </CardDescription>
            {snapshot.byPosition.length > 0 && snapshot.rosterSize > 0 && (
              <p className="text-xs font-semibold text-gray-700 mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-gray-500 uppercase tracking-wide text-[10px] font-black">Media plantilla</span>
                <span className={cn('text-base font-black tabular-nums', baremoBand(snapshot.teamAvgBaremo))}>
                  {snapshot.teamAvgBaremo.toFixed(1)}
                </span>
                <span className="text-[10px] text-gray-400">
                  ({snapshot.rosterSize} jug.
                  {snapshot.stdDevBaremo > 0 && (
                    <>
                      {' '}
                      · σ {snapshot.stdDevBaremo.toFixed(1)}
                    </>
                  )}
                  )
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.byPosition.length === 0 ? (
              <p className="text-sm text-gray-500">Sin jugadores clasificados por posición en este filtro.</p>
            ) : (
              <>
                <p className="text-[10px] text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5">
                  <span className="inline-flex h-2 w-6 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                  <span>Media de la línea</span>
                  <span className="inline-block h-3 w-px bg-slate-700 rounded-full shrink-0" aria-hidden />
                  <span>Media plantilla</span>
                </p>
                {snapshot.byPosition.map((row) => {
                  const delta = row.avgBaremo - snapshot.teamAvgBaremo;
                  const deltaRounded = Math.round(delta * 10) / 10;
                  const deltaCls =
                    deltaRounded >= 3
                      ? 'text-emerald-700'
                      : deltaRounded <= -3
                        ? 'text-red-600'
                        : 'text-gray-500';
                  const teamPct = Math.min(100, Math.max(0, snapshot.teamAvgBaremo));
                  const linePct = Math.min(100, Math.max(0, row.avgBaremo));
                  return (
                    <div
                      key={row.position}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className="font-bold text-[10px] shrink-0">{row.position}</Badge>
                        <span className="text-[11px] text-gray-500 truncate">{row.count} jug.</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 flex-1 sm:flex-initial justify-end">
                        <div
                          className="relative h-2 w-24 sm:w-36 shrink-0 rounded-full bg-gray-200"
                          title={`${row.position}: media línea ${linePct.toFixed(1)} · media plantilla ${snapshot.teamAvgBaremo.toFixed(1)}`}
                        >
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${linePct}%` }}
                          />
                          {snapshot.teamAvgBaremo > 0 && (
                            <span
                              className="absolute top-1/2 z-10 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-800 shadow-sm"
                              style={{ left: `${teamPct}%` }}
                              aria-hidden
                            />
                          )}
                        </div>
                        <div className="flex items-baseline gap-2 tabular-nums shrink-0">
                          <span className={cn('text-sm font-black w-9 text-right', baremoBand(row.avgBaremo))}>
                            {row.avgBaremo.toFixed(0)}
                          </span>
                          <span
                            className={cn('text-[10px] font-black w-14 text-right sm:w-16 sm:text-xs', deltaCls)}
                            title={`Diferencia vs media plantilla (${snapshot.teamAvgBaremo.toFixed(1)})`}
                          >
                            Δ{deltaRounded > 0 ? '+' : ''}
                            {deltaRounded.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch size={18} className="text-fuchsia-600" />
              Parejas con historia positiva
            </CardTitle>
            <CardDescription>
              Partidos en los que ambos asistieron y el equipo ganó; &quot;letal&quot; marca el umbral del modelo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.synergyPairs.length === 0 ? (
              <p className="text-sm text-gray-500">Aún no hay parejas con volumen suficiente de partidos juntos.</p>
            ) : (
              snapshot.synergyPairs.map((p) => (
                <div
                  key={`${p.playerAId}-${p.playerBId}`}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white border border-gray-100 shadow-sm"
                >
                  <span className="text-sm font-bold text-gray-800 truncate min-w-0">
                    {p.playerAName} + {p.playerBName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.isLethal && (
                      <Badge className="bg-fuchsia-600 text-white text-[9px] font-black uppercase">Letal</Badge>
                    )}
                    <span className="text-xs font-black text-gray-600 tabular-nums">
                      {(p.winRate * 100).toFixed(0)}% ({p.matchCount} p.)
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden border-amber-100">
        <CardHeader>
          <CardTitle className="text-base text-amber-900">Baja confianza estadística</CardTitle>
          <CardDescription>
            Pocas muestras jugadas o factor de fiabilidad bajo: el baremo es menos representativo para predicciones y
            rankings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snapshot.lowReliability.length === 0 ? (
            <p className="text-sm text-gray-600">Ningún jugador marcado con alerta en este filtro.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {snapshot.lowReliability.map((x) => (
                <li
                  key={x.playerId}
                  className="text-sm flex flex-wrap items-baseline gap-x-2 gap-y-1 p-2 rounded-lg bg-amber-50/80 border border-amber-100"
                >
                  <span className="font-bold text-gray-900">{x.displayName}</span>
                  <span className="text-[10px] font-bold uppercase text-amber-800">
                    Fiab. {(x.factorFiabilidad * 100).toFixed(0)}% · {x.partidosComputables} PJ
                  </span>
                  <span className="text-[11px] text-gray-500">baremo {x.notaFinal.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
