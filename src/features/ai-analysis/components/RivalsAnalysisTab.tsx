import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Swords, Info, CalendarClock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { RivalThreatRow } from '../hooks/useRivalThreatAnalysis';
import { cn } from '@/lib/utils';

/** `PPG 1.20 (mediana grupo 1.50)` desde rivalThreatScore */
function parsePpgLine(line: string | null): {
  primary: number;
  median?: number;
} | null {
  if (!line) return null;
  const m = line.match(/^PPG\s+([\d.]+)\s*\(\s*mediana grupo\s+([\d.]+)\s*\)$/i);
  if (!m || m[1] == null || m[2] == null) return null;
  return { primary: Number(m[1]), median: Number(m[2]) };
}

/** `12 pts · 8-4 GF-GC` desde rivalThreatScore */
function parseTableLine(line: string | null): {
  pts: number;
  gf: number;
  ga: number;
} | null {
  if (!line) return null;
  const m = line.match(/^(\d+)\s*pts\s*·\s*(\d+)\s*-\s*(\d+)\s+GF-GC\s*$/i);
  if (!m || m[1] == null || m[2] == null || m[3] == null) return null;
  return { pts: Number(m[1]), gf: Number(m[2]), ga: Number(m[3]) };
}

/** `3V-1E-2D (últ. 5)` para chips de resultado */
function parseStreakPrefix(line: string | null): {
  vd: number;
  ed: number;
  ld: number;
  restLabel: string;
} | null {
  if (!line) return null;
  const idx = line.indexOf('(');
  const head = idx >= 0 ? line.slice(0, idx).trim() : line.trim();
  const restLabel = idx >= 0 ? line.slice(idx).trim() : '';
  const m = head.match(/^(\d+)V-(\d+)E-(\d+)D\s*$/i);
  if (!m || m[1] == null || m[2] == null || m[3] == null) return null;
  return {
    vd: Number(m[1]),
    ed: Number(m[2]),
    ld: Number(m[3]),
    restLabel,
  };
}

function scoreBarToneClass(isManaged: boolean, level: RivalThreatRow['level']): string {
  if (isManaged) {
    if (level === 'Alto') return 'bg-emerald-500';
    if (level === 'Medio') return 'bg-emerald-400/90';
    return 'bg-emerald-300/80';
  }
  if (level === 'Alto') return 'bg-red-400';
  if (level === 'Medio') return 'bg-amber-400';
  return 'bg-emerald-400';
}

function levelBadgeClass(level: RivalThreatRow['level'], kind?: RivalThreatRow['rowKind']): string {
  if (kind === 'managed') {
    if (level === 'Alto') return 'bg-emerald-600 text-white border-emerald-700';
    if (level === 'Medio') return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }
  if (level === 'Alto') return 'bg-red-100 text-red-800 border-red-200';
  if (level === 'Medio') return 'bg-amber-100 text-amber-900 border-amber-200';
  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
}

