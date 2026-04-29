import React, { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Info, Loader2, Trash2 } from 'lucide-react';
import { LeagueFixture, Opponent, Season, Team } from '../types';
import { collection, doc, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { buildMissingRoundRobinFixtures } from '../lib/leagueRoundRobin';
import { compareLeagueFixturesCalendarOrder, parseRoundNumber } from '../lib/leagueFixtureOrder';
import { isFinishedLeagueFixture } from '../lib/leagueStandingsAggregate';

type LeagueTableSort = 'round' | 'home-az' | 'away-az';

const SORT_LABELS: Record<LeagueTableSort, string> = {
  round: 'Jornada (calendario)',
  'home-az': 'Local (A-Z)',
  'away-az': 'Visitante (A-Z)',
};

const FIXTURE_STATUS_LABELS: Record<'scheduled' | 'completed', string> = {
  scheduled: 'Programado',
  completed: 'Finalizado',
};

interface LeagueGroupViewProps {
  team: Team | null;
  opponents: Opponent[];
  leagueFixtures: LeagueFixture[];
  globalSeasonId: string;
  seasons: Season[];
  /** Si viene de Clasificación, fija temporada aunque el filtro global sea "todas". */
  seasonContextId?: string;
  /** Oculta título propio (p. ej. dentro de subpestaña Clasificación). */
  embedded?: boolean;
}

export default function LeagueGroupView({
  team,
  opponents,
  leagueFixtures,
  globalSeasonId,
  seasons,
  seasonContextId,
  embedded = false,
}: LeagueGroupViewProps) {
  const [generating, setGenerating] = useState(false);
  const [tableSort, setTableSort] = useState<LeagueTableSort>('round');
  const [filterTeamId, setFilterTeamId] = useState<string>('');

  const currentSeasonId =
    seasonContextId ?? (globalSeasonId === 'all' ? '' : globalSeasonId);
  const currentSeason = useMemo(
    () => seasons.find((s) => s.id === currentSeasonId),
    [seasons, currentSeasonId]
  );

  const leagueOpponentIds = useMemo(() => {
    if (!currentSeasonId) return [];
    return opponents
      .filter((o) => o.seasonIds?.includes(currentSeasonId))
      .map((o) => o.id);
  }, [opponents, currentSeasonId]);

  const seasonFixtures = useMemo(() => {
    if (!currentSeasonId) return [];
    return leagueFixtures
      .filter((f) => f.seasonId === currentSeasonId)
      .sort(compareLeagueFixturesCalendarOrder);
  }, [leagueFixtures, currentSeasonId]);

  const opponentLabel = (id: string) =>
    opponents.find((o) => o.id === id)?.name ?? id;

  const filterOpponentOptions = useMemo(() => {
    const ids = new Set<string>(leagueOpponentIds);
    seasonFixtures.forEach((f) => {
      ids.add(f.homeOpponentId);
      ids.add(f.awayOpponentId);
    });
    return [...ids]
      .map((id) => ({
        id,
        label: opponents.find((o) => o.id === id)?.name ?? id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [leagueOpponentIds, seasonFixtures, opponents]);

  const filteredFixtures = useMemo(() => {
    if (!filterTeamId) return seasonFixtures;
    return seasonFixtures.filter(
      (f) => f.homeOpponentId === filterTeamId || f.awayOpponentId === filterTeamId
    );
  }, [seasonFixtures, filterTeamId]);

  const filterSummary = useMemo(() => {
    if (!filterTeamId || filteredFixtures.length === 0) return null;
    const homeN = filteredFixtures.filter((f) => f.homeOpponentId === filterTeamId).length;
    const awayN = filteredFixtures.length - homeN;
    return { total: filteredFixtures.length, homeN, awayN };
  }, [filteredFixtures, filterTeamId]);

  const teamFilterLabel = useMemo(() => {
    if (!filterTeamId) return 'Todos los equipos';
    return (
      filterOpponentOptions.find((o) => o.id === filterTeamId)?.label ??
      opponents.find((o) => o.id === filterTeamId)?.name ??
      filterTeamId
    );
  }, [filterTeamId, filterOpponentOptions, opponents]);

  const displayedFixtures = useMemo(() => {
    const copy = [...filteredFixtures];
    if (tableSort === 'round') {
      copy.sort(compareLeagueFixturesCalendarOrder);
      return copy;
    }
    if (tableSort === 'home-az') {
      copy.sort((a, b) => {
        const ha = opponentLabel(a.homeOpponentId);
        const hb = opponentLabel(b.homeOpponentId);
        const c = ha.localeCompare(hb, 'es', { sensitivity: 'base' });
        if (c !== 0) return c;
        const va = opponentLabel(a.awayOpponentId);
        const vb = opponentLabel(b.awayOpponentId);
        const c2 = va.localeCompare(vb, 'es', { sensitivity: 'base' });
        if (c2 !== 0) return c2;
        return parseRoundNumber(a.round) - parseRoundNumber(b.round);
      });
      return copy;
    }
    copy.sort((a, b) => {
      const va = opponentLabel(a.awayOpponentId);
      const vb = opponentLabel(b.awayOpponentId);
      const c = va.localeCompare(vb, 'es', { sensitivity: 'base' });
      if (c !== 0) return c;
      const ha = opponentLabel(a.homeOpponentId);
      const hb = opponentLabel(b.homeOpponentId);
      const c2 = ha.localeCompare(hb, 'es', { sensitivity: 'base' });
      if (c2 !== 0) return c2;
      return parseRoundNumber(a.round) - parseRoundNumber(b.round);
    });
    return copy;
  }, [filteredFixtures, tableSort, opponents]);

  /** Mismo criterio que la clasificación: finalizado con marcador completo. */
  const displayedFinished = useMemo(
    () => displayedFixtures.filter((f) => isFinishedLeagueFixture(f)),
    [displayedFixtures]
  );
  const displayedPending = useMemo(
    () => displayedFixtures.filter((f) => !isFinishedLeagueFixture(f)),
    [displayedFixtures]
  );

  const handleGenerate = async () => {
    if (!team || !currentSeasonId || !currentSeason) {
      toast.error('Selecciona una temporada concreta en el selector superior');
      return;
    }
    if (leagueOpponentIds.length < 2) {
      toast.error('Hacen falta al menos 2 rivales en la temporada');
      return;
    }
    setGenerating(true);
    try {
      const toAdd = buildMissingRoundRobinFixtures(
        team.id,
        currentSeasonId,
        leagueOpponentIds,
        currentSeason.startYear,
        leagueFixtures
      );
      if (toAdd.length === 0) {
        toast.info('Ya están todos los enfrentamientos ida y vuelta entre rivales');
        return;
      }
      const batch = writeBatch(db);
      for (const payload of toAdd) {
        const ref = doc(collection(db, 'leagueFixtures'));
        batch.set(ref, payload);
      }
      await batch.commit();
      toast.success(`Creados ${toAdd.length} partido(s) de liga entre equipos del grupo.`);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el calendario');
    } finally {
      setGenerating(false);
    }
  };

  const handleRoundBlur = async (f: LeagueFixture, value: string) => {
    const next = value.trim();
    if (next === (f.round ?? '').trim()) return;
    try {
      await updateDoc(doc(db, 'leagueFixtures', f.id), { round: next || null });
      toast.success('Jornada actualizada');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar');
    }
  };

  const handleStatusChange = async (f: LeagueFixture, status: 'scheduled' | 'completed') => {
    try {
      if (status === 'scheduled') {
        await updateDoc(doc(db, 'leagueFixtures', f.id), {
          status,
          scoreHome: null,
          scoreAway: null,
        });
      } else {
        const sh = f.scoreHome ?? 0;
        const sa = f.scoreAway ?? 0;
        await updateDoc(doc(db, 'leagueFixtures', f.id), {
          status: 'completed',
          scoreHome: sh,
          scoreAway: sa,
        });
      }
      toast.success('Estado actualizado');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo actualizar');
    }
  };

  const handleScoresBlur = async (
    f: LeagueFixture,
    scoreHome: number,
    scoreAway: number
  ) => {
    if (f.status !== 'completed') return;
    if (scoreHome === f.scoreHome && scoreAway === f.scoreAway) return;
    try {
      await updateDoc(doc(db, 'leagueFixtures', f.id), {
        scoreHome,
        scoreAway,
      });
      toast.success('Marcador guardado');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar el marcador');
    }
  };

  const handleDelete = async (f: LeagueFixture) => {
    if (!confirm('¿Eliminar este partido de liga entre equipos?')) return;
    try {
      await deleteDoc(doc(db, 'leagueFixtures', f.id));
      toast.success('Eliminado');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo eliminar');
    }
  };

  if (!currentSeasonId) {
    return (
      <div className="space-y-4 p-2">
        {!embedded ? <h2 className="text-2xl font-bold">Liga (grupo)</h2> : null}
        <p className="text-gray-600 text-sm">
          Elige una temporada en el selector del menú lateral para registrar resultados entre
          todos los rivales y alimentar la IA (forma del rival).
        </p>
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-4 max-w-[1200px]' : 'space-y-6 p-2 max-w-[1200px]'}>
      {!embedded ? (
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Liga (grupo)</h2>
          <p className="text-gray-500 text-sm mt-1">
            Partidos entre rivales de la temporada. Los datos alimentan predicciones y análisis de
            convocatorias (evolución del rival).
          </p>
        </div>
      ) : null}

      <Card className="rounded-2xl border-gray-200 overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Calendario entre equipos
          </CardTitle>
          <CardDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Ida y vuelta entre rivales de la temporada. La tabla se divide en finalizados y por jugar.
              Ordena o filtra por equipo. No duplica enfrentamientos ya guardados.
            </span>
            <Button
              type="button"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
              disabled={!team || leagueOpponentIds.length < 2 || generating}
              onClick={handleGenerate}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generar / completar liga
            </Button>
          </CardDescription>
          <p className="text-xs text-gray-500">
            Equipos en grupo: <strong>{leagueOpponentIds.length}</strong>
            {currentSeason ? ` · Inicio temporada ${currentSeason.startYear}` : null}
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {seasonFixtures.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No hay partidos entre equipos del grupo. Pulsa <strong>Generar / completar liga</strong>{' '}
              si ya tienes al menos dos rivales en esta temporada.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between px-4 py-3 bg-gray-50/80 border-b border-gray-100">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <label className="text-xs font-medium text-gray-600 shrink-0">Ordenar por</label>
                  <Select
                    value={tableSort}
                    onValueChange={(v) => setTableSort(v as LeagueTableSort)}
                  >
                    <SelectTrigger className="h-9 w-full sm:w-[220px] text-sm">
                      <SelectValue>{SORT_LABELS[tableSort]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round">Jornada (calendario)</SelectItem>
                      <SelectItem value="home-az">Local (A-Z)</SelectItem>
                      <SelectItem value="away-az">Visitante (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <label className="text-xs font-medium text-gray-600 shrink-0">Equipo</label>
                  <Select
                    value={filterTeamId || '__all__'}
                    onValueChange={(v) => setFilterTeamId(v === '__all__' ? '' : v)}
                  >
                    <SelectTrigger className="h-9 w-full sm:w-[260px] text-sm">
                      <SelectValue placeholder="Todos los equipos">{teamFilterLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos los equipos</SelectItem>
                      {filterOpponentOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {filterSummary ? (
                <p className="px-4 py-2 text-xs text-gray-600 bg-white border-b border-gray-100">
                  Mostrando <strong>{filterSummary.total}</strong> partido(s):{' '}
                  <strong>{filterSummary.homeN}</strong> como local,{' '}
                  <strong>{filterSummary.awayN}</strong> como visitante ·{' '}
                  <strong>{displayedFinished.length}</strong> finalizado(s),{' '}
                  <strong>{displayedPending.length}</strong> por jugar.
                </p>
              ) : null}
              {displayedFixtures.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No hay partidos que incluyan a{' '}
                  <strong>{opponentLabel(filterTeamId)}</strong>. Prueba con otro equipo o “Todos”.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <div>
                    <div className="px-4 py-2.5 bg-emerald-50/80 border-b border-emerald-100/80">
                      <h3 className="text-sm font-semibold text-emerald-900">
                        Partidos finalizados{' '}
                        <span className="font-normal text-emerald-700">({displayedFinished.length})</span>
                      </h3>
                      <p className="text-xs text-emerald-800/80 mt-0.5">
                        Estado finalizado y marcador completo (cuentan en la tabla de liga).
                      </p>
                    </div>
                    {displayedFinished.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        Ningún partido finalizado con este filtro.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            <TableHead className="min-w-[7rem]">Jornada</TableHead>
                            <TableHead>Local</TableHead>
                            <TableHead>Visitante</TableHead>
                            <TableHead className="text-center min-w-[5rem]">Resultado</TableHead>
                            <TableHead className="min-w-[8rem]">Estado</TableHead>
                            <TableHead className="w-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedFinished.map((fx) => (
                            <LeagueFixtureRow
                              key={fx.id}
                              fx={fx}
                              opponents={opponents}
                              onRoundBlur={handleRoundBlur}
                              onStatusChange={handleStatusChange}
                              onScoresSave={handleScoresBlur}
                              onDelete={handleDelete}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  <div>
                    <div className="px-4 py-2.5 bg-amber-50/80 border-b border-amber-100/80">
                      <h3 className="text-sm font-semibold text-amber-950">
                        Por jugar{' '}
                        <span className="font-normal text-amber-900/80">({displayedPending.length})</span>
                      </h3>
                      <p className="text-xs text-amber-900/70 mt-0.5">Programados; aún no cuentan en la clasificación.</p>
                    </div>
                    {displayedPending.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        No quedan partidos pendientes con este filtro.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            <TableHead className="min-w-[7rem]">Jornada</TableHead>
                            <TableHead>Local</TableHead>
                            <TableHead>Visitante</TableHead>
                            <TableHead className="text-center min-w-[5rem]">Resultado</TableHead>
                            <TableHead className="min-w-[8rem]">Estado</TableHead>
                            <TableHead className="w-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedPending.map((fx) => (
                            <LeagueFixtureRow
                              key={fx.id}
                              fx={fx}
                              opponents={opponents}
                              onRoundBlur={handleRoundBlur}
                              onStatusChange={handleStatusChange}
                              onScoresSave={handleScoresBlur}
                              onDelete={handleDelete}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeagueFixtureRow({
  fx,
  opponents,
  onRoundBlur,
  onStatusChange,
  onScoresSave,
  onDelete,
}: {
  fx: LeagueFixture;
  opponents: Opponent[];
  onRoundBlur: (f: LeagueFixture, value: string) => void;
  onStatusChange: (f: LeagueFixture, status: 'scheduled' | 'completed') => void;
  onScoresSave: (f: LeagueFixture, scoreHome: number, scoreAway: number) => void;
  onDelete: (f: LeagueFixture) => void;
}) {
  const home = opponents.find((o) => o.id === fx.homeOpponentId);
  const away = opponents.find((o) => o.id === fx.awayOpponentId);
  return (
    <TableRow>
      <TableCell>
        <Input
          className="h-8 text-sm min-w-[6.5rem]"
          defaultValue={fx.round ?? ''}
          placeholder="Ej. Jornada 3"
          onBlur={(e) => onRoundBlur(fx, e.target.value)}
        />
      </TableCell>
      <TableCell className="font-medium">{home?.name ?? fx.homeOpponentId}</TableCell>
      <TableCell className="font-medium">{away?.name ?? fx.awayOpponentId}</TableCell>
      <TableCell>
        {fx.status === 'completed' ? (
          <FixtureScorePair fixture={fx} onSave={(sh, sa) => onScoresSave(fx, sh, sa)} />
        ) : (
          <span className="text-center block text-gray-400 text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        <Select value={fx.status} onValueChange={(v) => onStatusChange(fx, v as 'scheduled' | 'completed')}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue>{FIXTURE_STATUS_LABELS[fx.status]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled">Programado</SelectItem>
            <SelectItem value="completed">Finalizado</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-600"
          title="Eliminar"
          onClick={() => onDelete(fx)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function FixtureScorePair({
  fixture,
  onSave,
}: {
  fixture: LeagueFixture;
  onSave: (sh: number, sa: number) => void;
}) {
  const [sh, setSh] = React.useState(fixture.scoreHome ?? 0);
  const [sa, setSa] = React.useState(fixture.scoreAway ?? 0);
  React.useEffect(() => {
    setSh(fixture.scoreHome ?? 0);
    setSa(fixture.scoreAway ?? 0);
  }, [fixture.id, fixture.scoreHome, fixture.scoreAway]);

  const commit = () => {
    const nh = Math.max(0, Math.min(99, sh));
    const na = Math.max(0, Math.min(99, sa));
    if (nh === (fixture.scoreHome ?? 0) && na === (fixture.scoreAway ?? 0)) return;
    onSave(nh, na);
  };

  return (
    <div className="flex items-center justify-center gap-1" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) commit();
    }}>
      <Input
        type="number"
        min={0}
        max={99}
        className="h-8 w-12 text-center text-sm px-1"
        value={sh}
        onChange={(e) => setSh(parseInt(e.target.value, 10) || 0)}
      />
      <span className="text-gray-400">-</span>
      <Input
        type="number"
        min={0}
        max={99}
        className="h-8 w-12 text-center text-sm px-1"
        value={sa}
        onChange={(e) => setSa(parseInt(e.target.value, 10) || 0)}
      />
    </div>
  );
}
