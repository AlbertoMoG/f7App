import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Activity, GitBranch, LayoutGrid, Shield, Users, Zap } from 'lucide-react';
import type { Injury, Match, Player, PlayerSeason, PlayerStat, Season, Team } from '../../../types';
import { buildSynergyMap } from '../../../lib/synergyCalculator';
import { computePlantillaIaSnapshot } from '../../../lib/plantillaIaInsights';
import { usePlayerRatings } from '../hooks/usePlayerRatings';

interface PlantillaIALabTabProps {
  team: Team | null;
  players: Player[];
  playerSeasons: PlayerSeason[];
  matches: Match[];
  stats: PlayerStat[];
  seasons: Season[];
  injuries: Injury[];
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield size={18} className="text-blue-500" />
              Fuerza por demarcación
            </CardTitle>
            <CardDescription>Media del baremo dentro de cada posición declarada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.byPosition.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos de plantilla en este filtro.</p>
            ) : (
              snapshot.byPosition.map((row) => (
                <div
                  key={row.position}
                  className="flex items-center justify-between gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className="font-bold text-[10px] shrink-0">{row.position}</Badge>
                    <span className="text-[11px] text-gray-500 truncate">{row.count} jug.</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 sm:w-36 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min(100, row.avgBaremo)}%` }}
                      />
                    </div>
                    <span className={cn('text-sm font-black tabular-nums w-10 text-right', baremoBand(row.avgBaremo))}>
                      {row.avgBaremo.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))
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