function AnalysisColumnsHeader({ headerTone }: { headerTone: 'rose' | 'emerald' }) {
  const th = cn(
    'align-top whitespace-normal',
    headerTone === 'rose'
      ? 'bg-rose-50/70 text-foreground'
      : 'bg-emerald-50/70 text-emerald-950'
  );

  function Hint({
    children,
    className,
    tip,
    alignCenter,
  }: {
    children: React.ReactNode;
    className?: string;
    tip: string;
    alignCenter?: boolean;
  }) {
    return (
      <TableHead className={cn(className, th)}>
        <div
          className={cn(
            'flex items-start gap-1 min-h-[1.25rem]',
            alignCenter && 'justify-center text-center'
          )}
        >
          {children}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    'shrink-0 mt-0.5 inline-flex rounded-full p-0.5 text-muted-foreground hover:bg-black/5',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                  aria-label="Detalle de columna"
                >
                  <Info className="h-3 w-3 opacity-80" />
                </button>
              }
            />
            <TooltipContent
              side="top"
              align="start"
              className="max-w-[280px] px-3 py-2 text-xs leading-snug z-50"
            >
              {tip}
            </TooltipContent>
          </Tooltip>
        </div>
      </TableHead>
    );
  }

  const tips = {
    equipo:
      'Club analizado: puede ser un rival de la temporada o tu propio equipo en la segunda tabla.',
    peligro:
      'Para rivales: índice de peligro para tu club. Para tu equipo: ritmo competitivo (0–100) según resultados y contexto, no “amenaza de rival”.',
    factores:
      'Argumentos calculados detrás del índice: H2H, forma del grupo vs la mediana de puntos/goles por partido, próximo duelo cuando aplica.',
    ppg:
      'Puntos por partido del club frente al ritmo medio del grupo (mediana PPG cuando aplica).',
    liga:
      'En rivales: enfrentamientos directos en liga contra tu equipo (marcador y registro). En tu fila: suma de todos tus partidos de liga de la temporada contra rivales.',
    forma:
      'Para rivales: tendencia reciente en partidos entre equipos del grupo. Para tu equipo: tendencia sobre tus últimos partidos de liga registrados.',
    racha:
      'Últimos resultados de liga, del más reciente al más antiguo en la ventana usada.',
    tabla:
      'Puntos y goles desde la clasificación guardada si existe; si no, calculado desde partidos de «Mis partidos» y enfrentamientos del grupo.',
    proximo:
      'Si hay encuentro programado pendiente contra ese rival en liga (o contra algún rival en tu caso en gestión).',
  };

  return (
    <TableHeader>
      <TableRow className={th}>
        <Hint className={cn('min-w-[10rem]', th)} tip={tips.equipo}>
          <span>Equipo</span>
        </Hint>
        <Hint className={cn('text-center w-24', th)} tip={tips.peligro} alignCenter>
          <span>Peligro / ritmo</span>
        </Hint>
        <Hint className={cn('min-w-[13rem] max-w-[18rem]', th)} tip={tips.factores}>
          <span>Factores</span>
        </Hint>
        <Hint className={cn('text-center w-[8rem]', th)} tip={tips.ppg} alignCenter>
          <span>PPG / grupo</span>
        </Hint>
        <Hint className={cn('min-w-[7rem]', th)} tip={tips.liga}>
          <span>Liga (H2H o total)</span>
        </Hint>
        <Hint className={cn('min-w-[9rem]', th)} tip={tips.forma}>
          <span>Forma</span>
        </Hint>
        <Hint className={cn('min-w-[6rem]', th)} tip={tips.racha}>
          <span>Racha</span>
        </Hint>
        <Hint className={cn('min-w-[8rem]', th)} tip={tips.tabla}>
          <span>Tabla</span>
        </Hint>
        <Hint className={cn('text-center w-24', th)} tip={tips.proximo} alignCenter>
          <span>Próximo</span>
        </Hint>
      </TableRow>
    </TableHeader>
  );
}

interface RivalsAnalysisTabProps {
  rows: RivalThreatRow[];
  managedTeamRow: RivalThreatRow | null;
  seasonLabel: string;
  isAllSeasonsNote: boolean;
}

