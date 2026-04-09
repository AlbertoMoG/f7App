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
import { Player, Season, Opponent, Match, PlayerStat, Lineup, Team, Field } from './types';
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
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Trophy, LogIn } from 'lucide-react';
import { Toaster, toast } from 'sonner';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Data State
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubTeam = onSnapshot(collection(db, 'team'), (snapshot) => {
      if (!snapshot.empty) {
        setTeam({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Team);
      } else {
        setTeam(null);
      }
    }, (err) => handleFirestoreError(err, 'list', 'team'));

    const unsubPlayers = onSnapshot(collection(db, 'players'), (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
    }, (err) => handleFirestoreError(err, 'list', 'players'));

    const unsubSeasons = onSnapshot(collection(db, 'seasons'), (snapshot) => {
      setSeasons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Season)));
    }, (err) => handleFirestoreError(err, 'list', 'seasons'));

    const unsubOpponents = onSnapshot(collection(db, 'opponents'), (snapshot) => {
      setOpponents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Opponent)));
    }, (err) => handleFirestoreError(err, 'list', 'opponents'));

    const unsubMatches = onSnapshot(collection(db, 'matches'), (snapshot) => {
      setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match)));
    }, (err) => handleFirestoreError(err, 'list', 'matches'));

    const unsubStats = onSnapshot(collection(db, 'playerStats'), (snapshot) => {
      setStats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStat)));
    }, (err) => handleFirestoreError(err, 'list', 'playerStats'));

    const unsubLineups = onSnapshot(collection(db, 'lineups'), (snapshot) => {
      setLineups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lineup)));
    }, (err) => handleFirestoreError(err, 'list', 'lineups'));

    const unsubFields = onSnapshot(collection(db, 'fields'), (snapshot) => {
      setFields(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Field)));
    }, (err) => handleFirestoreError(err, 'list', 'fields'));

    return () => {
      unsubTeam();
      unsubPlayers();
      unsubSeasons();
      unsubOpponents();
      unsubMatches();
      unsubStats();
      unsubLineups();
      unsubFields();
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

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType: operation as OperationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  // CRUD Handlers
  const saveTeam = async (t: Omit<Team, 'id'>) => {
    try {
      await addDoc(collection(db, 'team'), t);
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

  const addPlayer = async (p: Omit<Player, 'id'>) => {
    try {
      await addDoc(collection(db, 'players'), p);
      toast.success('Jugador añadido correctamente');
    } catch (error) {
      toast.error('Error al añadir jugador');
      throw error;
    }
  };

  const updatePlayer = async (p: Player) => {
    try {
      await updateDoc(doc(db, 'players', p.id), { ...p });
      toast.success('Jugador actualizado correctamente');
    } catch (error) {
      toast.error('Error al actualizar jugador');
      throw error;
    }
  };

  const deletePlayer = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'players', id));
      toast.success('Jugador eliminado');
    } catch (error) {
      toast.error('Error al eliminar jugador');
      throw error;
    }
  };

  const addSeason = async (name: string, playerIds: string[] = [], opponentIds: string[] = []) => {
    try {
      const batch = writeBatch(db);
      
      // 1. Crear la temporada
      const seasonRef = doc(collection(db, 'seasons'));
      batch.set(seasonRef, { name });
      
      // 2. Asociar jugadores seleccionados
      playerIds.forEach(playerId => {
        const playerRef = doc(db, 'players', playerId);
        batch.update(playerRef, {
          seasonIds: arrayUnion(seasonRef.id)
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

  const updateSeason = async (id: string, name: string, playerIds: string[], opponentIds: string[]) => {
    try {
      const batch = writeBatch(db);
      
      // 1. Actualizar nombre de la temporada
      const seasonRef = doc(db, 'seasons', id);
      batch.update(seasonRef, { name });
      
      // 2. Actualizar asociación de jugadores
      const playersWithSeasonQuery = query(collection(db, 'players'), where('seasonIds', 'array-contains', id));
      const playersWithSeasonSnap = await getDocs(playersWithSeasonQuery);
      
      playersWithSeasonSnap.docs.forEach(d => {
        if (!playerIds.includes(d.id)) {
          batch.update(d.ref, { seasonIds: arrayRemove(id) });
        }
      });

      playerIds.forEach(playerId => {
        const playerRef = doc(db, 'players', playerId);
        batch.update(playerRef, { seasonIds: arrayUnion(id) });
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

      // 1. Remove season from players
      const playersQuery = query(collection(db, 'players'), where('seasonIds', 'array-contains', id));
      const playersSnap = await getDocs(playersQuery);
      playersSnap.docs.forEach(d => {
        batch.update(d.ref, { seasonIds: arrayRemove(id) });
      });

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
    try {
      await addDoc(collection(db, 'opponents'), { 
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
    try {
      await addDoc(collection(db, 'fields'), { name, location: location || null });
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

  const addMatch = async (m: Omit<Match, 'id'>) => {
    try {
      await addDoc(collection(db, 'matches'), m);
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
    try {
      for (const stat of newStats) {
        if (stat.id) {
          await updateDoc(doc(db, 'playerStats', stat.id), { ...stat });
        } else {
          const { id, ...rest } = stat;
          await addDoc(collection(db, 'playerStats'), rest);
        }
      }
      toast.success('Estadísticas actualizadas');
    } catch (error) {
      toast.error('Error al actualizar estadísticas');
      throw error;
    }
  };

  const saveLineup = async (l: Omit<Lineup, 'id'>) => {
    try {
      await addDoc(collection(db, 'lineups'), l);
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
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  players={players} 
                  matches={matches} 
                  stats={stats} 
                  opponents={opponents} 
                  seasons={seasons}
                  fields={fields}
                />
              )}
              {activeTab === 'players' && (
                <PlayerList 
                  players={players} 
                  stats={stats}
                  matches={matches}
                  seasons={seasons}
                  onAddPlayer={addPlayer} 
                  onUpdatePlayer={updatePlayer} 
                  onDeletePlayer={deletePlayer} 
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
                  onUpdateMatch={updateMatch} 
                  onDeleteMatch={deleteMatch} 
                  onUpdateStats={updateStats}
                />
              )}
              {activeTab === 'simulator' && (
                <LineupSimulator 
                  players={players} 
                  lineups={lineups} 
                  matches={matches}
                  stats={stats}
                  seasons={seasons}
                  onSaveLineup={saveLineup} 
                  onDeleteLineup={deleteLineup} 
                />
              )}
              {activeTab === 'settings' && (
                <SettingsView 
                  seasons={seasons} 
                  players={players}
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
