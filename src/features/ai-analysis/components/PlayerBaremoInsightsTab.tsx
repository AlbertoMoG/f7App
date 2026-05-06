import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Brain,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Shield,
  Sword,
  Crosshair,
  BarChart3,
  Award,
  Download,
  Lightbulb,
  Sparkles,
  ArrowLeftRight,
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type {
  Injury,
  Match,
  Player,
  PlayerSeason,
  PlayerStat,
  Season,
  Position,
  Opponent,
  Field,
  StandingsEntry,
  LeagueFixture,
} from '../../../types';
import { calculatePlayerRating } from '../../../lib/ratingSystem';
import {
  buildBaremoPositionStudy,
  rankPositionLinesByStrength,
  type BaremoRowInput,
  type PositionBaremoFilledStudy,
} from '@/lib/baremoPositionStudy';
import { pickIdealBaremoSeven } from '@/lib/baremoIdealSeven';
import { buildValoracionPredictionSquad } from '@/lib/valoracionPredictionSquad';
import { buildValoracionPositionHints } from '@/lib/valoracionPositionHints';
import { usePlayerRatings } from '@/features/ai-analysis/hooks/usePlayerRatings';
import { usePredictions } from '@/features/ai-analysis/hooks/usePredictions';
import { squadMeanBaremo } from '@/lib/optimalRecommendedSquad';
import { buildIdealVsRealComparison, rosterPlayersAttendingMatch } from '@/lib/idealVsRealConvocatoria';

interface PlayerBaremoInsightsTabProps {
  /** Misma lista que la tabla de Plantilla (filtros búsqueda, estado, posición, temporada). */
  plantillaPlayers: Player[];
  /** Plantilla completa del equipo (motor de predicción / convocatoria modelo). */
  teamPlayers: Player[];
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
  onOpenInteligencia?: () => void;
}

type SortKey = 'number' | 'baremo' | 'delta' | 'compromiso' | 'desempeno' | 'fiabilidad';

const POSITION_ORDER: Position[] = ['Portero', 'Defensa', 'Medio', 'Delantero'];

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

const COL_COUNT = 10;

const CHART_MEDIA_COLORS = ['#EAB308', '#3B82F6', '#10B981', '#EF4444'];
const CHART_TECHO_FILL = '#94a3b8';

const SHORT_LINE: Record<Position, string> = {
  Portero: 'POR',
  Defensa: 'DEF',
  Medio: 'MED',
  Delantero: 'DEL',
};

