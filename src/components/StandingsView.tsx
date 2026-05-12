import React, { useState, useMemo, useRef } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trophy, Save, ListRestart, Info, Brain, TrendingUp, CalendarRange, Loader2, ExternalLink, UsersRound, ShieldAlert } from 'lucide-react';
import { Match, Opponent, StandingsEntry, Team, Season, LeagueFixture } from '../types';
import { cn } from '@/lib/utils';
import LeagueGroupView from './LeagueGroupView';
import { collection, addDoc, updateDoc, doc, writeBatch } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { db } from '../firebase';
import { toast } from 'sonner';
import { buildMissingIdaYVueltaMatches } from '../lib/leagueSchedule';
import { opponentIdsWithAmbiguousLeagueLeg } from '../lib/leagueMatchLegValidation';
import {
  aggregateLeagueStandingsFromResults,
  collectStandingsParticipantIds,
  emptyLeagueStandingStats,
  isLeagueMatchForStandings,
  type LeagueStandingStats,
} from '../lib/leagueStandingsAggregate';
import {
  auditLeagueStandingsData,
  standingsEntryHasManualAdjustment,
} from '../lib/leagueStandingsAudit';
import { resetManualStandingsDeltaForSeason } from '../lib/resetManualStandingsForSeason';
import { computeProjectedStandings, type StandingsRowInput } from '../lib/standingsProjection';

interface StandingsViewProps {
  team: Team | null;
  opponents: Opponent[];
  matches: Match[];
  standings: StandingsEntry[];
  globalSeasonId: string;
  seasons: Season[];
  leagueFixtures: LeagueFixture[];
  onOpenMatch?: (matchId: string) => void;
}

/** Delta manual guardado en Firestore (puede ser cero si no hay ajuste). */
interface ManualDelta {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

const ZERO_DELTA: ManualDelta = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };

function rowToCombinedStandingsInput(row: RowData): StandingsRowInput {
  return {
    opponentId: row.opponentId,
    name: row.name,
    shieldUrl: row.shieldUrl,
    played: row.played + row.manualDelta.played,
    won: row.won + row.manualDelta.won,
    drawn: row.drawn + row.manualDelta.drawn,
    lost: row.lost + row.manualDelta.lost,
    points: row.points + row.manualDelta.points,
    goalsFor: row.goalsFor + row.manualDelta.goalsFor,
    goalsAgainst: row.goalsAgainst + row.manualDelta.goalsAgainst,
  };
}

interface RowData {
  opponentId: string;
  name: string;
  shieldUrl?: string;
  /** Valores puramente calculados de matches + leagueFixtures (para mostrar y ordenar). */
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** Delta manual almacenado en Firestore (solo para edición y badge de ajuste). */
  manualDelta: ManualDelta;
  isAuto: boolean;
  dbId?: string;
}

type StandingsSubTab = 'table' | 'my-matches' | 'group';

