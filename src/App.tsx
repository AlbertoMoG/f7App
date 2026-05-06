import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { auth } from './firebase';
import { SeasonFeesInput } from './types';
import { useFirestoreData } from './hooks/useFirestoreData';
import { useTeamActions } from './hooks/useTeamActions';
import { usePlayerActions } from './hooks/usePlayerActions';
import { useMatchActions } from './hooks/useMatchActions';
import { useSeasonActions } from './hooks/useSeasonActions';
import { useOpponentActions } from './hooks/useOpponentActions';
import { useFieldActions } from './hooks/useFieldActions';
import { useLineupActions } from './hooks/useLineupActions';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { AppActionsProvider, useAppActions } from './context/AppActionsContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import InteligenciaIAWorkspace from './components/InteligenciaIAWorkspace';
import StandingsView from './components/StandingsView';
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    team, players, playerSeasons, seasons, opponents,
    matches, stats, lineups, fields, injuries,
    standings, leagueFixtures,
  } = useFirestoreData(user);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const { saveTeam, updateTeam } = useTeamActions(user);
  const { addPlayer, updatePlayer, deletePlayer, addInjury, updateInjury } = usePlayerActions(team);
  const { addMatch, updateMatch, deleteMatch, updateStats, updateAttendance } = useMatchActions(team, matches);
  const { addSeason, updateSeason, deleteSeason } = useSeasonActions(team);
  const { addOpponent, updateOpponent, deleteOpponent } = useOpponentActions(team);
  const { addField, updateField, deleteField } = useFieldActions(team);
  const { saveLineup, deleteLineup } = useLineupActions(team);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

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

  const appData = {
    team, players, playerSeasons, seasons, opponents,
    matches, stats, lineups, fields, injuries,
    standings, leagueFixtures,
  };

  const appActions = {
    saveTeam, updateTeam,
    addPlayer, updatePlayer, deletePlayer, addInjury, updateInjury,
    addMatch, updateMatch, deleteMatch, updateStats, updateAttendance,
    addSeason, updateSeason, deleteSeason,
    addOpponent, updateOpponent, deleteOpponent,
    addField, updateField, deleteField,
    saveLineup, deleteLineup,
  };

  return (
    <AppDataProvider value={appData}>
    <AppActionsProvider value={appActions}>
    <NavigationProvider seasons={seasons}>
    <AppShell user={user} onLogout={handleLogout} />
    </NavigationProvider>
    </AppActionsProvider>
    </AppDataProvider>
  );
}

interface AppShellProps {
  user: User;
  onLogout: () => void;
}

function AppShell({ user, onLogout }: AppShellProps) {
  const {
    activeTab, setActiveTab,
    globalSeasonId, setGlobalSeasonId,
    selectedMatchId, setSelectedMatchId,
    navigateToMatch,
  } = useNavigation();

  const {
    team, players, playerSeasons, seasons, opponents,
    matches, stats, lineups, fields, injuries,
    standings, leagueFixtures,
  } = useAppData();

  const {
    saveTeam, updateTeam,
    addPlayer, updatePlayer, deletePlayer, addInjury, updateInjury,
    addMatch, updateMatch, deleteMatch, updateStats, updateAttendance,
    addSeason, updateSeason, deleteSeason,
    addOpponent, updateOpponent, deleteOpponent,
    addField, updateField, deleteField,
    saveLineup, deleteLineup,
  } = useAppActions();

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
              onLogout={onLogout}
              seasons={seasons}
              globalSeasonId={globalSeasonId}
              setGlobalSeasonId={setGlobalSeasonId}
            >
              {activeTab === 'dashboard' && (
                <Dashboard
                  teamId={team?.id}
                  players={players}
                  playerSeasons={playerSeasons}
                  matches={matches}
                  stats={stats}
                  opponents={opponents}
                  seasons={seasons}
                  fields={fields}
                  injuries={injuries}
                  globalSeasonId={globalSeasonId}
                  standings={standings}
                />
              )}
              {activeTab === 'inteligencia-ia' && (
                <InteligenciaIAWorkspace
                  team={team}
                  players={players}
                  playerSeasons={playerSeasons}
                  matches={matches}
                  stats={stats}
                  opponents={opponents}
                  seasons={seasons}
                  fields={fields}
                  injuries={injuries}
                  globalSeasonId={globalSeasonId}
                  standings={standings}
                  leagueFixtures={leagueFixtures}
                  onNavigateToMatch={navigateToMatch}
                />
              )}
              {activeTab === 'standings' && (
                <StandingsView
                  team={team}
                  opponents={opponents}
                  matches={matches}
                  standings={standings}
                  globalSeasonId={globalSeasonId}
                  seasons={seasons}
                  leagueFixtures={leagueFixtures}
                  onOpenMatch={navigateToMatch}
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
                  standings={standings}
                  fields={fields}
                  leagueFixtures={leagueFixtures}
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
                  playerSeasons={playerSeasons}
                  injuries={injuries}
                  globalSeasonId={globalSeasonId}
                  standings={standings}
                  onSetActiveTab={(tab, matchId) => {
                    setActiveTab(tab);
                    if (matchId) setSelectedMatchId(matchId);
                  }}
                  onUpdateMatch={updateMatch}
                  onDeleteMatch={deleteMatch}
                  onUpdateStats={updateStats}
                  initialMatchId={selectedMatchId}
                  onClearInitialMatchId={() => setSelectedMatchId(null)}
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
