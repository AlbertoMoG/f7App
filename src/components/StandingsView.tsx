import React, { useState, useMemo } from 'react';
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
import { Trophy, Save, ListRestart, Info } from 'lucide-react';
import { Match, Opponent, StandingsEntry, Team, Season } from '../types';
import { collection, addDoc, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

interface StandingsViewProps {
  team: Team | null;
  opponents: Opponent[];
  matches: Match[];
  standings: StandingsEntry[];
  globalSeasonId: string;
  seasons: Season[];
}

interface RowData {
  opponentId: string;
  name: string;
  shieldUrl?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  isAuto: boolean;
  dbId?: string;
}

export default function StandingsView({ team, opponents, matches, standings, globalSeasonId, seasons }: StandingsViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedStandings, setEditedStandings] = useState<Record<string, Partial<StandingsEntry>>>({});

  const currentSeasonId = useMemo(() => {
    if (globalSeasonId !== 'all') return globalSeasonId;
    return seasons.length > 0 ? seasons[0].id : '';
  }, [globalSeasonId, seasons]);

  // 1. Helper para calcular stats automáticas (basado solo en partidos registrados)
  const getAutoStats = (id: string) => {
    const isMyTeam = id === 'my-team';
    const seasonMatches = matches.filter(m => 
      m.seasonId === currentSeasonId && 
      (isMyTeam ? true : m.opponentId === id) &&
      m.status === 'completed' && 
      m.type === 'league'
    );

    let played = 0;
    let won = 0;
    let drawn = 0;
    let lost = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    seasonMatches.forEach(m => {
      if (m.scoreTeam != null && m.scoreOpponent != null) {
        played++;
        const teamScore = isMyTeam ? m.scoreTeam : m.scoreOpponent;
        const oppScore = isMyTeam ? m.scoreOpponent : m.scoreTeam;
        
        goalsFor += teamScore;
        goalsAgainst += oppScore;
        
        if (teamScore > oppScore) won++;
        else if (teamScore < oppScore) lost++;
        else drawn++;
      }
    });

    return { played, won, drawn, lost, goalsFor, goalsAgainst, points: (won * 3) + drawn };
  };

  // 2. Preparar datos de la tabla (Mezclar auto y manual para todos)
  const fullStandings = useMemo(() => {
    if (!currentSeasonId) return [];

    // Stats de los rivales
    const statsList: RowData[] = opponents
      .filter(opp => {
        const isInSeason = !opp.seasonIds || opp.seasonIds.includes(currentSeasonId);
        if (!isInSeason) return false;

        const hasLeagueMatch = matches.some(m => m.opponentId === opp.id && m.seasonId === currentSeasonId && m.type === 'league');
        const hasManualEntry = standings.some(s => s.seasonId === currentSeasonId && s.opponentId === opp.id);
        
        return hasLeagueMatch || hasManualEntry;
      })
      .map(opp => {
        const entry = standings.find(s => s.seasonId === currentSeasonId && s.opponentId === opp.id);
        const auto = getAutoStats(opp.id);

        return {
          opponentId: opp.id,
          name: opp.name,
          shieldUrl: opp.shieldUrl,
          played: (entry?.played || 0) + auto.played,
          won: (entry?.won || 0) + auto.won,
          drawn: (entry?.drawn || 0) + auto.drawn,
          lost: (entry?.lost || 0) + auto.lost,
          goalsFor: (entry?.goalsFor || 0) + auto.goalsFor,
          goalsAgainst: (entry?.goalsAgainst || 0) + auto.goalsAgainst,
          points: (entry?.points || 0) + auto.points,
          isAuto: false,
          dbId: entry?.id
        };
      });

    // Stats de "Mi Equipo"
    if (team) {
      const myEntry = standings.find(s => s.seasonId === currentSeasonId && s.opponentId === 'my-team');
      const myAuto = getAutoStats('my-team');
      
      statsList.push({
        opponentId: 'my-team',
        name: team.name,
        shieldUrl: team.shieldUrl,
        played: (myEntry?.played || 0) + myAuto.played,
        won: (myEntry?.won || 0) + myAuto.won,
        drawn: (myEntry?.drawn || 0) + myAuto.drawn,
        lost: (myEntry?.lost || 0) + myAuto.lost,
        goalsFor: (myEntry?.goalsFor || 0) + myAuto.goalsFor,
        goalsAgainst: (myEntry?.goalsAgainst || 0) + myAuto.goalsAgainst,
        points: (myEntry?.points || 0) + myAuto.points,
        isAuto: false,
        dbId: myEntry?.id
      });
    }

    return statsList.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aDiff = a.goalsFor - a.goalsAgainst;
      const bDiff = b.goalsFor - b.goalsAgainst;
      if (bDiff !== aDiff) return bDiff - aDiff;
      return b.goalsFor - a.goalsFor;
    });
  }, [opponents, standings, matches, team, currentSeasonId]);

  const handleInputChange = (opponentId: string, field: keyof StandingsEntry, value: string) => {
    const numValue = parseInt(value) || 0;
    setEditedStandings(prev => {
      const currentEntry = prev[opponentId] || {};
      const updatedEntry = { ...currentEntry, [field]: numValue };

      // Si se cambia G, E o P, actualizamos automáticamente PJ y Puntos
      if (field === 'won' || field === 'drawn' || field === 'lost') {
        const entry = standings.find(s => s.seasonId === currentSeasonId && s.opponentId === opponentId);
        const auto = getAutoStats(opponentId);
        
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

  const saveChanges = async () => {
    if (!team) return;
    
    try {
      const promises = Object.entries(editedStandings).map(async ([opponentId, data]) => {
        const existingEntry = standings.find(s => s.seasonId === currentSeasonId && s.opponentId === opponentId);
        const auto = getAutoStats(opponentId);

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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clasificación</h2>
          <p className="text-gray-500">Gestión de la tabla del grupo y puntos de rivales.</p>
        </div>
        <div className="flex gap-2">
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
            <Button onClick={() => setIsEditing(true)}>
              <ListRestart className="mr-2 h-4 w-4" /> Actualizar Puntos
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-2xl border-gray-200 overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Tabla de la Liga
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Tu equipo se calcula automáticamente basado en los partidos jugados.
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
                const currentData = isEditing && !row.isAuto 
                  ? { ...row, ...editedStandings[row.opponentId] } 
                  : row;

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
                      ) : row.played}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing && !row.isAuto ? (
                        <Input 
                          type="number" 
                          className="w-16 h-8 mx-auto text-center p-1" 
                          value={currentData.won}
                          onChange={(e) => handleInputChange(row.opponentId, 'won', e.target.value)}
                        />
                      ) : row.won}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing && !row.isAuto ? (
                        <Input 
                          type="number" 
                          className="w-16 h-8 mx-auto text-center p-1" 
                          value={currentData.drawn}
                          onChange={(e) => handleInputChange(row.opponentId, 'drawn', e.target.value)}
                        />
                      ) : row.drawn}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing && !row.isAuto ? (
                        <Input 
                          type="number" 
                          className="w-16 h-8 mx-auto text-center p-1" 
                          value={currentData.lost}
                          onChange={(e) => handleInputChange(row.opponentId, 'lost', e.target.value)}
                        />
                      ) : row.lost}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing && !row.isAuto ? (
                        <Input 
                          type="number" 
                          className="w-16 h-8 mx-auto text-center p-1" 
                          value={currentData.goalsFor}
                          onChange={(e) => handleInputChange(row.opponentId, 'goalsFor', e.target.value)}
                        />
                      ) : row.goalsFor}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing && !row.isAuto ? (
                        <Input 
                          type="number" 
                          className="w-16 h-8 mx-auto text-center p-1" 
                          value={currentData.goalsAgainst}
                          onChange={(e) => handleInputChange(row.opponentId, 'goalsAgainst', e.target.value)}
                        />
                      ) : row.goalsAgainst}
                    </TableCell>
                    <TableCell className="text-center text-gray-500">
                      {currentData.goalsFor - currentData.goalsAgainst}
                    </TableCell>
                    <TableCell className="text-center font-bold text-gray-900 bg-gray-50/30">
                      {isEditing && !row.isAuto ? (
                        <Input 
                          type="number" 
                          className="w-16 h-8 mx-auto text-center p-1 font-bold bg-white" 
                          value={currentData.points}
                          onChange={(e) => handleInputChange(row.opponentId, 'points', e.target.value)}
                        />
                      ) : row.points}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