export default function StandingsView({ team, opponents, matches, standings, globalSeasonId, seasons, leagueFixtures, onOpenMatch }: StandingsViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedStandings, setEditedStandings] = useState<Record<string, Partial<StandingsEntry>>>({});
  const [generatingLeague, setGeneratingLeague] = useState(false);
  const [standingsSubTab, setStandingsSubTab] = useState<StandingsSubTab>('table');
  const [auditOpen, setAuditOpen] = useState(false);
  const [resettingManual, setResettingManual] = useState(false);
  const generatingLeagueRef = useRef(false);

  const currentSeasonId = useMemo(() => {
    if (globalSeasonId !== 'all') return globalSeasonId;
    return seasons.length > 0 ? seasons[0].id : '';
  }, [globalSeasonId, seasons]);

  const leagueOpponentIds = useMemo(() => {
    return opponents
      .filter((o) => o.seasonIds?.includes(currentSeasonId))
      .map((o) => o.id);
  }, [opponents, currentSeasonId]);

  const leagueMatches = useMemo(() => {
    return matches
      .filter((m) => m.seasonId === currentSeasonId && isLeagueMatchForStandings(m))
      .sort((a, b) => {
        const ja = parseInt(a.round?.replace(/\D/g, '') || '0', 10);
        const jb = parseInt(b.round?.replace(/\D/g, '') || '0', 10);
        if (ja !== jb) return ja - jb;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
  }, [matches, currentSeasonId]);

  const currentSeason = useMemo(
    () => seasons.find((s) => s.id === currentSeasonId),
    [seasons, currentSeasonId]
  );

  const handleGenerateLeagueSchedule = async () => {
    if (!team || !currentSeasonId || !currentSeason) {
      toast.error('Selecciona una temporada con datos completos');
      return;
    }
    if (leagueOpponentIds.length === 0) {
      toast.error('No hay rivales asignados a esta temporada');
      return;
    }
    if (generatingLeagueRef.current) return;
    generatingLeagueRef.current = true;
    const ambiguousIds = opponentIdsWithAmbiguousLeagueLeg(matches, currentSeasonId, leagueOpponentIds);
    if (ambiguousIds.length > 0) {
      const names = ambiguousIds
        .map((id) => opponents.find((o) => o.id === id)?.name ?? id)
        .join(', ');
      toast.error(
        `Corrige Local/Visitante en tus partidos de liga antes de completar calendario. Rivales afectados: ${names}`
      );
      generatingLeagueRef.current = false;
      return;
    }
    setGeneratingLeague(true);
    try {
      const toAdd = buildMissingIdaYVueltaMatches(
        team.id,
        currentSeasonId,
        leagueOpponentIds,
        currentSeason.startYear,
        matches
      );
      if (toAdd.length === 0) {
        toast.info('Ya existen todos los partidos de liga (ida y vuelta) para esta temporada');
        return;
      }
      const batch = writeBatch(db);
      for (const payload of toAdd) {
        const ref = doc(collection(db, 'matches'));
        batch.set(ref, payload);
      }
      await batch.commit();
      toast.success(`Creados ${toAdd.length} partido(s) de liga. Ajusta jornadas o fechas si lo necesitas.`);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el calendario');
    } finally {
      generatingLeagueRef.current = false;
      setGeneratingLeague(false);
    }
  };

  const handleLeagueRoundBlur = async (match: Match, value: string) => {
    const next = value.trim();
    if (next === (match.round ?? '').trim()) return;
    try {
      await updateDoc(doc(db, 'matches', match.id), { round: next || null });
      toast.success('Jornada actualizada');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar la jornada');
    }
  };

  const computedStandingsById = useMemo(() => {
    if (!currentSeasonId) return new Map<string, LeagueStandingStats>();
    return aggregateLeagueStandingsFromResults(
      currentSeasonId,
      team,
      opponents,
      matches,
      leagueFixtures
    );
  }, [currentSeasonId, team, opponents, matches, leagueFixtures]);

  const standingsIdsThisSeason = useMemo(
    () => standings.filter((s) => s.seasonId === currentSeasonId).map((s) => s.opponentId),
    [standings, currentSeasonId]
  );

  const participantIds = useMemo(
    () =>
      currentSeasonId
        ? collectStandingsParticipantIds(
            currentSeasonId,
            team,
            opponents,
            matches,
            leagueFixtures,
            standingsIdsThisSeason
          )
        : [],
    [currentSeasonId, team, opponents, matches, leagueFixtures, standingsIdsThisSeason]
  );

  const fullStandings = useMemo(() => {
    if (!currentSeasonId) return [];

    const statsList: RowData[] = [];

    for (const id of participantIds) {
      if (id === 'my-team' && !team) continue;
      const auto = computedStandingsById.get(id) ?? emptyLeagueStandingStats();
      const entry = standings.find((s) => s.seasonId === currentSeasonId && s.opponentId === id);
      const showRow =
        id === 'my-team'
          ? !!team
          : auto.played > 0 ||
            !!entry ||
            leagueFixtures.some(
              (f) =>
                f.seasonId === currentSeasonId &&
                (f.homeOpponentId === id || f.awayOpponentId === id)
            ) ||
            matches.some(
              (m) =>
                m.seasonId === currentSeasonId &&
                isLeagueMatchForStandings(m) &&
                m.opponentId === id
            );
      if (!showRow) continue;

      let name: string;
      let shieldUrl: string | undefined;
      if (id === 'my-team' && team) {
        name = team.name;
        shieldUrl = team.shieldUrl;
      } else {
        const opp = opponents.find((o) => o.id === id);
        name = opp?.name ?? `Equipo (${id.length > 10 ? `${id.slice(0, 8)}…` : id})`;
        shieldUrl = opp?.shieldUrl;
      }

      statsList.push({
        opponentId: id,
        name,
        shieldUrl,
        // Valores automáticos (matches + leagueFixtures) → base del orden y la vista
        played: auto.played,
        won: auto.won,
        drawn: auto.drawn,
        lost: auto.lost,
        goalsFor: auto.goalsFor,
        goalsAgainst: auto.goalsAgainst,
        points: auto.points,
        // Delta manual de Firestore → solo para edición y badge de ajuste
        manualDelta: entry
          ? {
              played: entry.played ?? 0,
              won: entry.won ?? 0,
              drawn: entry.drawn ?? 0,
              lost: entry.lost ?? 0,
              goalsFor: entry.goalsFor ?? 0,
              goalsAgainst: entry.goalsAgainst ?? 0,
              points: entry.points ?? 0,
            }
          : ZERO_DELTA,
        isAuto: false,
        dbId: entry?.id,
      });
    }

    return statsList.sort((a, b) => {
      const aPts = a.points + a.manualDelta.points;
      const bPts = b.points + b.manualDelta.points;
      if (bPts !== aPts) return bPts - aPts;
      const aGF = a.goalsFor + a.manualDelta.goalsFor;
      const aGC = a.goalsAgainst + a.manualDelta.goalsAgainst;
      const bGF = b.goalsFor + b.manualDelta.goalsFor;
      const bGC = b.goalsAgainst + b.manualDelta.goalsAgainst;
      const aDiff = aGF - aGC;
      const bDiff = bGF - bGC;
      if (bDiff !== aDiff) return bDiff - aDiff;
      return bGF - aGF;
    });
  }, [
    participantIds,
    computedStandingsById,
    standings,
    currentSeasonId,
    team,
    opponents,
    matches,
    leagueFixtures,
  ]);

  const standingsForProjection = useMemo(
    () => fullStandings.map(rowToCombinedStandingsInput),
    [fullStandings]
  );

  const predictedStandings = useMemo(
    () => computeProjectedStandings(standingsForProjection, leagueFixtures, currentSeasonId ?? ''),
    [standingsForProjection, leagueFixtures, currentSeasonId],
  );

  const handleInputChange = (opponentId: string, field: keyof StandingsEntry, value: string) => {
    const numValue = parseInt(value) || 0;
    setEditedStandings(prev => {
      const currentEntry = prev[opponentId] || {};
      const updatedEntry = { ...currentEntry, [field]: numValue };

      // Si se cambia G, E o P, actualizamos automáticamente PJ y Puntos
      if (field === 'won' || field === 'drawn' || field === 'lost') {
        const entry = standings.find(s => s.seasonId === currentSeasonId && s.opponentId === opponentId);
        const auto = computedStandingsById.get(opponentId) ?? emptyLeagueStandingStats();
        
        const currentWon = updatedEntry.won !== undefined ? updatedEntry.won : ((entry?.won || 0) + auto.won);
        const currentDrawn = updatedEntry.drawn !== undefined ? updatedEntry.drawn : ((entry?.drawn || 0) + auto.drawn);
        const currentLost = updatedEntry.lost !== undefined ? updatedEntry.lost : ((entry?.lost || 0) + auto.lost);
        
        updatedEntry.points = (currentWon * 3) + currentDrawn;
        updatedEntry.played = currentWon + currentDrawn + currentLost;
      }

      return {
        ...prev,
        [opponentId]: updatedEntry
      };
    });
  };

  const auditResult = useMemo(() => {
    if (!currentSeasonId) return null;
    return auditLeagueStandingsData({
      seasonId: currentSeasonId,
      team,
      opponents,
      matches,
      leagueFixtures,
      standings,
    });
  }, [currentSeasonId, team, opponents, matches, leagueFixtures, standings]);

  const manualStandingsForSeason = useMemo(() => {
    return standings.filter(
      (s) => s.seasonId === currentSeasonId && standingsEntryHasManualAdjustment(s)
    );
  }, [standings, currentSeasonId]);

  const openAuditDialog = () => setAuditOpen(true);

  const handleResetManualStandings = async () => {
    if (!team || manualStandingsForSeason.length === 0) return;
    if (
      !confirm(
        `¿Poner a cero el ajuste manual en ${manualStandingsForSeason.length} fila(s) de standings para esta temporada? La tabla usará solo el cálculo automático.`
      )
    ) {
      return;
    }
    setResettingManual(true);
    try {
      await resetManualStandingsDeltaForSeason(team, currentSeasonId, standings);
      toast.success('Ajustes manuales de clasificación puestos a cero');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo actualizar standings');
    } finally {
      setResettingManual(false);
    }
  };

  const saveChanges = async () => {
    if (!team) return;
    
    try {
      const promises = Object.entries(editedStandings).map(async ([opponentId, data]) => {
        const existingEntry = standings.find(s => s.seasonId === currentSeasonId && s.opponentId === opponentId);
        const auto = computedStandingsById.get(opponentId) ?? emptyLeagueStandingStats();

        // Al guardar, restamos lo automático de los totales introducidos por el usuario
        // para que Firestore solo guarde el "resto de partidos" (manual)
        const manualData = {
          played: Math.max(0, (data.played ?? (existingEntry?.played || 0) + auto.played) - auto.played),
          won: Math.max(0, (data.won ?? (existingEntry?.won || 0) + auto.won) - auto.won),
          drawn: Math.max(0, (data.drawn ?? (existingEntry?.drawn || 0) + auto.drawn) - auto.drawn),
          lost: Math.max(0, (data.lost ?? (existingEntry?.lost || 0) + auto.lost) - auto.lost),
          goalsFor: Math.max(0, (data.goalsFor ?? (existingEntry?.goalsFor || 0) + auto.goalsFor) - auto.goalsFor),
          goalsAgainst: Math.max(0, (data.goalsAgainst ?? (existingEntry?.goalsAgainst || 0) + auto.goalsAgainst) - auto.goalsAgainst),
          points: Math.max(0, (data.points ?? (existingEntry?.points || 0) + auto.points) - auto.points),
        };
        
        if (existingEntry) {
          return updateDoc(doc(db, 'standings', existingEntry.id), manualData);
        } else {
          return addDoc(collection(db, 'standings'), {
            teamId: team.id,
            seasonId: currentSeasonId,
            opponentId,
            ...manualData
          });
        }
      });

      await Promise.all(promises);
      toast.success('Clasificación actualizada');
      setIsEditing(false);
      setEditedStandings({});
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar la clasificación');
    }
  };

  if (!currentSeasonId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <Trophy className="h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No hay temporada seleccionada</h3>
        <p className="text-gray-500 max-w-xs">Selecciona o crea una temporada para ver la clasificación del equipo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clasificación</h2>
          <p className="text-gray-500 text-sm mt-1">
            Tabla, tus partidos de liga y enfrentamientos entre rivales del grupo (datos para la IA).
          </p>
        </div>
        {standingsSubTab === 'table' ? (
          <div className="flex flex-wrap gap-2 shrink-0 justify-end">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => { setIsEditing(false); setEditedStandings({}); }}>
                  Cancelar
                </Button>
                <Button onClick={saveChanges} className="bg-blue-600 hover:bg-blue-700">
                  <Save className="mr-2 h-4 w-4" /> Guardar Cambios
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={openAuditDialog}>
                  <ShieldAlert className="mr-2 h-4 w-4" /> Auditar datos
                </Button>
                <Button onClick={() => setIsEditing(true)}>
                  <ListRestart className="mr-2 h-4 w-4" /> Actualizar Puntos
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-px">
        {([
          { id: 'table' as const, label: 'Tabla', Icon: Trophy },
          { id: 'my-matches' as const, label: 'Mis partidos de liga', Icon: CalendarRange },
          { id: 'group' as const, label: 'Liga entre equipos', Icon: UsersRound },
        ]).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setStandingsSubTab(id)}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors',
              standingsSubTab === id
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {standingsSubTab === 'my-matches' ? (
      <Card className="rounded-2xl border-gray-200 overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-blue-600" />
            Calendario de liga (ida y vuelta)
          </CardTitle>
          <CardDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Genera 2 partidos por rival con Local/Visitante definido. Solo crea piernas que falten; corrige antes partidos sin condición para evitar duplicados confusos.
            </span>
            <Button
              type="button"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 shrink-0"
              disabled={!team || leagueOpponentIds.length === 0 || generatingLeague}
              onClick={handleGenerateLeagueSchedule}
            >
              {generatingLeague ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Generar / completar calendario
            </Button>
          </CardDescription>
          <p className="text-xs text-gray-500">
            Rivales en esta temporada: <strong>{leagueOpponentIds.length}</strong>
            {currentSeason ? ` · Año inicio: ${currentSeason.startYear}` : null}
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {leagueMatches.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No hay partidos de liga en esta temporada. Usa el botón superior o créalos desde Partidos.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="min-w-[7rem]">Jornada</TableHead>
                  <TableHead className="min-w-[6rem]">Fecha</TableHead>
                  <TableHead>Rival</TableHead>
                  <TableHead className="text-center w-20">L / V</TableHead>
                  <TableHead className="text-center">Resultado</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  {onOpenMatch ? <TableHead className="w-12" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leagueMatches.map((m) => {
                  const opp = opponents.find((o) => o.id === m.opponentId);
                  const scoreLabel =
                    m.status === 'completed' &&
                    m.scoreTeam != null &&
                    m.scoreOpponent != null
                      ? `${m.scoreTeam} - ${m.scoreOpponent}`
                      : '—';
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Input
                          className="h-8 text-sm min-w-[6.5rem]"
                          defaultValue={m.round ?? ''}
                          placeholder="Ej. Jornada 3"
                          onBlur={(e) => handleLeagueRoundBlur(m, e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                        {new Date(m.date).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="font-medium">{opp?.name ?? m.opponentId}</TableCell>
                      <TableCell className="text-center text-xs">
                        {m.isHome === false ? 'Visitante' : 'Local'}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">{scoreLabel}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-[10px]">
                          {m.status === 'completed' ? 'Finalizado' : 'Programado'}
                        </Badge>
                      </TableCell>
                      {onOpenMatch ? (
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Abrir en partidos"
                            onClick={() => onOpenMatch(m.id)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      ) : null}

      {standingsSubTab === 'table' ? (
      <>
      <Card className="rounded-2xl border-gray-200 overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Tabla de la Liga
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Ordenada automáticamente por resultados de <strong>Mis Partidos de liga</strong> y <strong>Liga entre equipos</strong>. Solo partidos finalizados con marcador completo. Usa «Actualizar Puntos» para añadir ajustes excepcionales.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-12 text-center">Pos</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead className="text-center">PJ</TableHead>
                <TableHead className="text-center">G</TableHead>
                <TableHead className="text-center">E</TableHead>
                <TableHead className="text-center">P</TableHead>
                <TableHead className="text-center">GF</TableHead>
                <TableHead className="text-center">GC</TableHead>
                <TableHead className="text-center">DG</TableHead>
                <TableHead className="text-center font-bold text-gray-900">PTS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fullStandings.map((row, index) => {
                const isMyTeam = row.opponentId === 'my-team';
                // En modo edición los inputs muestran el total real (auto + delta manual)
                const combined = {
                  ...row,
                  played:       row.played       + row.manualDelta.played,
                  won:          row.won           + row.manualDelta.won,
                  drawn:        row.drawn         + row.manualDelta.drawn,
                  lost:         row.lost          + row.manualDelta.lost,
                  goalsFor:     row.goalsFor      + row.manualDelta.goalsFor,
                  goalsAgainst: row.goalsAgainst  + row.manualDelta.goalsAgainst,
                  points:       row.points        + row.manualDelta.points,
                };
                const currentData = isEditing && !row.isAuto
                  ? { ...combined, ...editedStandings[row.opponentId] }
                  : row;
                const hasManualAdj = row.manualDelta.points !== 0 || row.manualDelta.played !== 0;

                return (
                  <TableRow key={row.opponentId} className={isMyTeam ? "bg-blue-50/50 hover:bg-blue-50 font-medium" : ""}>
                    <TableCell className="text-center font-bold text-gray-500">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                          {row.shieldUrl ? (
                            <img src={row.shieldUrl} alt={row.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Trophy className="h-4 w-4 text-gray-300" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            {isMyTeam && <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 uppercase text-[10px]">Tu Equipo</Badge>}
                            <span className={isMyTeam ? "text-blue-700 font-bold" : "text-gray-900"}>{row.name}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing && !row.isAuto ? (
                        <Input 
                          type="number" 
                          className="w-16 h-8 mx-auto text-center p-1" 
                          value={currentData.played}
                          onChange={(e) => handleInputChange(row.opponentId, 'played', e.target.value)}
                        />
                      ) : combined.played}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing && !row.isAuto ? (
                        <Input
                          type="number"
                          className="w-16 h-8 mx-auto text-center p-1"
                          value={currentData.won}
                          onChange={(e) => handleInputChange(row.opponentId, 'won', e.target.value)}
                        />
                      ) : combined.won}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing && !row.isAuto ? (
                        <Input
                          type="number"
                          className="w-16 h-8 mx-auto text-center p-1"
                          value={currentData.drawn}
                          onChange={(e) => handleInputChange(row.opponentId, 'drawn', e.target.value)}
                        />
                      ) : combined.drawn}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing && !row.isAuto ? (
                        <Input
                          type="number"
                          className="w-16 h-8 mx-auto text-center p-1"
                          value={currentData.lost}
                          onChange={(e) => handleInputChange(row.opponentId, 'lost', e.target.value)}
                        />
                      ) : combined.lost}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing && !row.isAuto ? (
                        <Input
                          type="number"
                          className="w-16 h-8 mx-auto text-center p-1"
                          value={currentData.goalsFor}
                          onChange={(e) => handleInputChange(row.opponentId, 'goalsFor', e.target.value)}
                        />
                      ) : combined.goalsFor}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing && !row.isAuto ? (
                        <Input
                          type="number"
                          className="w-16 h-8 mx-auto text-center p-1"
                          value={currentData.goalsAgainst}
                          onChange={(e) => handleInputChange(row.opponentId, 'goalsAgainst', e.target.value)}
                        />
                      ) : combined.goalsAgainst}
                    </TableCell>
                    <TableCell className="text-center text-gray-500">
                      {combined.goalsFor - combined.goalsAgainst}
                    </TableCell>
                    <TableCell className="text-center font-bold text-gray-900 bg-gray-50/30">
                      {isEditing && !row.isAuto ? (
                        <Input
                          type="number"
                          className="w-16 h-8 mx-auto text-center p-1 font-bold bg-white"
                          value={currentData.points}
                          onChange={(e) => handleInputChange(row.opponentId, 'points', e.target.value)}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{combined.points}</span>
                          {hasManualAdj && (
                            <span
                              className="text-[9px] text-blue-500 font-normal leading-none"
                              title={`Auto: ${row.points} pts · Ajuste manual: +${row.manualDelta.points} pts`}
                            >
                              ⊕ ajuste
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-emerald-100/50 bg-emerald-50/20 overflow-hidden mt-8 shadow-sm">
        <CardHeader className="bg-emerald-50/50 border-b border-emerald-100/50">
          <CardTitle className="text-lg flex items-center gap-2 text-emerald-800">
            <Brain className="h-5 w-5 text-emerald-600" />
            Proyección Final (IA)
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5 text-emerald-600/70">
            <TrendingUp className="h-3.5 w-3.5" />
            Estimación a partir de la clasificación actual (resultados + ajustes manuales guardados), extrapolada a {(fullStandings.length - 1) * 2} jornadas. Forma reciente desde liga entre equipos cuando aplica.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-emerald-50/30">
              <TableRow>
                <TableHead className="w-16 text-center text-emerald-700 font-semibold">Pos</TableHead>
                <TableHead className="text-emerald-700 font-semibold">Equipo</TableHead>
                <TableHead className="text-center text-emerald-700/70">PJ Est.</TableHead>
                <TableHead className="text-center text-emerald-700/70">GF Est.</TableHead>
                <TableHead className="text-center text-emerald-700/70">GC Est.</TableHead>
                <TableHead className="text-center text-emerald-700/70">DG Est.</TableHead>
                <TableHead className="text-center font-bold text-emerald-800">PTS Est.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictedStandings.map((row) => {
                const isMyTeam = row.opponentId === 'my-team';
                const confidenceClasses: Record<string, string> = {
                  alta:  'bg-emerald-100 text-emerald-700 border-emerald-200',
                  media: 'bg-amber-100 text-amber-700 border-amber-200',
                  baja:  'bg-gray-100 text-gray-500 border-gray-200',
                };

                return (
                  <TableRow key={row.opponentId} className={isMyTeam ? "bg-emerald-100/30 hover:bg-emerald-100/50 font-medium" : "hover:bg-emerald-50/30"}>
                    {/* Posición proyectada + indicador de cambio */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-bold text-emerald-600/60">{row.projectedRank}</span>
                        {row.rankChange > 0 && (
                          <span className="text-[10px] font-semibold text-emerald-600">↑{row.rankChange}</span>
                        )}
                        {row.rankChange < 0 && (
                          <span className="text-[10px] font-semibold text-red-500">↓{Math.abs(row.rankChange)}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-emerald-100">
                          {row.shieldUrl ? (
                            <img src={row.shieldUrl} alt={row.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Trophy className="h-4 w-4 text-emerald-200" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            {isMyTeam && <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 uppercase text-[10px]">Tu Equipo</Badge>}
                            <span className={isMyTeam ? "text-emerald-800 font-bold" : "text-emerald-950/80"}>{row.name}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-emerald-700/60 font-medium">
                      {row.projectedPlayed}
                    </TableCell>
                    <TableCell className="text-center text-emerald-700/60 font-medium">
                      {row.projectedGF}
                    </TableCell>
                    <TableCell className="text-center text-emerald-700/60 font-medium">
                      {row.projectedGC}
                    </TableCell>
                    <TableCell className="text-center text-emerald-700/60 font-medium">
                      {row.projectedGF - row.projectedGC}
                    </TableCell>
                    {/* Puntos proyectados + badge de confianza */}
                    <TableCell className="text-center bg-white/50">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-black text-emerald-700">{row.projectedPoints}</span>
                        <Badge
                          variant="outline"
                          className={cn('text-[9px] px-1 py-0 h-4 leading-none capitalize', confidenceClasses[row.confidence])}
                        >
                          {row.confidence}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </>
      ) : null}

      {standingsSubTab === 'group' ? (
        <LeagueGroupView
          team={team}
          opponents={opponents}
          leagueFixtures={leagueFixtures}
          globalSeasonId={globalSeasonId}
          seasons={seasons}
          seasonContextId={currentSeasonId}
          embedded
        />
      ) : null}

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[min(90vh,640px)] flex flex-col gap-0 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Auditoría de clasificación</DialogTitle>
            <DialogDescription>
              Comprueba duplicados, topes teóricos, ajustes manuales en Firestore y{' '}
              <strong>coherencia entre Mis Partidos de liga cerrados y el PJ automático de tu equipo</strong> (misma regla
              de deduplicación que la tabla). No borra partidos ni enfrentamientos.
            </DialogDescription>
          </DialogHeader>
          {auditResult ? (
            <>
              <div className="text-xs text-gray-600 space-y-1 px-1 pb-2 border-b border-gray-100 shrink-0">
                <p>
                  Participantes en tabla (aprox.):{' '}
                  <strong className="text-gray-900">{auditResult.teamCount}</strong>
                </p>
                <p>
                  PJ máx. teórico (todos contra todos, ida y vuelta):{' '}
                  <strong className="text-gray-900">{auditResult.maxPlayedPerTeam}</strong>
                </p>
                <p>
                  Duplicados:{' '}
                  <strong className="text-gray-900">{auditResult.duplicateFinishedMatchGroups}</strong>{' '}
                  en tus partidos de liga,{' '}
                  <strong className="text-gray-900">{auditResult.duplicateFinishedFixtureGroups}</strong>{' '}
                  en liga entre equipos.
                </p>
              </div>
              <div className="overflow-y-auto min-h-0 flex-1 py-3 space-y-2 pr-1">
                {auditResult.issues.map((issue, i) => (
                  <div
                    key={`${issue.code}-${i}`}
                    className={cn(
                      'text-sm rounded-lg border p-2.5',
                      issue.severity === 'error'
                        ? 'border-red-200 bg-red-50/90 text-red-950'
                        : issue.code === 'MY_TEAM_LEAGUE_ALIGNED'
                          ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
                          : 'border-amber-200 bg-amber-50/70 text-amber-950'
                    )}
                  >
                    <div className="font-medium leading-snug">{issue.message}</div>
                    {issue.detail ? (
                      <div className="text-xs mt-1.5 text-gray-700 break-words">{issue.detail}</div>
                    ) : null}
                  </div>
                ))}
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-end border-t border-gray-100 pt-3 shrink-0">
                <Button type="button" variant="outline" onClick={() => setAuditOpen(false)}>
                  Cerrar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={
                    !team || manualStandingsForSeason.length === 0 || resettingManual
                  }
                  onClick={handleResetManualStandings}
                >
                  {resettingManual ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Poner a cero ajustes manuales
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