function ThreatTableRow({ row, stripeMuted }: { row: RivalThreatRow; stripeMuted?: boolean }) {
  const isManaged = row.rowKind === 'managed';
  const ppgParsed = parsePpgLine(row.ppgLine ?? null);
  const tableParsed = parseTableLine(row.tableLine ?? null);
  const streakParsed = parseStreakPrefix(row.streakLine ?? null);

  return (
    <TableRow
      className={cn(
        stripeMuted && !isManaged ? 'bg-muted/20' : '',
        isManaged ? 'bg-emerald-50/40 hover:bg-emerald-50/55 border-l-4 border-emerald-400/60' : ''
      )}
    >
      <TableCell className="py-4 align-middle">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted/80 border border-border/80 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
            {row.shieldUrl ? (
              <img
                src={row.shieldUrl}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Swords className="w-[18px] h-[18px] text-muted-foreground/50" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm leading-snug tracking-tight text-foreground">
                {row.name}
              </p>
              {isManaged ? (
                <Badge
                  variant="outline"
                  className="text-[9px] uppercase border-emerald-300/70 bg-emerald-50 text-emerald-900 py-0 shadow-none"
                >
                  Gestión
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center align-middle py-4 w-[6.75rem]">
        <div
          className={cn(
            'mx-auto flex flex-col items-center gap-2 rounded-xl border px-2 py-3 shadow-sm bg-card/95',
            isManaged ? 'border-emerald-200/80' : 'border-border/70'
          )}
        >
          <span className="text-3xl leading-none tabular-nums font-bold tracking-tight text-foreground">
            {row.threatScore}
          </span>
          <div className="w-full px-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-[width]', scoreBarToneClass(isManaged, row.level))}
                style={{ width: `${Math.min(100, Math.max(0, row.threatScore))}%` }}
              />
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'font-medium text-[9px] uppercase tracking-wide px-2 py-0 border',
              levelBadgeClass(row.level, row.rowKind)
            )}
          >
            {row.level}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="align-top py-4 min-w-[12.5rem] max-w-[min(18rem,32vw)] border-l border-border/40">
        {row.reasons.length > 0 ? (
          <ul
            className={cn(
              'list-none space-y-2 max-h-[11rem] overflow-y-auto overscroll-contain pr-1 m-0 p-0',
              '[scrollbar-width:thin]'
            )}
          >
            {row.reasons.map((r, i) => (
              <li
                key={i}
                className={cn(
                  'text-[11px] leading-snug pl-3 border-l-2',
                  'text-foreground/90 break-words',
                  isManaged ? 'border-emerald-500/65' : 'border-rose-500/50'
                )}
              >
                {r}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] italic text-muted-foreground leading-snug">Sin factores resumidos</p>
        )}
      </TableCell>
      <TableCell className="text-center align-middle py-4 w-[9.25rem]">
        {ppgParsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold tabular-nums text-foreground leading-none">
                {ppgParsed.primary.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase">PPG</span>
            </div>
            {ppgParsed.median != null ? (
              <Badge
                variant="secondary"
                className="tabular-nums text-[10px] font-semibold px-2 py-0.5 bg-muted/70 text-muted-foreground border-0"
              >
                med. grupo {ppgParsed.median.toFixed(2)}
              </Badge>
            ) : null}
          </div>
        ) : row.ppgLine ? (
          <span className="text-xs leading-snug text-muted-foreground block max-w-[9rem] mx-auto">
            {row.ppgLine}
          </span>
        ) : (
          <span className="text-xs italic text-muted-foreground/75">Sin PPG</span>
        )}
      </TableCell>
      <TableCell className="align-middle py-4 min-w-[7.25rem]">
        {row.h2hPlayed > 0 ? (
          <div
            className={cn(
              'rounded-xl border px-3 py-2 shadow-sm bg-gradient-to-br',
              isManaged
                ? 'from-emerald-50/90 to-transparent border-emerald-200/60'
                : 'from-muted/50 to-transparent border-border/60'
            )}
          >
            <p className="text-lg font-bold tabular-nums tracking-tight text-center leading-none">
              {row.h2hGf}
              <span className="text-muted-foreground/80 font-semibold px-1">–</span>
              {row.h2hGa}
            </p>
            <p className="mt-2 text-[11px] font-medium text-muted-foreground text-center font-mono">
              {row.h2hRecord}
            </p>
          </div>
        ) : (
          <span className="text-xs italic text-muted-foreground/75">Sin datos H2H</span>
        )}
      </TableCell>
      <TableCell className="align-middle py-4 min-w-[9rem] max-w-[12rem]">
        {row.formLine ? (
          <div
            className={cn(
              'rounded-lg px-2.5 py-2 text-[11px] leading-snug border bg-muted/35',
              isManaged ? 'border-emerald-200/50' : 'border-border/50'
            )}
          >
            {row.formLine}
          </div>
        ) : (
          <span className="text-xs italic text-muted-foreground/75">—</span>
        )}
      </TableCell>
      <TableCell className="align-middle py-4 font-mono text-xs">
        {row.streakLine ? (
          streakParsed ? (
            <div className="flex flex-col gap-1.5 items-start">
              <div className="flex flex-wrap gap-1 justify-start">
                {streakParsed.vd > 0 ? (
                  <span className="inline-flex items-center rounded-md bg-emerald-500/18 text-emerald-900 dark:text-emerald-100 px-1.5 py-0.5 font-semibold tabular-nums">
                    {streakParsed.vd}V
                  </span>
                ) : null}
                {streakParsed.ed > 0 ? (
                  <span className="inline-flex items-center rounded-md bg-amber-500/22 text-amber-950 px-1.5 py-0.5 font-semibold tabular-nums">
                    {streakParsed.ed}E
                  </span>
                ) : null}
                {streakParsed.ld > 0 ? (
                  <span className="inline-flex items-center rounded-md bg-red-500/18 text-red-950 px-1.5 py-0.5 font-semibold tabular-nums">
                    {streakParsed.ld}D
                  </span>
                ) : null}
              </div>
              {streakParsed.restLabel ? (
                <span className="text-[10px] text-muted-foreground leading-tight max-w-[8rem]">
                  {streakParsed.restLabel}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-[11px] leading-snug text-foreground/90">{row.streakLine}</span>
          )
        ) : (
          <span className="text-xs italic text-muted-foreground/75">—</span>
        )}
      </TableCell>
      <TableCell className="align-middle py-4 min-w-[7.5rem]">
        {tableParsed ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xl font-bold tabular-nums text-foreground leading-none">
              {tableParsed.pts}
              <span className="text-xs font-semibold text-muted-foreground ml-1">pts</span>
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground font-medium">
              {tableParsed.gf} GF · {tableParsed.ga} GC
            </span>
          </div>
        ) : row.tableLine ? (
          <span className="text-xs leading-snug text-muted-foreground">{row.tableLine}</span>
        ) : (
          <span className="text-xs italic text-muted-foreground/75">Sin tabla</span>
        )}
      </TableCell>
      <TableCell className="text-center align-middle py-4 w-24">
        {row.hasUpcoming ? (
          <Badge
            variant="secondary"
            className="gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-amber-200/80 bg-amber-50 text-amber-950"
          >
            <CalendarClock className="h-3.5 w-3.5 opacity-80" />
            Pendiente
          </Badge>
        ) : (
          <span className="text-[11px] font-medium text-muted-foreground/60">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function RivalsAnalysisTab({
  rows,
  managedTeamRow,
  seasonLabel,
  isAllSeasonsNote,
}: RivalsAnalysisTabProps) {
  if (rows.length === 0 && !managedTeamRow) {
    return (
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Swords className="text-rose-600" size={20} />
            Análisis de rivales
          </CardTitle>
          <CardDescription>
            No hay rivales ni datos para tu equipo en esta temporada. Asigna rivales a la
            temporada o registra partidos / liga entre equipos.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Swords className="text-rose-600" size={20} />
              Análisis de rivales
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="p-1 rounded-full hover:bg-gray-100 cursor-help inline-flex">
                      <Info size={14} className="text-gray-400" />
                    </span>
                  }
                />
                <TooltipContent className="max-w-[340px] p-4 text-xs space-y-2 leading-relaxed">
                  <p>
                    <strong>Rivales:</strong> puntos de riesgo para tu equipo (H2H, forma en grupo,
                    clasificación grabada en Firestore, ritmo PPG próximo duelo cuando aplica).
                  </p>
                  <p>
                    <strong>Tu equipo:</strong> segunda tabla con la misma estructura: el segundo
                    indicador valor es tu índice de ritmo (0–100) basado en resultados agregados, no peligro
                    de rival.
                  </p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription className="mt-1">
              Temporada: <strong>{seasonLabel}</strong>
              {isAllSeasonsNote ? (
                <span className="text-amber-700/90">
                  {' '}
                  (filtro “todas”; se usa la temporada más reciente para este análisis)
                </span>
              ) : null}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="divide-y divide-border">
          {rows.length > 0 ? (
            <>
              <p className="px-4 py-2 text-xs font-semibold text-rose-900/90 bg-rose-50/35 border-b border-rose-100/70">
                Rivales ({rows.length})
              </p>
              <Table>
                <AnalysisColumnsHeader headerTone="rose" />
                <TableBody>
                  {rows.map((row, idx) => (
                    <ThreatTableRow
                      key={row.opponentId}
                      row={row}
                      stripeMuted={idx % 2 === 1}
                    />
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}

          {managedTeamRow ? (
            <>
              <div className="px-4 py-3 border-t border-emerald-100 bg-emerald-50/35">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-emerald-950">Tu equipo (gestión)</p>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="inline-flex rounded-full p-1 text-muted-foreground hover:bg-emerald-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label="Qué muestra esta tabla"
                        >
                          <Info size={14} />
                        </button>
                      }
                    />
                    <TooltipContent side="bottom" className="max-w-[310px] p-3 text-xs leading-snug">
                      <p>
                        Misma cuadrícula que arriba para comparar. La primera columna de liga muestra tus
                        partidos de liga contra rivales sumados; el índice mide ritmo competitivo (no amenaza).
                        Datos de tabla cuando no hay fila manual en Firestore se calculan desde partidos del
                        grupo y «Mis partidos».
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <Table>
                <AnalysisColumnsHeader headerTone="emerald" />
                <TableBody>
                  <ThreatTableRow row={managedTeamRow} />
                </TableBody>
              </Table>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
