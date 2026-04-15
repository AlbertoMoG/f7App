import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Player, Season, Opponent, Match, PlayerStat, Lineup, Team, Field, PlayerSeason, Injury, SeasonFeesInput } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PlayerList from './components/PlayerList';
import MatchList from './components/MatchList';
import LineupSimulator from './components/LineupSimulator';
import SettingsView from './components/SettingsView';
import TeamSettings from './components/TeamSettings';
import MatchStats from './pages/MatchStats';
import AddMatch from './pages/AddMatch';
import PlayerProfile from './pages/PlayerProfile';
import Treasury from './pages/Treasury';
import SeasonForm from './pages/SeasonForm';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Trophy, LogIn } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { handleFirestoreError, OperationType, FirestoreErrorInfo } from './lib/firestoreUtils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [globalSeasonId, setGlobalSeasonId] = useState<string>('all');

  // Data State
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerSeasons, setPlayerSeasons] = useState<PlayerSeason[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    let unsubPlayers: any;
    let unsubSeasons: any;
    let unsubOpponents: any;
    let unsubMatches: any;
    let unsubStats: any;
    let unsubLineups: any;
    let unsubFields: any;
    let unsubPlayerSeasons: any;
    let unsubInjuries: any;

    const unsubTeam = onSnapshot(query(collection(db, 'team'), where('ownerId', '==', user.uid)), async (snapshot) => {
      if (!snapshot.empty) {
        const currentTeam = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Team;
        setTeam(currentTeam);
        
        // Setup listeners for this team
        unsubPlayers = onSnapshot(query(collection(db, 'players'), where('teamId', '==', currentTeam.id)), (snap) => {
          setPlayers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'players'));

        unsubSeasons = onSnapshot(query(collection(db, 'seasons'), where('teamId', '==', currentTeam.id)), (snap) => {
          setSeasons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Season)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'seasons'));

        unsubOpponents = onSnapshot(query(collection(db, 'opponents'), where('teamId', '==', currentTeam.id)), (snap) => {
          setOpponents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Opponent)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'opponents'));

        unsubMatches = onSnapshot(query(collection(db, 'matches'), where('teamId', '==', currentTeam.id)), (snap) => {
          setMatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'matches'));

        unsubStats = onSnapshot(query(collection(db, 'playerStats'), where('teamId', '==', currentTeam.id)), (snap) => {
          setStats(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStat)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'playerStats'));

        unsubLineups = onSnapshot(query(collection(db, 'lineups'), where('teamId', '==', currentTeam.id)), (snap) => {
          setLineups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lineup)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'lineups'));

        unsubFields = onSnapshot(query(collection(db, 'fields'), where('teamId', '==', currentTeam.id)), (snap) => {
          setFields(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Field)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'fields'));

        unsubPlayerSeasons = onSnapshot(query(collection(db, 'playerSeasons'), where('teamId', '==', currentTeam.id)), (snap) => {
          setPlayerSeasons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerSeason)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'playerSeasons'));

        unsubInjuries = onSnapshot(query(collection(db, 'injuries'), where('teamId', '==', currentTeam.id)), (snap) => {
          setInjuries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Injury)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'injuries'));

      } else {
        // Create default team and run migration
        try {
          const newTeamRef = await addDoc(collection(db, 'team'), { name: 'Mi Equipo Principal', ownerId: user.uid });
          const newTeamId = newTeamRef.id;
          
          // Run migration for all existing data without teamId
          const batch = writeBatch(db);
          
          // Fetch all existing records
          const collectionsToMigrate = ['players', 'seasons', 'opponents', 'matches', 'playerStats', 'lineups', 'fields'];
          
          for (const collName of collectionsToMigrate) {
            const snap = await getDocs(collection(db, collName));
            snap.docs.forEach(docSnap => {
              if (!docSnap.data().teamId) {
                batch.update(docSnap.ref, { teamId: newTeamId });
              }
            });
          }

          // Migrate seasonIds to playerSeasons
          const playersSnap = await getDocs(collection(db, 'players'));
          playersSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.seasonIds && Array.isArray(data.seasonIds)) {
              data.seasonIds.forEach((seasonId: string) => {
                const psRef = doc(collection(db, 'playerSeasons'));
                batch.set(psRef, {
                  teamId: newTeamId,
                  playerId: docSnap.id,
                  seasonId: seasonId
                });
              });
            }
          });

          await batch.commit();
          toast.success('Datos migrados a tu nuevo equipo correctamente');
        } catch (err) {
          console.error("Migration error:", err);
          toast.error("Error al crear el equipo por defecto");
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'team'));

    return () => {
      unsubTeam();
      if (unsubPlayers) unsubPlayers();
      if (unsubSeasons) unsubSeasons();
      if (unsubOpponents) unsubOpponents();
      if (unsubMatches) unsubMatches();
      if (unsubStats) unsubStats();
      if (unsubLineups) unsubLineups();
      if (unsubFields) unsubFields();
      if (unsubPlayerSeasons) unsubPlayerSeasons();
      if (unsubInjuries) unsubInjuries();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  // CRUD Handlers
  const saveTeam = async (t: Omit<Team, 'id' | 'ownerId'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'team'), { ...t, ownerId: user.uid });
      toast.success('Equipo configurado correctamente');
    } catch (error) {
      toast.error('Error al guardar el equipo');
      throw error;
    }
  };

  const updateTeam = async (t: Team) => {
    try {
      await updateDoc(doc(db, 'team', t.id), { ...t });
      toast.success('Ajustes del equipo actualizados');
    } catch (error) {
      toast.error('Error al actualizar el equipo');
      throw error;
    }
  };

  const addPlayer = async (p: Omit<Player, 'id' | 'teamId'> & { seasonIds?: string[] }) => {
    if (!team) return;
    try {
      const { seasonIds, ...playerData } = p;
      const batch = writeBatch(db);
      
      const playerRef = doc(collection(db, 'players'));
      batch.set(playerRef, { ...playerData, teamId: team.id });
      
      if (seasonIds && seasonIds.length > 0) {
        seasonIds.forEach(seasonId => {
          const psRef = doc(collection(db, 'playerSeasons'));
          batch.set(psRef, {
            teamId: team.id,
            playerId: playerRef.id,
            seasonId
          });
        });
      }
      
      await batch.commit();
      toast.success('Jugador añadido correctamente');
    } catch (error) {
      toast.error('Error al añadir jugador');
      throw error;
    }
  };

  const updatePlayer = async (p: Player, seasonIds: string[]) => {
    if (!team) return;
    try {
      const batch = writeBatch(db);
      
      // 1. Update player data
      batch.update(doc(db, 'players', p.id), { ...p });
      
      // 2. Update player seasons
      const psQuery = query(collection(db, 'playerSeasons'), where('playerId', '==', p.id));
      const psSnap = await getDocs(psQuery);
      
      const existingSeasonIds = psSnap.docs.map(d => d.data().seasonId);
      
      // Remove unselected seasons
      psSnap.docs.forEach(d => {
        if (!seasonIds.includes(d.data().seasonId)) {
          batch.delete(d.ref);
        }
      });
      
      // Add new selected seasons
      seasonIds.forEach(seasonId => {
        if (!existingSeasonIds.includes(seasonId)) {
          const psRef = doc(collection(db, 'playerSeasons'));
          batch.set(psRef, {
            teamId: team.id,
            playerId: p.id,
            seasonId
          });
        }
      });
      
      await batch.commit();
      toast.success('Jugador actualizado correctamente');
    } catch (error) {
      toast.error('Error al actualizar jugador');
      throw error;
    }
  };

  const deletePlayer = async (id: string) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'players', id));
      
      // Delete associated playerSeasons
      const psQuery = query(collection(db, 'playerSeasons'), where('playerId', '==', id));
      const psSnap = await getDocs(psQuery);
      psSnap.docs.forEach(d => batch.delete(d.ref));

      await batch.commit();
      toast.success('Jugador eliminado');
    } catch (error) {
      toast.error('Error al eliminar jugador');
      throw error;
    }
  };

  const addSeason = async (name: string, division: string = '', playerIds: string[] = [], opponentIds: string[] = []) => {
    if (!team) return;
    try {
      const batch = writeBatch(db);
      
      // 1. Crear la temporada
      const seasonRef = doc(collection(db, 'seasons'));
      batch.set(seasonRef, { name, division, teamId: team.id });
      
      // 2. Asociar jugadores seleccionados (PlayerSeason)
      playerIds.forEach(playerId => {
        const psRef = doc(collection(db, 'playerSeasons'));
        batch.set(psRef, {
          teamId: team.id,
          playerId,
          seasonId: seasonRef.id
        });
      });

      // 3. Asociar rivales seleccionados
      opponentIds.forEach(opponentId => {
        const opponentRef = doc(db, 'opponents', opponentId);
        batch.update(opponentRef, {
          seasonIds: arrayUnion(seasonRef.id)
        });
      });
      
      await batch.commit();
      toast.success('Temporada creada y asociaciones guardadas');
    } catch (error) {
      console.error("Error creating season:", error);
      toast.error('Error al crear temporada');
      throw error;
    }
  };

  const updateSeason = async (id: string, name: string, division: string, playerIds: string[], opponentIds: string[]) => {
    if (!team) return;
    try {
      const batch = writeBatch(db);
      
      // 1. Actualizar nombre de la temporada
      const seasonRef = doc(db, 'seasons', id);
      batch.update(seasonRef, { name, division });
      
      // 2. Actualizar asociación de jugadores (PlayerSeason)
      const psQuery = query(collection(db, 'playerSeasons'), where('seasonId', '==', id));
      const psSnap = await getDocs(psQuery);
      
      const existingPlayerIds = psSnap.docs.map(d => d.data().playerId);
      
      // Remove unselected players
      psSnap.docs.forEach(d => {
        if (!playerIds.includes(d.data().playerId)) {
          batch.delete(d.ref);
        }
      });

      // Add new selected players
      playerIds.forEach(playerId => {
        if (!existingPlayerIds.includes(playerId)) {
          const psRef = doc(collection(db, 'playerSeasons'));
          batch.set(psRef, {
            teamId: team.id,
            playerId,
            seasonId: id
          });
        }
      });

      // 3. Actualizar asociación de rivales
      const opponentsWithSeasonQuery = query(collection(db, 'opponents'), where('seasonIds', 'array-contains', id));
      const opponentsWithSeasonSnap = await getDocs(opponentsWithSeasonQuery);
      
      opponentsWithSeasonSnap.docs.forEach(d => {
        if (!opponentIds.includes(d.id)) {
          batch.update(d.ref, { seasonIds: arrayRemove(id) });
        }
      });

      opponentIds.forEach(opponentId => {
        const opponentRef = doc(db, 'opponents', opponentId);
        batch.update(opponentRef, { seasonIds: arrayUnion(id) });
      });
      
      await batch.commit();
      toast.success('Temporada actualizada correctamente');
    } catch (error) {
      console.error("Error updating season:", error);
      toast.error('Error al actualizar temporada');
      throw error;
    }
  };

  const deleteSeason = async (id: string) => {
    try {
      const batch = writeBatch(db);

      // 1. Remove season from playerSeasons
      const psQuery = query(collection(db, 'playerSeasons'), where('seasonId', '==', id));
      const psSnap = await getDocs(psQuery);
      psSnap.docs.forEach(d => batch.delete(d.ref));

      // 2. Remove season from opponents
      const opponentsQuery = query(collection(db, 'opponents'), where('seasonIds', 'array-contains', id));
      const opponentsSnap = await getDocs(opponentsQuery);
      opponentsSnap.docs.forEach(d => {
        batch.update(d.ref, { seasonIds: arrayRemove(id) });
      });

      // 3. Delete matches of this season
      const matchesQuery = query(collection(db, 'matches'), where('seasonId', '==', id));
      const matchesSnap = await getDocs(matchesQuery);
      const matchIds = matchesSnap.docs.map(d => d.id);
      matchesSnap.docs.forEach(d => {
        batch.delete(d.ref);
      });

      // 4. Delete playerStats of this season
      const statsQuery = query(collection(db, 'playerStats'), where('seasonId', '==', id));
      const statsSnap = await getDocs(statsQuery);
      statsSnap.docs.forEach(d => {
        batch.delete(d.ref);
      });

      // 5. Delete lineups associated with these matches
      if (matchIds.length > 0) {
        const chunkArray = (arr: string[], size: number) => {
          return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
            arr.slice(i * size, i * size + size)
          );
        };
        const matchIdChunks = chunkArray(matchIds, 10);
        for (const chunk of matchIdChunks) {
          const lineupsQuery = query(collection(db, 'lineups'), where('matchId', 'in', chunk));
          const lineupsSnap = await getDocs(lineupsQuery);
          lineupsSnap.docs.forEach(d => {
            batch.delete(d.ref);
          });
        }
      }

      // 6. Delete the season itself
      batch.delete(doc(db, 'seasons', id));

      await batch.commit();
      toast.success('Temporada y todos sus datos asociados eliminados');
    } catch (error) {
      console.error("Error deleting season:", error);
      toast.error('Error al eliminar temporada');
      throw error;
    }
  };

  const addOpponent = async (name: string, shieldUrl?: string, seasonIds: string[] = []) => {
    if (!team) return;
    try {
      await addDoc(collection(db, 'opponents'), { 
        teamId: team.id,
        name, 
        shieldUrl: shieldUrl || null,
        seasonIds: seasonIds.length > 0 ? seasonIds : []
      });
      toast.success('Rival añadido');
    } catch (error) {
      toast.error('Error al añadir rival');
      throw error;
    }
  };

  const updateOpponent = async (id: string, name: string, shieldUrl?: string, seasonIds: string[] = []) => {
    try {
      await updateDoc(doc(db, 'opponents', id), { 
        name, 
        shieldUrl: shieldUrl || null,
        seasonIds: seasonIds.length > 0 ? seasonIds : []
      });
      toast.success('Rival actualizado');
    } catch (error) {
      toast.error('Error al actualizar rival');
      throw error;
    }
  };

  const deleteOpponent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'opponents', id));
      toast.success('Rival eliminado');
    } catch (error) {
      toast.error('Error al eliminar rival');
      throw error;
    }
  };

  const addField = async (name: string, location?: string) => {
    if (!team) return;
    try {
      await addDoc(collection(db, 'fields'), { teamId: team.id, name, location: location || null });
      toast.success('Campo añadido');
    } catch (error) {
      toast.error('Error al añadir campo');
      throw error;
    }
  };

  const updateField = async (id: string, name: string, location?: string) => {
    try {
      await updateDoc(doc(db, 'fields', id), { name, location: location || null });
      toast.success('Campo actualizado');
    } catch (error) {
      toast.error('Error al actualizar campo');
      throw error;
    }
  };

  const deleteField = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'fields', id));
      toast.success('Campo eliminado');
    } catch (error) {
      toast.error('Error al eliminar campo');
      throw error;
    }
  };

  const addMatch = async (m: Omit<Match, 'id' | 'teamId'>) => {
    if (!team) return;
    try {
      await addDoc(collection(db, 'matches'), { ...m, teamId: team.id });
      toast.success('Partido programado');
    } catch (error) {
      toast.error('Error al programar partido');
      throw error;
    }
  };

  const updateMatch = async (m: Match) => {
    try {
      await updateDoc(doc(db, 'matches', m.id), { ...m });
      toast.success('Partido actualizado');
    } catch (error) {
      toast.error('Error al actualizar partido');
      throw error;
    }
  };

  const deleteMatch = async (id: string) => {
    try {
      // 1. Eliminar físicamente las estadísticas de los jugadores asociadas a este partido
      const statsQuery = query(collection(db, 'playerStats'), where('matchId', '==', id));
      const statsSnapshot = await getDocs(statsQuery);
      
      const batch = writeBatch(db);
      statsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // 2. Eliminar el partido
      batch.delete(doc(db, 'matches', id));
      
      await batch.commit();
      toast.success('Partido y sus estadísticas eliminados correctamente');
    } catch (error) {
      console.error("Error deleting match and stats:", error);
      toast.error('Error al eliminar el partido y sus datos');
      throw error;
    }
  };

  const updateStats = async (newStats: PlayerStat[]) => {
    if (!team) return;
    try {
      for (const stat of newStats) {
        if (stat.id) {
          await updateDoc(doc(db, 'playerStats', stat.id), { ...stat });
        } else {
          const { id, ...rest } = stat;
          await addDoc(collection(db, 'playerStats'), { ...rest, teamId: team.id });
        }
      }
      toast.success('Estadísticas actualizadas');
    } catch (error) {
      toast.error('Error al actualizar estadísticas');
      throw error;
    }
  };

  const updateAttendance = async (playerId: string, matchId: string, attendance: string) => {
    if (!team) return;
    try {
      const q = query(
        collection(db, 'playerStats'), 
        where('teamId', '==', team.id),
        where('playerId', '==', playerId),
        where('matchId', '==', matchId)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { attendance });
      } else {
        const match = matches.find(m => m.id === matchId);
        await addDoc(collection(db, 'playerStats'), {
          teamId: team.id,
          playerId,
          matchId,
          seasonId: match?.seasonId || globalSeasonId,
          attendance,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0
        });
      }
      toast.success('Asistencia actualizada');
    } catch (error) {
      toast.error('Error al actualizar asistencia');
      throw error;
    }
  };

  const saveLineup = async (l: Omit<Lineup, 'id' | 'teamId'>) => {
    if (!team) return;
    try {
      await addDoc(collection(db, 'lineups'), { ...l, teamId: team.id });
      toast.success('Alineación guardada');
    } catch (error) {
      toast.error('Error al guardar alineación');
      throw error;
    }
  };

  const deleteLineup = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'lineups', id));
      toast.success('Alineación eliminada');
    } catch (error) {
      toast.error('Error al eliminar alineación');
      throw error;
    }
  };

  const addInjury = async (injury: Omit<Injury, 'id' | 'teamId'>) => {
    if (!team) return;
    try {
      await addDoc(collection(db, 'injuries'), { ...injury, teamId: team.id });
      toast.success('Lesión registrada');
    } catch (error) {
      toast.error('Error al registrar lesión');
      throw error;
    }
  };

  const updateInjury = async (injury: Injury) => {
    try {
      await updateDoc(doc(db, 'injuries', injury.id), { ...injury });
      toast.success('Lesión actualizada');
    } catch (error) {
      toast.error('Error al actualizar lesión');
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl overflow-hidden">
          <div className="bg-emerald-600 p-8 text-white text-center">
            <Trophy size={48} className="mx-auto mb-4" />
            <h1 className="text-3xl font-bold tracking-tight">Fútbol 7 Manager</h1>
            <p className="text-emerald-100 mt-2">Gestiona tu equipo como un profesional.</p>
          </div>
          <CardContent className="p-8 bg-white text-center space-y-6">
            <p className="text-gray-500">Inicia sesión para acceder a la gestión de tu plantilla, partidos y estadísticas.</p>
            <Button 
              onClick={handleLogin} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              Entrar con Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Toaster position="top-center" richColors />
      <Router>
        <Routes>
          <Route path="/" element={
            <Layout 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              user={user} 
              team={team}
              onLogout={handleLogout}
              seasons={seasons}
              globalSeasonId={globalSeasonId}
              setGlobalSeasonId={setGlobalSeasonId}
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  players={players} 
                  playerSeasons={playerSeasons}
                  matches={matches} 
                  stats={stats} 
                  opponents={opponents} 
                  seasons={seasons}
                  fields={fields}
                  injuries={injuries}
                  globalSeasonId={globalSeasonId}
                />
              )}
              {activeTab === 'players' && (
                <PlayerList 
                  players={players} 
                  playerSeasons={playerSeasons}
                  stats={stats}
                  matches={matches}
                  seasons={seasons}
                  injuries={injuries}
                  opponents={opponents}
                  globalSeasonId={globalSeasonId}
                  onAddPlayer={addPlayer} 
                  onUpdatePlayer={updatePlayer} 
                  onDeletePlayer={deletePlayer}
                  onAddInjury={addInjury}
                  onUpdateInjury={updateInjury}
                  onUpdateAttendance={updateAttendance}
                />
              )}
              {activeTab === 'matches' && (
                <MatchList 
                  team={team}
                  players={players} 
                  matches={matches} 
                  stats={stats} 
                  seasons={seasons} 
                  opponents={opponents} 
                  fields={fields}
                  lineups={lineups}
                  injuries={injuries}
                  globalSeasonId={globalSeasonId}
                  onSetActiveTab={(tab, matchId) => {
                    setActiveTab(tab);
                    if (matchId) setSelectedMatchId(matchId);
                  }}
                  onUpdateMatch={updateMatch} 
                  onDeleteMatch={deleteMatch} 
                  onUpdateStats={updateStats}
                />
              )}
              {activeTab === 'simulator' && (
                <LineupSimulator 
                  players={players} 
                  playerSeasons={playerSeasons}
                  lineups={lineups} 
                  matches={matches}
                  stats={stats}
                  seasons={seasons}
                  injuries={injuries}
                  globalSeasonId={globalSeasonId}
                  initialMatchId={selectedMatchId}
                  onClearInitialMatchId={() => setSelectedMatchId(null)}
                  onSaveLineup={saveLineup} 
                  onDeleteLineup={deleteLineup} 
                />
              )}
              {activeTab === 'treasury' && (
                <Treasury teamId={team?.id || ''} />
              )}
              {activeTab === 'settings' && (
                <SettingsView 
                  seasons={seasons} 
                  players={players}
                  playerSeasons={playerSeasons}
                  opponents={opponents} 
                  matches={matches}
                  fields={fields}
                  team={team}
                  onAddSeason={addSeason} 
                  onUpdateSeason={updateSeason}
                  onDeleteSeason={deleteSeason} 
                  onAddOpponent={addOpponent} 
                  onUpdateOpponent={updateOpponent}
                  onDeleteOpponent={deleteOpponent} 
                  onAddField={addField}
                  onUpdateField={updateField}
                  onDeleteField={deleteField}
                />
              )}
              {activeTab === 'team' && (
                <TeamSettings 
                  team={team}
                  onSaveTeam={saveTeam}
                  onUpdateTeam={updateTeam}
                />
              )}
            </Layout>
          } />
          <Route path="/matches/:matchId/stats" element={<MatchStats />} />
          <Route path="/matches/new" element={
            <AddMatch 
              seasons={seasons} 
              opponents={opponents} 
              fields={fields}
              onAddMatch={addMatch} 
            />
          } />
          <Route path="/matches/:matchId/edit" element={
            <AddMatch 
              seasons={seasons} 
              opponents={opponents} 
              fields={fields}
              matches={matches}
              onUpdateMatch={updateMatch} 
            />
          } />
          <Route path="/players/:playerId" element={<PlayerProfile />} />
          <Route path="/seasons/new" element={
            <SeasonForm 
              teamId={team?.id || ''}
              seasons={seasons} 
              players={players} 
              playerSeasons={playerSeasons}
              opponents={opponents} 
              onAddSeason={addSeason} 
              onUpdateSeason={updateSeason}
            />
          } />
          <Route path="/seasons/:seasonId/edit" element={
            <SeasonForm 
              teamId={team?.id || ''}
              seasons={seasons} 
              players={players} 
              playerSeasons={playerSeasons}
              opponents={opponents} 
              onAddSeason={addSeason} 
              onUpdateSeason={updateSeason}
            />
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </TooltipProvider>
  );
}

function Card({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn("bg-white rounded-xl shadow-sm", className)}>{children}</div>;
}

function CardContent({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
