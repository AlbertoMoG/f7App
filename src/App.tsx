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
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Player, Season, Opponent, Match, PlayerStat, Lineup, Team } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PlayerList from './components/PlayerList';
import MatchList from './components/MatchList';
import LineupSimulator from './components/LineupSimulator';
import SeasonManager from './components/SeasonManager';
import TeamSettings from './components/TeamSettings';
import MatchStats from './pages/MatchStats';
import AddMatch from './pages/AddMatch';
import { Button } from '@/components/ui/button';
import { Trophy, LogIn } from 'lucide-react';

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

    return () => {
      unsubTeam();
      unsubPlayers();
      unsubSeasons();
      unsubOpponents();
      unsubMatches();
      unsubStats();
      unsubLineups();
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
    console.error(`Firestore Error [${operation}] at ${path}:`, error);
  };

  // CRUD Handlers
  const saveTeam = async (t: Omit<Team, 'id'>) => await addDoc(collection(db, 'team'), t);
  const updateTeam = async (t: Team) => await updateDoc(doc(db, 'team', t.id), { ...t });

  const addPlayer = async (p: Omit<Player, 'id'>) => await addDoc(collection(db, 'players'), p);
  const updatePlayer = async (p: Player) => await updateDoc(doc(db, 'players', p.id), { ...p });
  const deletePlayer = async (id: string) => await deleteDoc(doc(db, 'players', id));

  const addSeason = async (name: string) => await addDoc(collection(db, 'seasons'), { name });
  const deleteSeason = async (id: string) => await deleteDoc(doc(db, 'seasons', id));

  const addOpponent = async (name: string, shieldUrl?: string) => await addDoc(collection(db, 'opponents'), { name, shieldUrl: shieldUrl || null });
  const deleteOpponent = async (id: string) => await deleteDoc(doc(db, 'opponents', id));

  const addMatch = async (m: Omit<Match, 'id'>) => await addDoc(collection(db, 'matches'), m);
  const updateMatch = async (m: Match) => await updateDoc(doc(db, 'matches', m.id), { ...m });
  const deleteMatch = async (id: string) => await deleteDoc(doc(db, 'matches', id));

  const updateStats = async (newStats: PlayerStat[]) => {
    for (const stat of newStats) {
      if (stat.id) {
        await updateDoc(doc(db, 'playerStats', stat.id), { ...stat });
      } else {
        const { id, ...rest } = stat;
        await addDoc(collection(db, 'playerStats'), rest);
      }
    }
  };

  const saveLineup = async (l: Omit<Lineup, 'id'>) => await addDoc(collection(db, 'lineups'), l);
  const deleteLineup = async (id: string) => await deleteDoc(doc(db, 'lineups', id));

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
              />
            )}
            {activeTab === 'players' && (
              <PlayerList 
                players={players} 
                stats={stats}
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
                onUpdateMatch={updateMatch} 
                onDeleteMatch={deleteMatch} 
                onUpdateStats={updateStats}
              />
            )}
            {activeTab === 'simulator' && (
              <LineupSimulator 
                players={players} 
                lineups={lineups} 
                onSaveLineup={saveLineup} 
                onDeleteLineup={deleteLineup} 
              />
            )}
            {activeTab === 'seasons' && (
              <SeasonManager 
                seasons={seasons} 
                opponents={opponents} 
                onAddSeason={addSeason} 
                onAddOpponent={addOpponent} 
                onDeleteSeason={deleteSeason} 
                onDeleteOpponent={deleteOpponent} 
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
            onAddMatch={addMatch} 
          />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
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
