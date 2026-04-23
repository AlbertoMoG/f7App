import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  getDocs,
  collection, 
  query, 
  where, 
  onSnapshot,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Player, Match, PlayerStat, Attendance, Opponent, Team, Injury, Season } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Save, Trophy, Users, ShieldAlert, CheckCircle2, Stethoscope, XCircle, ShieldCheck, HelpCircle, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function MatchStats() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  
  const [match, setMatch] = useState<Match | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasonPlayerIds, setSeasonPlayerIds] = useState<string[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);

  const [localStats, setLocalStats] = useState<Record<string, Partial<PlayerStat>>>({});
  const [scoreOpponent, setScoreOpponent] = useState<number>(0);

  // We compute players to show based on season assignment OR presence in current stats
  const playersToShow = React.useMemo(() => {
    // We want to show all players assigned to this season
    // Plus any players that already have stats for this match (even if they were moved out of the season)
    return players.filter(p => {
      const isIngameSeason = seasonPlayerIds.includes(p.id);
      const hasStatsForMatch = stats.some(s => s.playerId === p.id);
      return isIngameSeason || hasStatsForMatch;
    });
  }, [players, seasonPlayerIds, stats]);

  const visiblePlayers = React.useMemo(() => {
    return playersToShow.filter(p => {
      const hasStats = stats.some(s => s.playerId === p.id);
      return p.isActive !== false || hasStats;
    });
  }, [playersToShow, stats]);

  useEffect(() => {
    if (!matchId) return;

    let unsubPlayers: (() => void) | undefined;
    let unsubStats: (() => void) | undefined;
    let unsubInjuries: (() => void) | undefined;
    let unsubPlayerSeasons: (() => void) | undefined;

    const fetchData = async () => {
      try {
        // Fetch Match
        const matchDoc = await getDoc(doc(db, 'matches', matchId));
        if (!matchDoc.exists()) {
          navigate('/matches');
          return;
        }
        const matchData = { id: matchDoc.id, ...matchDoc.data() } as Match;
        setMatch(matchData);
        setScoreOpponent(matchData.scoreOpponent || 0);

        // Fetch Season
        const seasonDoc = await getDoc(doc(db, 'seasons', matchData.seasonId));
        if (seasonDoc.exists()) {
          setSeason({ id: seasonDoc.id, ...seasonDoc.data() } as Season);
        }

        // Fetch Opponent
        const opponentDoc = await getDoc(doc(db, 'opponents', matchData.opponentId));
        if (opponentDoc.exists()) {
          setOpponent({ id: opponentDoc.id, ...opponentDoc.data() } as Opponent);
        }

        // Fetch PlayerSeasons for this season (Reactive)
        const psQuery = query(collection(db, 'playerSeasons'), where('seasonId', '==', matchData.seasonId));
        unsubPlayerSeasons = onSnapshot(psQuery, (snapshot) => {
          setSeasonPlayerIds(snapshot.docs.map(d => d.data().playerId));
        });

        // Fetch Players
        const playersQuery = query(collection(db, 'players'), where('teamId', '==', matchData.teamId));
        unsubPlayers = onSnapshot(playersQuery, (snapshot) => {
          setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
        });

        // Fetch Stats
        const statsQuery = query(collection(db, 'playerStats'), where('matchId', '==', matchId));
        unsubStats = onSnapshot(statsQuery, (snapshot) => {
          const statsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStat));
          setStats(statsData);
          
          // Initialize local stats from server
          setLocalStats(prev => {
            const next = { ...prev };
            statsData.forEach(s => {
              // If we don't have local info for this player, load from server
              // Or if we do, merge keeping local changes? 
              // Usually we want to load initial data and then let user decide.
              if (!next[s.playerId]) {
                next[s.playerId] = s;
              } else {
                // If it exists locally, we only update if it came from server and we haven't touched it?
                // For now, let's just make sure server data is available.
                next[s.playerId] = { ...s, ...next[s.playerId] };
              }
            });
            return next;
          });
        });

        // Fetch Injuries
        const injuriesQuery = query(collection(db, 'injuries'), where('teamId', '==', matchData.teamId));
        unsubInjuries = onSnapshot(injuriesQuery, (snapshot) => {
          setInjuries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Injury)));
        });

        setLoading(false);
      } catch (error) {
        console.error("Error fetching match data:", error);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      unsubPlayers?.();
      unsubStats?.();
      unsubInjuries?.();
      unsubPlayerSeasons?.();
    };
  }, [matchId, navigate]);

  // Handle team data separately to ensure it's loaded
  useEffect(() => {
    const unsubTeam = onSnapshot(collection(db, 'team'), (snapshot) => {
      if (!snapshot.empty) {
        setTeam({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Team);
      }
    });
    return () => unsubTeam();
  }, []);

  const updatePlayerStat = (playerId: string, field: keyof PlayerStat, value: any) => {
    setLocalStats(prev => {
      const current = prev[playerId] || { attendance: 'noResponse', goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
      const updated = { ...current, [field]: value };
      
      // If attendance is changed to anything other than 'attending', reset stats to 0
      if (field === 'attendance' && value !== 'attending') {
        updated.goals = 0;
        updated.assists = 0;
        updated.yellowCards = 0;
        updated.redCards = 0;
      }
      
      return {
        ...prev,
        [playerId]: updated
      };
    });
  };

  const handleSave = async (shouldFinalize: boolean = false) => {
    if (!match || !matchId) return;

    try {
      const finalStats: PlayerStat[] = visiblePlayers.map(p => {
        const existing = stats.find(s => s.playerId === p.id);
        const local = localStats[p.id] || { attendance: 'noResponse', goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
        
        let finalAttendance = (local.attendance as Attendance) || 'noResponse';
        let wasDoubtful = existing?.wasDoubtful || local.attendance === 'doubtful';
        
        if (shouldFinalize && finalAttendance === 'doubtful') {
          finalAttendance = 'notAttending';
          wasDoubtful = true;
        }

        return {
          id: existing?.id || local.id || '',
          teamId: match.teamId,
          playerId: p.id,
          matchId: matchId,
          seasonId: match.seasonId,
          attendance: finalAttendance,
          wasDoubtful,
          goals: local.goals || 0,
          assists: local.assists || 0,
          yellowCards: local.yellowCards || 0,
          redCards: local.redCards || 0,
        };
      });

      // Update Stats in Firestore
      for (const stat of finalStats) {
        if (stat.id) {
          await updateDoc(doc(db, 'playerStats', stat.id), { ...stat });
        } else {
          const { id, ...rest } = stat;
          await addDoc(collection(db, 'playerStats'), rest);
        }
      }

      // Calculate team score
      const teamScore = finalStats.reduce((acc, s) => acc + s.goals, 0);

      // Update Match
      await updateDoc(doc(db, 'matches', matchId), {
        scoreTeam: teamScore,
        scoreOpponent: scoreOpponent,
        status: shouldFinalize ? 'completed' : match.status
      });

      toast.success(shouldFinalize ? 'Partido finalizado correctamente' : 'Estadísticas guardadas correctamente');
      if (shouldFinalize) {
        navigate('/matches');
      }
    } catch (error) {
      console.error("Error saving stats:", error);
      toast.error('Error al guardar las estadísticas');
    }
  };

  if (loading || !match) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  const teamScore = visiblePlayers.reduce((acc, p) => acc + (localStats[p.id]?.goals || 0), 0);
  const attendingCount = visiblePlayers.filter(p => localStats[p.id]?.attendance === 'attending').length;
  const justifiedCount = visiblePlayers.filter(p => localStats[p.id]?.attendance === 'justified').length;
  const notAttendingCount = visiblePlayers.filter(p => localStats[p.id]?.attendance === 'notAttending').length;
  const doubtfulCount = visiblePlayers.filter(p => localStats[p.id]?.attendance === 'doubtful').length;
  const noResponseCount = visiblePlayers.filter(p => (localStats[p.id]?.attendance || 'noResponse') === 'noResponse').length;

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-20">
      <div className="max-w-screen-2xl mx-auto px-2 py-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/matches')}
          className="mb-6 hover:bg-white rounded-xl"
        >
          <ArrowLeft size={18} className="mr-2" />
          Volver a Partidos
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Match Info & Score */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-slate-950">
              <div className="bg-emerald-600 p-6 text-white text-center">
                <p className="text-emerald-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                  {match.type === 'league' ? `Liga - ${match.round}` : match.type === 'cup' ? `Copa - ${match.round}` : 'Amistoso'}
                </p>
                {season?.division && (
                  <p className="text-emerald-200 text-[9px] font-bold uppercase tracking-widest mb-2">
                    {season.division}
                  </p>
                )}
                <h2 className="text-xl font-black mb-1">
                  {format(new Date(match.date), 'dd MMMM yyyy', { locale: es })}
                </h2>
              </div>
              
              <CardContent className="p-6 space-y-8">
                {/* Scoreboard Design */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-inner">
                  <div className="flex items-center justify-between gap-4">
                    {/* Local */}
                    <div className="flex-1 flex flex-col items-center gap-3">
                      <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700 overflow-hidden shadow-lg">
                        {match.isHome !== false ? (
                          team?.shieldUrl ? <img src={team.shieldUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Trophy className="text-slate-600" size={32} />
                        ) : (
                          opponent?.shieldUrl ? <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ShieldAlert className="text-slate-600" size={32} />
                        )}
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center h-8 flex items-center">
                        {match.isHome !== false ? (team?.name || 'MI EQUIPO') : (opponent?.name || 'RIVAL')}
                      </span>
                      <div className="bg-black rounded-xl px-4 py-3 border border-slate-800 shadow-2xl min-w-[70px] text-center flex items-center justify-center">
                        {match.isHome === false ? (
                          <input 
                            type="number" 
                            value={scoreOpponent}
                            onChange={(e) => setScoreOpponent(parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent text-4xl font-mono font-black text-emerald-500 text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          <span className="text-4xl font-mono font-black text-emerald-500 tabular-nums">
                            {teamScore}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-2xl font-mono font-black text-slate-800 mt-12">:</div>

                    {/* Visitor */}
                    <div className="flex-1 flex flex-col items-center gap-3">
                      <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700 overflow-hidden shadow-lg">
                        {match.isHome !== false ? (
                          opponent?.shieldUrl ? <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ShieldAlert className="text-slate-600" size={32} />
                        ) : (
                          team?.shieldUrl ? <img src={team.shieldUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Trophy className="text-slate-600" size={32} />
                        )}
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center h-8 flex items-center">
                        {match.isHome !== false ? (opponent?.name || 'RIVAL') : (team?.name || 'MI EQUIPO')}
                      </span>
                      <div className="bg-black rounded-xl px-4 py-3 border border-slate-800 shadow-2xl min-w-[70px] text-center flex items-center justify-center">
                        {match.isHome !== false ? (
                          <input 
                            type="number" 
                            value={scoreOpponent}
                            onChange={(e) => setScoreOpponent(parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent text-4xl font-mono font-black text-emerald-500 text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          <span className="text-4xl font-mono font-black text-emerald-500 tabular-nums">
                            {teamScore}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Button 
                    onClick={() => handleSave(false)}
                    variant="outline"
                    className="w-full h-12 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-2xl font-bold transition-all"
                  >
                    <Save className="mr-2" size={18} />
                    Guardar Borrador
                  </Button>

                  {match.status !== 'completed' && (
                    <Button 
                      onClick={() => handleSave(true)}
                      className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <CheckCircle2 className="mr-2" size={20} />
                      Finalizar Partido
                    </Button>
                  )}

                  {match.status === 'completed' && (
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-center gap-2 text-emerald-700 font-bold">
                      <CheckCircle2 size={20} />
                      PARTIDO FINALIZADO
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Player Stats */}
          <div className="lg:col-span-2">
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-white border-b border-gray-50 p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Users className="text-emerald-600" size={24} />
                    <div>
                      <CardTitle className="text-2xl font-black">Estadísticas Individuales</CardTitle>
                      <CardDescription>Registra la asistencia y el desempeño de cada jugador.</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 flex items-center gap-2">
                      <CheckCircle2 className="text-emerald-600" size={18} />
                      <span className="text-emerald-900 font-bold text-sm">
                        {attendingCount} {attendingCount === 1 ? 'Jugador asiste' : 'Jugadores asisten'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {justifiedCount > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded-md border border-blue-100">{justifiedCount} Justificados</span>
                      )}
                      {doubtfulCount > 0 && (
                        <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-2 py-1 rounded-md border border-amber-100">{doubtfulCount} Duda</span>
                      )}
                      {notAttendingCount > 0 && (
                        <span className="text-[10px] font-bold text-red-600 uppercase bg-red-50 px-2 py-1 rounded-md border border-red-100">{notAttendingCount} No Asisten</span>
                      )}
                      {noResponseCount > 0 && (
                        <span className="text-[10px] font-bold text-gray-500 uppercase bg-gray-100 px-2 py-1 rounded-md border border-gray-200">{noResponseCount} Sin Respuesta</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow className="border-none">
                        <TableHead className="pl-8 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Jugador</TableHead>
                        <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Asistencia</TableHead>
                        <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">Goles</TableHead>
                        <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">Asist.</TableHead>
                        <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">Amarillas</TableHead>
                        <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center pr-8">Rojas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {['Portero', 'Defensa', 'Medio', 'Delantero'].map((pos) => {
                        const posPlayers = visiblePlayers.filter(p => p.position === pos);
                        if (posPlayers.length === 0) return null;

                        return (
                          <React.Fragment key={pos}>
                            <TableRow className="bg-gray-50/30 border-none">
                              <TableCell colSpan={6} className="py-2 pl-8">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                  {pos}s
                                </span>
                              </TableCell>
                            </TableRow>
                            {posPlayers.map((player, i) => {
                              const isInjured = injuries.some(inj => inj.playerId === player.id && !inj.endDate);
                              const attendance = localStats[player.id]?.attendance || 'noResponse';
                              
                              return (
                                <motion.tr 
                                  key={player.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.03 }}
                                  className={cn(
                                    "border-b border-gray-50 transition-all duration-300",
                                    attendance === 'attending' ? "bg-emerald-50/40 hover:bg-emerald-50/60" :
                                    attendance === 'notAttending' ? "bg-red-50/40 hover:bg-red-50/60" :
                                    attendance === 'justified' ? "bg-blue-50/40 hover:bg-blue-50/60" :
                                    attendance === 'doubtful' ? "bg-amber-50/40 hover:bg-amber-50/60" :
                                    "hover:bg-gray-50/50"
                                  )}
                                >
                                  <TableCell className="pl-8 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-colors",
                                        attendance === 'attending' ? "bg-emerald-600 text-white" :
                                        attendance === 'notAttending' ? "bg-red-600 text-white" :
                                        attendance === 'justified' ? "bg-blue-600 text-white" :
                                        attendance === 'doubtful' ? "bg-amber-600 text-white" :
                                        isInjured ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                                      )}>
                                        {isInjured && attendance !== 'attending' ? <Stethoscope size={14} /> : player.number}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className={cn(
                                            "font-bold text-sm transition-colors",
                                            attendance === 'attending' ? "text-emerald-900" :
                                            attendance === 'notAttending' ? "text-red-900" :
                                            attendance === 'justified' ? "text-blue-900" : 
                                            attendance === 'doubtful' ? "text-amber-900" : "text-gray-900"
                                          )}>
                                            {player.alias || `${player.firstName} ${player.lastName}`}
                                          </p>
                                          {isInjured && (
                                            <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shadow-sm">Lesionado</span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{player.position}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <Select 
                                      value={attendance} 
                                      onValueChange={(v) => updatePlayerStat(player.id, 'attendance', v)}
                                    >
                                      <SelectTrigger className={cn(
                                        "h-9 w-36 border-none rounded-xl text-xs font-bold shadow-sm transition-all",
                                        attendance === 'attending' ? "bg-emerald-600 text-white" :
                                        attendance === 'notAttending' ? "bg-red-600 text-white" :
                                        attendance === 'justified' ? "bg-blue-600 text-white" :
                                        attendance === 'doubtful' ? "bg-amber-600 text-white" :
                                        "bg-gray-100 text-gray-700"
                                      )}>
                                        <div className="flex items-center gap-2">
                                          {attendance === 'attending' && <CheckCircle2 size={14} />}
                                          {attendance === 'notAttending' && <XCircle size={14} />}
                                          {attendance === 'justified' && <ShieldCheck size={14} />}
                                          {attendance === 'doubtful' && <AlertCircle size={14} />}
                                          {attendance === 'noResponse' && <HelpCircle size={14} />}
                                          <SelectValue>
                                            {attendance === 'attending' ? 'Asiste' : 
                                             attendance === 'notAttending' ? 'No asiste' : 
                                             attendance === 'justified' ? 'Justificado' :
                                             attendance === 'doubtful' ? 'Duda' :
                                             'Sin rpta'}
                                          </SelectValue>
                                        </div>
                                      </SelectTrigger>
                                      <SelectContent className="rounded-xl border-none shadow-xl">
                                        <SelectItem value="attending" disabled={isInjured}>
                                          <div className="flex items-center gap-2">
                                            <CheckCircle2 size={14} className="text-emerald-500" />
                                            <span>Asiste</span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="doubtful">
                                          <div className="flex items-center gap-2">
                                            <AlertCircle size={14} className="text-amber-500" />
                                            <span>Duda</span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="notAttending">
                                          <div className="flex items-center gap-2">
                                            <XCircle size={14} className="text-red-500" />
                                            <span>No asiste</span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="justified">
                                          <div className="flex items-center gap-2">
                                            <ShieldCheck size={14} className="text-blue-500" />
                                            <span>Justificado</span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="noResponse">
                                          <div className="flex items-center gap-2">
                                            <HelpCircle size={14} className="text-gray-400" />
                                            <span>Sin rpta</span>
                                          </div>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                <TableCell className="py-4 text-center">
                                  <Input 
                                    type="number" 
                                    className={cn(
                                      "h-9 w-14 mx-auto text-center border-none rounded-xl font-bold transition-all",
                                      localStats[player.id]?.attendance === 'attending' 
                                        ? "bg-gray-100 text-gray-900" 
                                        : "bg-gray-50 text-gray-300 cursor-not-allowed"
                                    )}
                                    value={localStats[player.id]?.goals || 0}
                                    onChange={(e) => updatePlayerStat(player.id, 'goals', parseInt(e.target.value) || 0)}
                                    disabled={localStats[player.id]?.attendance !== 'attending'}
                                  />
                                </TableCell>
                                <TableCell className="py-4 text-center">
                                  <Input 
                                    type="number" 
                                    className={cn(
                                      "h-9 w-14 mx-auto text-center border-none rounded-xl font-bold transition-all",
                                      localStats[player.id]?.attendance === 'attending' 
                                        ? "bg-gray-100 text-gray-900" 
                                        : "bg-gray-50 text-gray-300 cursor-not-allowed"
                                    )}
                                    value={localStats[player.id]?.assists || 0}
                                    onChange={(e) => updatePlayerStat(player.id, 'assists', parseInt(e.target.value) || 0)}
                                    disabled={localStats[player.id]?.attendance !== 'attending'}
                                  />
                                </TableCell>
                                <TableCell className="py-4 text-center">
                                  <Input 
                                    type="number" 
                                    className={cn(
                                      "h-9 w-14 mx-auto text-center border-none rounded-xl font-bold transition-all",
                                      localStats[player.id]?.attendance === 'attending' 
                                        ? "bg-gray-100 text-gray-900" 
                                        : "bg-gray-50 text-gray-300 cursor-not-allowed"
                                    )}
                                    value={localStats[player.id]?.yellowCards || 0}
                                    onChange={(e) => updatePlayerStat(player.id, 'yellowCards', parseInt(e.target.value) || 0)}
                                    disabled={localStats[player.id]?.attendance !== 'attending'}
                                  />
                                </TableCell>
                                  <TableCell className="py-4 text-center pr-8">
                                    <Input 
                                      type="number" 
                                      className={cn(
                                        "h-9 w-14 mx-auto text-center border-none rounded-xl font-bold transition-all",
                                        localStats[player.id]?.attendance === 'attending' 
                                          ? "bg-gray-100 text-gray-900" 
                                          : "bg-gray-50 text-gray-300 cursor-not-allowed"
                                      )}
                                      value={localStats[player.id]?.redCards || 0}
                                      onChange={(e) => updatePlayerStat(player.id, 'redCards', parseInt(e.target.value) || 0)}
                                      disabled={localStats[player.id]?.attendance !== 'attending'}
                                    />
                                  </TableCell>
                                </motion.tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
