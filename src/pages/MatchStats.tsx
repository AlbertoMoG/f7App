import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Player, Match, PlayerStat, Attendance, Opponent, Team } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ArrowLeft, Save, Trophy, Users, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function MatchStats() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  const [localStats, setLocalStats] = useState<Record<string, Partial<PlayerStat>>>({});
  const [scoreOpponent, setScoreOpponent] = useState<number>(0);

  useEffect(() => {
    if (!matchId) return;

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

        // Fetch Opponent
        const opponentDoc = await getDoc(doc(db, 'opponents', matchData.opponentId));
        if (opponentDoc.exists()) {
          setOpponent({ id: opponentDoc.id, ...opponentDoc.data() } as Opponent);
        }

        // Fetch Team
        const teamSnap = await getDoc(doc(db, 'team', 'main')); // Assuming 'main' or similar
        // If not found, we'll try to list and get the first one
        if (!teamSnap.exists()) {
           const teamColl = await getDoc(doc(db, 'team', 'main')); // This is just a placeholder
        }

        // Fetch Players
        const playersUnsub = onSnapshot(collection(db, 'players'), (snapshot) => {
          const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
          setPlayers(playersData);
        });

        // Fetch Stats
        const statsQuery = query(collection(db, 'playerStats'), where('matchId', '==', matchId));
        const statsUnsub = onSnapshot(statsQuery, (snapshot) => {
          const statsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStat));
          setStats(statsData);
          
          // Initialize local stats
          const initialLocalStats: Record<string, Partial<PlayerStat>> = {};
          snapshot.docs.forEach(doc => {
            const s = doc.data() as PlayerStat;
            initialLocalStats[s.playerId] = { id: doc.id, ...s };
          });
          setLocalStats(prev => ({ ...initialLocalStats, ...prev }));
        });

        setLoading(false);
      } catch (error) {
        console.error("Error fetching match data:", error);
        setLoading(false);
      }
    };

    fetchData();
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

  const handleSave = async () => {
    if (!match || !matchId) return;

    try {
      const finalStats: PlayerStat[] = players.map(p => {
        const existing = stats.find(s => s.playerId === p.id);
        const local = localStats[p.id] || { attendance: 'noResponse', goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
        
        return {
          id: existing?.id || local.id || '',
          playerId: p.id,
          matchId: matchId,
          seasonId: match.seasonId,
          attendance: (local.attendance as Attendance) || 'noResponse',
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
        status: 'completed'
      });

      navigate('/matches');
    } catch (error) {
      console.error("Error saving stats:", error);
    }
  };

  if (loading || !match) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  const teamScore = players.reduce((acc, p) => acc + (localStats[p.id]?.goals || 0), 0);
  const attendingCount = players.filter(p => localStats[p.id]?.attendance === 'attending').length;

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
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
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
              <div className="bg-emerald-600 p-8 text-white text-center">
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-2">
                  {match.type === 'league' ? `Liga - ${match.round}` : match.type === 'cup' ? `Copa - ${match.round}` : 'Amistoso'}
                </p>
                <h2 className="text-2xl font-black mb-1">
                  {format(new Date(match.date), 'dd MMMM yyyy', { locale: es })}
                </h2>
                <p className="text-emerald-100 text-sm">
                  {format(new Date(match.date), 'HH:mm')}
                </p>
              </div>
              <CardContent className="p-8 space-y-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-center flex-1">
                    <div className="w-16 h-16 mx-auto mb-3 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 overflow-hidden">
                      {match.isHome !== false ? (
                        team?.shieldUrl ? <img src={team.shieldUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Trophy className="text-gray-300" />
                      ) : (
                        opponent?.shieldUrl ? <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ShieldAlert className="text-gray-300" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Local</p>
                    <p className="font-black text-sm truncate">
                      {match.isHome !== false ? 'MI EQUIPO' : (opponent?.name || 'RIVAL')}
                    </p>
                    <div className="mt-4 text-5xl font-black text-emerald-600">
                      {match.isHome !== false ? teamScore : scoreOpponent}
                    </div>
                  </div>

                  <div className="text-2xl font-black text-gray-200">VS</div>

                  <div className="text-center flex-1">
                    <div className="w-16 h-16 mx-auto mb-3 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 overflow-hidden">
                      {match.isHome !== false ? (
                        opponent?.shieldUrl ? <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ShieldAlert className="text-gray-300" />
                      ) : (
                        team?.shieldUrl ? <img src={team.shieldUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Trophy className="text-gray-300" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Visitante</p>
                    <p className="font-black text-sm truncate">
                      {match.isHome !== false ? (opponent?.name || 'RIVAL') : 'MI EQUIPO'}
                    </p>
                    <div className="mt-4 text-5xl font-black text-emerald-600">
                      {match.isHome !== false ? scoreOpponent : teamScore}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <Label className="text-xs font-bold text-gray-400 uppercase mb-3 block">Goles del Rival</Label>
                  <Input 
                    type="number" 
                    value={scoreOpponent}
                    onChange={(e) => setScoreOpponent(parseInt(e.target.value) || 0)}
                    className="h-14 text-2xl font-black text-center rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <Button 
                  onClick={handleSave}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Save className="mr-2" size={20} />
                  Guardar Estadísticas
                </Button>
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
                  <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-600" size={18} />
                    <span className="text-emerald-900 font-bold text-sm">
                      {attendingCount} {attendingCount === 1 ? 'Jugador asiste' : 'Jugadores asisten'}
                    </span>
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
                      {players.map((player, i) => (
                        <motion.tr 
                          key={player.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                        >
                          <TableCell className="pl-8 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">
                                {player.number}
                              </div>
                              <div>
                                <p className="font-bold text-sm">{player.firstName} {player.lastName}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">{player.position}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <Select 
                              value={localStats[player.id]?.attendance || 'noResponse'} 
                              onValueChange={(v) => updatePlayerStat(player.id, 'attendance', v)}
                            >
                              <SelectTrigger className="h-9 w-32 border-none bg-gray-100 rounded-xl text-xs font-bold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-none shadow-xl">
                                <SelectItem value="attending" label="Asiste">Asiste</SelectItem>
                                <SelectItem value="notAttending" label="No asiste">No asiste</SelectItem>
                                <SelectItem value="noResponse" label="Sin rpta">Sin rpta</SelectItem>
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
                      ))}
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