export function PlayerBaremoInsightsTab({
  plantillaPlayers,
  teamPlayers,
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
  onOpenInteligencia,
}: PlayerBaremoInsightsTabProps) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = React.useState<SortKey>('baremo');
  const [sortDir, setSortDir] = React.useState<'desc' | 'asc'>('desc');
  const [groupByPosition, setGroupByPosition] = React.useState(true);

  const scheduledNext = React.useMemo(() => {
    const scheduled = matches
      .filter((m) => m.status === 'scheduled' && (globalSeasonId === 'all' || m.seasonId === globalSeasonId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return scheduled[0] ?? null;
  }, [matches, globalSeasonId]);

  const { allPlayerRatings } = usePlayerRatings({
    players: teamPlayers,
    playerSeasons,
    matches,
    stats,
    injuries,
    seasons,
    globalSeasonId,
  });

  const predictions = usePredictions({
    players: teamPlayers,
    playerSeasons,
    matches,
    stats,
    opponents,
    seasons,
    fields,
    injuries,
    globalSeasonId,
    standings,
    allPlayerRatings,
    leagueFixtures,
  });

  type RowModel = BaremoRowInput;

  const rows = React.useMemo(() => {
    const data = plantillaPlayers.map((player) => {
      const r = calculatePlayerRating(matches, injuries, stats, player, globalSeasonId, seasons);
      return {
        player,
        notaFinal: r.notaFinal,
        compromiso: r.notaCompromiso,
        desempeno: r.notaDesempeno,
        fiabilidad: r.factorFiabilidad,
        partidos: r.partidosComputables,
      };
    });
    const teamAvg = data.length > 0 ? data.reduce((a, x) => a + x.notaFinal, 0) / data.length : 0;
    return data.map((x) => ({
      ...x,
      delta: x.notaFinal - teamAvg,
      teamAvg,
    }));
  }, [plantillaPlayers, matches, stats, seasons, injuries, globalSeasonId]);

  const positionStudies = React.useMemo(() => buildBaremoPositionStudy(rows), [rows]);

  const lineStrengthRank = React.useMemo(
    () => rankPositionLinesByStrength(positionStudies),
    [positionStudies]
  );

  const teamAvgBaremo = rows[0]?.teamAvg ?? 0;

  const idealSeven = React.useMemo(() => pickIdealBaremoSeven(rows), [rows]);

  const idealDeltaVsList = idealSeven.avgBaremo - teamAvgBaremo;

  const valoracionPrediction = React.useMemo(() => {
    const rosterAvgBaremoCompute =
      allPlayerRatings.length > 0
        ? allPlayerRatings.reduce((a, p) => a + p.rating, 0) / allPlayerRatings.length
        : 70;

    const focusPred = scheduledNext ? predictions.get(scheduledNext.id) : undefined;
    if (scheduledNext && focusPred && focusPred.recommendedSquad.length > 0) {
      return {
        ok: true as const,
        message: undefined as string | undefined,
        squad: focusPred.recommendedSquad,
        notes: focusPred.reasons,
        outfieldSlots: focusPred.recommendedOutfieldSlots,
        predGF: focusPred.modelPredGF,
        predGC: focusPred.modelPredGC,
        seasonIdUsed: scheduledNext.seasonId,
        matchId: scheduledNext.id,
        rosterAvgBaremo: rosterAvgBaremoCompute,
        squadMeanBaremo: squadMeanBaremo(focusPred.recommendedSquad, allPlayerRatings, rosterAvgBaremoCompute),
        allPlayerRatings,
        pipelineSynced: true as const,
      };
    }

    return buildValoracionPredictionSquad({
      teamPlayers,
      playerSeasons,
      matches,
      stats,
      injuries,
      seasons,
      globalSeasonId,
    });
  }, [
    scheduledNext,
    predictions,
    allPlayerRatings,
    teamPlayers,
    playerSeasons,
    matches,
    stats,
    injuries,
    seasons,
    globalSeasonId,
  ]);

  const idealVsReal = React.useMemo(() => {
    if (!valoracionPrediction.ok || !valoracionPrediction.matchId || valoracionPrediction.squad.length === 0) {
      return null;
    }
    const real = rosterPlayersAttendingMatch(teamPlayers, stats, valoracionPrediction.matchId);
    return buildIdealVsRealComparison(
      valoracionPrediction.squad,
      real,
      valoracionPrediction.allPlayerRatings,
      valoracionPrediction.rosterAvgBaremo
    );
  }, [valoracionPrediction, teamPlayers, stats]);

  const predDeltaVsFiltered =
    valoracionPrediction.ok && valoracionPrediction.squad.length > 0
      ? valoracionPrediction.squadMeanBaremo - teamAvgBaremo
      : 0;

  const improvementHints = React.useMemo(() => {
    const filled = positionStudies.filter((x): x is PositionBaremoFilledStudy => !x.empty);
    const extras = valoracionPrediction.ok
      ? valoracionPrediction.notes
      : valoracionPrediction.message
        ? [valoracionPrediction.message]
        : [];
    return buildValoracionPositionHints(filled, extras);
  }, [positionStudies, valoracionPrediction]);

  const positionChartBars = React.useMemo(
    () =>
      positionStudies
        .filter((s): s is PositionBaremoFilledStudy => !s.empty)
        .map((s) => ({
          positionIndex: POSITION_ORDER.indexOf(s.position),
          label: SHORT_LINE[s.position],
          media: Number(s.avgNotaFinal.toFixed(2)),
          techo: Number(s.maxBaremo.toFixed(2)),
        }))
        .sort((a, b) => a.positionIndex - b.positionIndex),
    [positionStudies]
  );

  const sorted = React.useMemo(() => {
    const k = [...rows];
    k.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      switch (sortKey) {
        case 'number':
          va = a.player.number;
          vb = b.player.number;
          break;
        case 'delta':
          va = a.delta;
          vb = b.delta;
          break;
        case 'compromiso':
          va = a.compromiso;
          vb = b.compromiso;
          break;
        case 'desempeno':
          va = a.desempeno;
          vb = b.desempeno;
          break;
        case 'fiabilidad':
          va = a.fiabilidad;
          vb = b.fiabilidad;
          break;
        default:
          va = a.notaFinal;
          vb = b.notaFinal;
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        if (vb !== va) return sortDir === 'desc' ? vb - va : va - vb;
        return (a.player.alias || a.player.firstName).localeCompare(b.player.alias || b.player.firstName);
      }
      if (vb !== va) return String(va).localeCompare(String(vb)) * (sortDir === 'desc' ? -1 : 1);
      return (a.player.alias || a.player.firstName).localeCompare(b.player.alias || b.player.firstName);
    });
    return k;
  }, [rows, sortKey, sortDir]);

  const exportValoracionCsv = React.useCallback(() => {
    const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
    const ln = (...cells: (string | number)[]) => cells.map(esc).join(';');

    const lines: string[] = [];
    lines.push(ln('Fútbol 7 Manager · Valoración IA'));
    lines.push(ln('Media lista filtrada (Plantilla)', teamAvgBaremo.toFixed(2)));
    lines.push(ln('Jugadores visibles lista', rows.length));

    lines.push('');
    lines.push(ln('—— Convocatoria modelo predicción (sinergias, 2–3–1, cupo auto)'));
    if (valoracionPrediction.ok && valoracionPrediction.squad.length > 0) {
      lines.push(ln('Motor temporada', valoracionPrediction.seasonIdUsed));
      lines.push(ln('λ modelo GF/GC', `${valoracionPrediction.predGF.toFixed(3)} / ${valoracionPrediction.predGC.toFixed(3)}`));
      if ('pipelineSynced' in valoracionPrediction && valoracionPrediction.pipelineSynced) {
        lines.push(ln('Convocatoria', 'Sincronizada usePredictions'));
      }
      lines.push(ln('Media baremo pool temporada', valoracionPrediction.rosterAvgBaremo.toFixed(2)));
      lines.push(ln('Media baremo convocatoria modelo', valoracionPrediction.squadMeanBaremo.toFixed(2)));
      lines.push(ln('Cupo campo (outfieldSlots)', valoracionPrediction.outfieldSlots));
      lines.push(ln('Δ modelo − lista filtrada', predDeltaVsFiltered.toFixed(2)));
      lines.push('');
      lines.push(ln('Modelo convocatoria — #', 'Nombre', 'Pos', 'Baremo (pool)'));
      for (const pl of valoracionPrediction.squad) {
        lines.push(
          ln(
            pl.number,
            pl.alias?.trim() || `${pl.firstName} ${pl.lastName}`,
            pl.position,
            (
              valoracionPrediction.allPlayerRatings.find((r) => r.id === pl.id)?.rating ??
              valoracionPrediction.rosterAvgBaremo
            ).toFixed(2)
          )
        );
      }
      for (const note of valoracionPrediction.notes) {
        lines.push(ln('Nota motor', note));
      }
    } else {
      lines.push(ln('Sin convocatoria modelo', valoracionPrediction.message ?? ''));
    }

    if (idealVsReal && valoracionPrediction.matchId) {
      lines.push('');
      lines.push(ln('—— Ideal modelo vs alta real'));
      lines.push(ln('Partido Id', valoracionPrediction.matchId));
      lines.push(ln('Baremo medio modelo', idealVsReal.avgIdeal.toFixed(2)));
      lines.push(ln('Baremo medio alta confirmada', idealVsReal.avgReal.toFixed(2)));
      lines.push(ln('Δ modelo − real', idealVsReal.deltaAvgIdealMinusReal.toFixed(2)));
      lines.push(ln('Media baremo solape', idealVsReal.avgOverlap.toFixed(2)));
      lines.push('');
      lines.push(ln('Coincidencias', '#', 'Nombre', 'Pos', 'Baremo'));
      for (const pl of idealVsReal.inBoth) {
        lines.push(
          ln(
            pl.number,
            pl.alias?.trim() || `${pl.firstName} ${pl.lastName}`,
            pl.position,
            (
              valoracionPrediction.allPlayerRatings.find((r) => r.id === pl.id)?.rating ??
              valoracionPrediction.rosterAvgBaremo
            ).toFixed(2)
          )
        );
      }
      lines.push('');
      lines.push(ln('En modelo no confirmados', '#', 'Nombre', 'Pos', 'Baremo'));
      for (const pl of idealVsReal.onlyIdeal) {
        lines.push(
          ln(
            pl.number,
            pl.alias?.trim() || `${pl.firstName} ${pl.lastName}`,
            pl.position,
            (
              valoracionPrediction.allPlayerRatings.find((r) => r.id === pl.id)?.rating ??
              valoracionPrediction.rosterAvgBaremo
            ).toFixed(2)
          )
        );
      }
      lines.push('');
      lines.push(ln('Alta sin estar en modelo', '#', 'Nombre', 'Pos', 'Baremo'));
      for (const pl of idealVsReal.onlyReal) {
        lines.push(
          ln(
            pl.number,
            pl.alias?.trim() || `${pl.firstName} ${pl.lastName}`,
            pl.position,
            (
              valoracionPrediction.allPlayerRatings.find((r) => r.id === pl.id)?.rating ??
              valoracionPrediction.rosterAvgBaremo
            ).toFixed(2)
          )
        );
      }
    }

    lines.push('');
    lines.push(ln('—— Referencia VII sólo baremo (2–3–1 sin motor IA)'));
    lines.push(ln('Baremo medio bloque VII', idealSeven.avgBaremo.toFixed(2)));
    lines.push(ln('Δ VII − lista', (idealSeven.avgBaremo - teamAvgBaremo).toFixed(2)));
    lines.push(ln('VII baremo completo', idealSeven.complete ? 'Sí' : 'No'));
    if (!idealSeven.complete) lines.push(ln('Huecos VII baremo', idealSeven.missing.join(' | ')));

    lines.push('');
    lines.push(ln('VII baremo — dorsal', 'Nombre', 'Pos', 'Baremo'));
    for (const r of idealSeven.picked) {
      const p = r.player;
      lines.push(ln(p.number, p.alias?.trim() || `${p.firstName} ${p.lastName}`, p.position, r.notaFinal.toFixed(2)));
    }

    lines.push('');
    lines.push(
      ln('Demarcación', 'N jug.', 'Baremo ∅', 'Comp. ∅', 'Desem. ∅', 'Fiab. ∅', 'Part. ∅', 'Δ lista', 'Rango', 'Baja muestra')
    );
    for (const s of positionStudies.filter((x): x is PositionBaremoFilledStudy => !x.empty)) {
      lines.push(
        ln(
          `${s.position}s`,
          s.count,
          s.avgNotaFinal.toFixed(2),
          s.avgCompromiso.toFixed(2),
          s.avgDesempeno.toFixed(2),
          s.avgFiabilidad.toFixed(2),
          s.avgPartidos.toFixed(1),
          s.deltaVsTeam.toFixed(2),
          `${s.minBaremo.toFixed(1)}–${s.maxBaremo.toFixed(1)}`,
          `${s.lowSampleCount}/${s.count}`
        )
      );
    }

    lines.push('');
    lines.push(ln('#', 'Nombre', 'Pos', 'Baremo', 'Comp.', 'Desem.', 'Fiab.', 'Part.', 'Δ media', 'Baja muestra'));
    for (const r of sorted) {
      const p = r.player;
      lines.push(
        ln(
          p.number,
          p.alias?.trim() || `${p.firstName} ${p.lastName}`,
          p.position,
          r.notaFinal.toFixed(2),
          r.compromiso.toFixed(2),
          r.desempeno.toFixed(2),
          r.fiabilidad.toFixed(2),
          r.partidos,
          r.delta.toFixed(2),
          r.fiabilidad < 0.72 || r.partidos <= 3 ? 'Sí' : 'No'
        )
      );
    }

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valoracion-ia-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV descargado');
  }, [
    sorted,
    positionStudies,
    idealSeven,
    rows.length,
    teamAvgBaremo,
    valoracionPrediction,
    predDeltaVsFiltered,
    idealVsReal,
  ]);

  const toggleSort = (key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        return prev;
      }
      setSortDir('desc');
      return key;
    });
  };

  const SortIcon = ({ sk }: { sk: SortKey }) =>
    sortKey === sk ? (
      sortDir === 'desc' ? (
        <ArrowDownRight size={12} className="inline ml-0.5 opacity-70" />
      ) : (
        <ArrowUpRight size={12} className="inline ml-0.5 opacity-70" />
      )
    ) : null;

  const studyMiniPlayer = (row: RowModel, badge: string) => {
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

  const renderRow = ({ player, notaFinal, compromiso, desempeno, fiabilidad, partidos, delta, teamAvg }: RowModel) => {
    const fragile = fiabilidad < 0.72 || partidos <= 3;
    const initials = `${player.firstName?.[0] ?? ''}${player.lastName?.[0] ?? ''}`;
    return (
      <TableRow
        key={player.id}
        className="cursor-pointer hover:bg-emerald-50/50"
        onClick={() => navigate(`/players/${player.id}`)}
      >
        <TableCell className="text-center font-black text-gray-700 tabular-nums w-[56px]">{player.number}</TableCell>
        <TableCell className="w-[56px]">
          <Avatar className="h-10 w-10 rounded-xl border border-gray-100">
            <AvatarImage src={player.photoUrl} className="object-cover" referrerPolicy="no-referrer" />
            <AvatarFallback className="rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-black">
              {initials}
            </AvatarFallback>
          </Avatar>
        </TableCell>
        <TableCell className="font-bold text-gray-900 min-w-[120px]">
          {player.alias?.trim() || player.firstName}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-[10px] font-bold">
            {player.position}
          </Badge>
        </TableCell>
        <TableCell
          className={cn(
            'text-right font-black tabular-nums',
            notaFinal >= 75 ? 'text-emerald-600' : notaFinal >= 60 ? 'text-blue-600' : 'text-gray-700'
          )}
        >
          {notaFinal.toFixed(1)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-xs text-gray-600">{compromiso.toFixed(1)}</TableCell>
        <TableCell className="text-right tabular-nums text-xs text-gray-600">{desempeno.toFixed(1)}</TableCell>
        <TableCell className="text-right tabular-nums text-xs">{fiabilidad.toFixed(2)}</TableCell>
        <TableCell
          className={cn(
            'text-right font-bold tabular-nums text-sm',
            delta >= 3 ? 'text-emerald-600' : delta <= -3 ? 'text-orange-700' : 'text-gray-500'
          )}
        >
          {delta >= 0 ? '+' : ''}
          {delta.toFixed(1)}
          <span className="hidden lg:inline font-normal text-gray-400 text-[10px] ml-1">(avg {teamAvg.toFixed(1)})</span>
        </TableCell>
        <TableCell className="text-center w-[96px]">
          {fragile ? (
            <Badge className="bg-amber-100 text-amber-900 text-[9px] font-black uppercase hover:bg-amber-100">
              Baja muestra
            </Badge>
          ) : (
            <span className="text-[10px] text-gray-300">—</span>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const bodyRows =
    sorted.length === 0 ? (
      <TableRow>
        <TableCell colSpan={COL_COUNT} className="text-center py-12 text-gray-500">
          Ningún jugador cumple los filtros actuales de Plantilla. Ajusta búsqueda, estado o posición en la pestaña
          Plantilla.
        </TableCell>
      </TableRow>
    ) : groupByPosition ? (
      POSITION_ORDER.map((pos) => {
        const groupRows = sorted.filter((r) => r.player.position === pos);
        if (groupRows.length === 0) return null;
        const PosIcon = positionIcons[pos];
        return (
          <React.Fragment key={pos}>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-100">
              <TableCell colSpan={COL_COUNT} className="py-2.5 px-4">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded-lg', positionColors[pos])}>
                    <PosIcon size={14} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{pos}s</span>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-none text-[9px] font-bold px-1.5 py-0 rounded-md">
                    {groupRows.length}
                  </Badge>
                </div>
              </TableCell>
            </TableRow>
            {groupRows.map(renderRow)}
          </React.Fragment>
        );
      })
    ) : (
      sorted.map(renderRow)
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900 flex items-center gap-2">
            <Brain className="text-emerald-600" size={28} />
            Valoración IA
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Misma vista que <strong className="text-gray-800">Plantilla</strong> (# y foto). Convocatoria modelo replica el
            motor de predicción (sinergias, alta al próximo partido, 2-3-1); debajo tienes consejos por demarcación.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={groupByPosition ? 'default' : 'outline'}
            size="sm"
            className={cn('rounded-xl font-bold gap-2', groupByPosition && 'bg-emerald-600 hover:bg-emerald-700')}
            onClick={() => setGroupByPosition((v) => !v)}
            title={groupByPosition ? 'Ver lista única' : 'Agrupar por demarcación'}
          >
            <Layers size={16} />
            Por posición
          </Button>
          {onOpenInteligencia && (
            <Button
              variant="outline"
              className="rounded-xl font-bold border-emerald-200 text-emerald-800 hover:bg-emerald-50"
              onClick={onOpenInteligencia}
            >
              Inteligencia IA
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl font-bold gap-2 border-gray-200"
            onClick={exportValoracionCsv}
            disabled={rows.length === 0}
          >
            <Download size={16} />
            Exportar CSV
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
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
                      <span className="truncate">
                        Fuerza relativa: {lineStrengthRank.join(' → ')}
                      </span>
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Misma convocatoria que el motor de <strong className="text-gray-800">Inteligencia IA</strong>{' '}
                  (sinergias, disponibilidad al próximo partido, forma 2-3-1 y cupo 10–12), comparada con tus filtros de
                  Plantilla. Gráficos por línea y sugerencias de refuerzo.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50/90 to-emerald-50/35 px-4 py-4 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl bg-white/60 border border-white/80 p-3">
                  <p className="text-[10px] font-black uppercase text-violet-600 tracking-wide">Lista filtrada</p>
                  <p className="text-2xl font-black tabular-nums text-gray-900">{teamAvgBaremo.toFixed(1)}</p>
                  <p className="text-[11px] text-gray-500">{rows.length} jugadores en vista Plantilla</p>
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
                        {valoracionPrediction.pipelineSynced
                          ? 'λ post-modificadores'
                          : 'λ baseline liga'}{' '}
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
                      {predDeltaVsFiltered.toFixed(1)} vs lista filtrada
                    </Badge>
                  )}
                  {valoracionPrediction.ok &&
                    valoracionPrediction.squad.length > 0 &&
                    Math.abs(valoracionPrediction.squadMeanBaremo - valoracionPrediction.rosterAvgBaremo) > 0.35 && (
                      <Badge variant="outline" className="text-[10px] font-bold border-slate-200 text-slate-700">
                        {valoracionPrediction.squadMeanBaremo >= valoracionPrediction.rosterAvgBaremo ? '+' : ''}
                        {(valoracionPrediction.squadMeanBaremo - valoracionPrediction.rosterAvgBaremo).toFixed(1)} vs
                        pool
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
                        Comparado en el mismo partido (asistencias con estado{' '}
                        <strong className="text-gray-700">presente</strong>).
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
                    <p className="text-[10px] font-black uppercase text-orange-700 mb-2">
                      Sugeridos por IA sin alta
                    </p>
                    {renderConvocatoriaCompareList(idealVsReal.onlyIdeal)}
                  </div>
                  <div className="rounded-xl bg-white border border-sky-200 p-3">
                    <p className="text-[10px] font-black uppercase text-sky-800 mb-2">
                      Alta real fuera del modelo
                    </p>
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
                      formatter={(v: number | string, name: string) => [`${Number(v).toFixed(1)}`, name === 'media' ? 'Medio línea' : 'Techo']}
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
                            study.avgNotaFinal >= 75 ? 'text-emerald-600' : study.avgNotaFinal >= 60 ? 'text-blue-600' : 'text-gray-700'
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
      )}

      <Card className="border-none shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Ranking de plantilla</CardTitle>
            <CardDescription>
              Δ = diferencia vs la media de los jugadores listados (mismos filtros que Plantilla).
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="text-center cursor-pointer select-none font-black text-[10px] uppercase w-[56px]"
                    onClick={() => toggleSort('number')}
                  >
                    # <SortIcon sk="number" />
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-gray-500 w-[56px]">Foto</TableHead>
                  <TableHead className="min-w-[120px]">Jugador</TableHead>
                  <TableHead>Pos.</TableHead>
                  <TableHead className="text-right cursor-pointer select-none font-black" onClick={() => toggleSort('baremo')}>
                    Baremo <SortIcon sk="baremo" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('compromiso')}>
                    Comp. <SortIcon sk="compromiso" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('desempeno')}>
                    Desem. <SortIcon sk="desempeno" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('fiabilidad')}>
                    Fiab. <SortIcon sk="fiabilidad" />
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none font-bold text-emerald-700"
                    onClick={() => toggleSort('delta')}
                  >
                    Δ Media <SortIcon sk="delta" />
                  </TableHead>
                  <TableHead className="text-center w-[96px]">Perfil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{bodyRows}</TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
