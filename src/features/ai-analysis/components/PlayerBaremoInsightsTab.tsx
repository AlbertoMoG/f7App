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
  Download,
} from 'lucide-react';
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
import type { PositionBaremoFilledStudy } from '@/lib/baremoPositionStudy';
import type { BaremoTableRowModel } from '@/features/ai-analysis/hooks/useBaremoValoracionPositionStudy';
import { useBaremoValoracionPositionStudy } from '@/features/ai-analysis/hooks/useBaremoValoracionPositionStudy';

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

  const {
    rows,
    teamAvgBaremo,
    positionStudies,
    idealSeven,
    valoracionPrediction,
    idealVsReal,
    predDeltaVsFiltered,
  } = useBaremoValoracionPositionStudy({
    listPlayers: plantillaPlayers,
    teamPlayers,
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

  type RowModel = BaremoTableRowModel;

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
            Misma vista que <strong className="text-gray-800">Plantilla</strong> (# y foto). Ranking y Δ vs media; el{' '}
            <strong className="text-gray-800">Estudio por demarcación</strong> está en Inteligencia IA → Laboratorio plantilla.
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
