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
import { Player, Match, PlayerStat, Attendance, Opponent, Team, Injury, Season, StandingsEntry, PlayerSeason } from '../types';
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
import { ArrowLeft, Save, Trophy, Users, ShieldAlert, CheckCircle2, Stethoscope, XCircle, ShieldCheck, HelpCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  BIAS_LEARNING_RATE, 
  CALIBRATION_MATCH_COUNT, 
  NO_GOALKEEPER_GC_MODIFIER,
  EXTRA_ATTACKERS_GF_MODIFIER,
  SYNERGY_GF_BONUS,
  KEY_PLAYER_MISSING_GF_PENALTY,
  KEY_PLAYER_MISSING_GC_PENALTY,
  STANDINGS_MODIFIER_CLAMP,
  AGE_MODIFIERS
} from '../lib/predictionConstants';
import { calculateAge } from '../lib/ageUtils';
import { getStandingsStats } from '../lib/standingsUtils';
import { buildSynergyMap, getSynergyKey } from '../lib/synergyCalculator';
import { getMostProbableScore } from '../lib/poisson';
import { calculatePlayerRating } from '../lib/ratingSystem';
import { PlayerRating } from '../types/aiAnalysis';

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
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [playerSeasons, setPlayerSeasons] = useState<PlayerSeason[]>([]);
  const [loading, setLoading] = useState(true);

  const [localStats, setLocalStats] = useState<Record<string, Partial<PlayerStat>>>({});
  const [scoreOpponent, setScoreOpponent] = useState<number>(0);

  const handleResetAttendance = () => {
    const resetStats: Record<string, Partial<PlayerStat>> = {};
    visiblePlayers.forEach(p => {
      resetStats[p.id] = {
        attendance: 'noResponse',
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0
      };
    });
    setLocalStats(resetStats);
    setScoreOpponent(0);
    toast.success('Asistencias y resultado reseteados');
  };

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

        // Fetch Seasons
        const seasonsQuery = query(collection(db, 'seasons'), where('teamId', '==', matchData.teamId));
        const seasonsSnap = await getDocs(seasonsQuery);
        setSeasons(seasonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Season)));

        // Fetch all Matches for prediction H2H and Bias
        const matchesQuery = query(collection(db, 'matches'), where('teamId', '==', matchData.teamId));
        const matchesSnap = await getDocs(matchesQuery);
        setAllMatches(matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match)));

        // Fetch Standings
        const standingsSnap = await getDocs(collection(db, 'standings'));
        setStandings(standingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StandingsEntry)));

        // Fetch PlayerSeasons
        const playerSeasonsSnap = await getDocs(collection(db, 'playerSeasons'));
        setPlayerSeasons(playerSeasonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerSeason)));

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

  const handleResetConvocatoria = () => {
    const resetStats = { ...localStats };
    visiblePlayers.forEach(p => {
      resetStats[p.id] = {
        ...(resetStats[p.id] || {}),
        attendance: 'noResponse'
      };
    });
    setLocalStats(resetStats);
    toast.info('Convocatoria reiniciada a "Sin respuesta"');
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

      // Save AI Prediction if finalizing
      let savedPrediction = match.savedPrediction;
      
      if (shouldFinalize && !savedPrediction) {
        try {
          // Calculate Ratings for prediction logic
          const allPlayerRatings: PlayerRating[] = visiblePlayers.map(p => {
            const result = calculatePlayerRating(allMatches, injuries, stats, p, match.seasonId, seasons);
            return {
              id: p.id,
              rating: result.notaFinal,
              breakdown: result
            };
          });

          // PREDICTION ENGINE (Extracted from usePredictions)
          const allMatchesWithScores = allMatches.filter(m => m.status === 'completed' && m.scoreTeam != null && m.scoreOpponent != null);
          const sortedCompleted = [...allMatchesWithScores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const calibrationMatches = sortedCompleted.slice(0, CALIBRATION_MATCH_COUNT);
          
          let biasGF = 0;
          let biasGC = 0;
          
          const teamAvgOverall = allPlayerRatings.length > 0 
            ? allPlayerRatings.reduce((acc, p) => acc + p.rating, 0) / allPlayerRatings.length 
            : 70;

          const globalAvgGF = allMatchesWithScores.length > 0 ? allMatchesWithScores.reduce((acc, m) => acc + (m.scoreTeam || 0), 0) / allMatchesWithScores.length : 1.5;
          const globalAvgGC = allMatchesWithScores.length > 0 ? allMatchesWithScores.reduce((acc, m) => acc + (m.scoreOpponent || 0), 0) / allMatchesWithScores.length : 1.5;

          if (calibrationMatches.length > 0) {
            calibrationMatches.forEach(m => {
              let errorGF = 0;
              let errorGC = 0;
      
              if (m.savedPrediction) {
                  // Evaluamos el error directo de la IA vs el Resultado Real
                  errorGF = (m.scoreTeam || 0) - m.savedPrediction.team;
                  errorGC = (m.scoreOpponent || 0) - m.savedPrediction.opponent;
              } else {
                  // Fallback: error respecto a la media
                  const myAvgGF = allMatchesWithScores.reduce((acc, match) => acc + (match.scoreTeam || 0), 0) / allMatchesWithScores.length;
                  const myAvgGC = allMatchesWithScores.reduce((acc, match) => acc + (match.scoreOpponent || 0), 0) / allMatchesWithScores.length;
                  
                  errorGF = (m.scoreTeam || 0) - myAvgGF;
                  errorGC = (m.scoreOpponent || 0) - myAvgGC;
              }
              
              biasGF += errorGF;
              biasGC += errorGC;
            });
            biasGF = (biasGF / calibrationMatches.length) * BIAS_LEARNING_RATE;
            biasGC = (biasGC / calibrationMatches.length) * BIAS_LEARNING_RATE;
          }

          const synergyMap = buildSynergyMap(allMatches, stats);
          const attendingPlayers = visiblePlayers.filter(p => finalStats.find(s => s.playerId === p.id && s.attendance === 'attending'));
          const currentAvgBaremo = attendingPlayers.length > 0 
            ? attendingPlayers.reduce((acc, p) => acc + (allPlayerRatings.find(pr => pr.id === p.id)?.rating || teamAvgOverall), 0) / attendingPlayers.length 
            : teamAvgOverall;

          const vsOppMatches = allMatchesWithScores.filter(m => m.opponentId === match.opponentId);
          
          let predGF = globalAvgGF;
          let predGC = globalAvgGC;
          let totalModifierGF = 1.0;
          let totalModifierGC = 1.0;

          if (vsOppMatches.length > 0) {
            const h2hAvgGF = vsOppMatches.reduce((acc, m) => acc + (m.scoreTeam || 0), 0) / vsOppMatches.length;
            const h2hAvgGC = vsOppMatches.reduce((acc, m) => acc + (m.scoreOpponent || 0), 0) / vsOppMatches.length;
            predGF = (predGF * 0.4) + (h2hAvgGF * 0.6);
            predGC = (predGC * 0.4) + (h2hAvgGC * 0.6);
          }

          const strengthRatio = currentAvgBaremo / (teamAvgOverall || 1);
          totalModifierGF *= strengthRatio;
          totalModifierGC *= (1 / strengthRatio);

          const hasGoalkeeper = attendingPlayers.some(p => p.position === 'Portero');
          if (!hasGoalkeeper && attendingPlayers.length > 0) totalModifierGC *= NO_GOALKEEPER_GC_MODIFIER;

          const attackers = attendingPlayers.filter(p => p.position === 'Delantero').length;
          if (attackers >= 3) totalModifierGF *= EXTRA_ATTACKERS_GF_MODIFIER;

          let synergiesFound = 0;
          for (let i = 0; i < attendingPlayers.length; i++) {
            for (let j = i + 1; j < attendingPlayers.length; j++) {
              if (synergyMap.get(getSynergyKey(attendingPlayers[i].id, attendingPlayers[j].id))?.isLethal) synergiesFound++;
            }
          }
          if (synergiesFound > 0) totalModifierGF *= (1 + (SYNERGY_GF_BONUS * synergiesFound));

          const keyPlayerIds = allPlayerRatings.sort((a, b) => b.rating - a.rating).slice(0, 5).map(p => p.id);
          const presentKeyPlayers = attendingPlayers.filter(p => keyPlayerIds.includes(p.id)).length;
          const missingKeyPlayers = keyPlayerIds.length - presentKeyPlayers;
          if (missingKeyPlayers > 0) {
            totalModifierGF *= (1 - (KEY_PLAYER_MISSING_GF_PENALTY * (missingKeyPlayers/keyPlayerIds.length)));
            totalModifierGC *= (1 + (KEY_PLAYER_MISSING_GC_PENALTY * (missingKeyPlayers/keyPlayerIds.length)));
          }

          const teamStandStats = getStandingsStats(match.seasonId, 'my-team', allMatches, standings);
          const oppStandStats = getStandingsStats(match.seasonId, match.opponentId, allMatches, standings);
          if (teamStandStats && oppStandStats) {
            const pointsDiff = teamStandStats.points - oppStandStats.points;
            const standingMod = 1 + (pointsDiff * 0.02);
            const clampedMod = Math.min(Math.max(standingMod, STANDINGS_MODIFIER_CLAMP.MIN), STANDINGS_MODIFIER_CLAMP.MAX);
            totalModifierGF *= clampedMod;
            totalModifierGC *= (1 / clampedMod);
          }

          const avgAge = attendingPlayers.length > 0
            ? attendingPlayers.reduce((acc, p) => acc + calculateAge(p.birthDate, new Date(match.date)), 0) / attendingPlayers.length
            : 25;
          let ageMod = 1.0;
          if (avgAge < AGE_MODIFIERS.VERY_YOUNG.maxAge) ageMod = AGE_MODIFIERS.VERY_YOUNG.modifier;
          else if (avgAge < AGE_MODIFIERS.PRIME.maxAge) ageMod = AGE_MODIFIERS.PRIME.modifier;
          else if (avgAge < AGE_MODIFIERS.PEAK.maxAge) ageMod = AGE_MODIFIERS.PEAK.modifier;
          else ageMod = AGE_MODIFIERS.VETERAN.modifier;
          totalModifierGF *= ageMod;

          const recentMatches = sortedCompleted.slice(0, 3);
          const momentumGF = recentMatches.length > 0 ? (recentMatches.reduce((acc, m) => acc + (m.scoreTeam || 0), 0) / recentMatches.length) - globalAvgGF : 0;
          const momentumGC = recentMatches.length > 0 ? (recentMatches.reduce((acc, m) => acc + (m.scoreOpponent || 0), 0) / recentMatches.length) - globalAvgGC : 0;
          totalModifierGF *= Math.max(0.8, Math.min(1.2, 1 + (momentumGF * 0.1)));
          totalModifierGC *= Math.max(0.8, Math.min(1.2, 1 + (momentumGC * 0.1)));

          const finalPredGF = Math.max(0.1, predGF * totalModifierGF + (Math.abs(biasGF) > 0.1 ? biasGF : 0));
          const finalPredGC = Math.max(0.1, predGC * totalModifierGC + (Math.abs(biasGC) > 0.1 ? biasGC : 0));

          savedPrediction = getMostProbableScore(finalPredGF, finalPredGC);
        } catch (e) {
          console.error("Error calculating AI prediction for history:", e);
        }
      }

      // Update Match
      await updateDoc(doc(db, 'matches', matchId), {
        scoreTeam: teamScore,
        scoreOpponent: scoreOpponent,
        status: shouldFinalize ? 'completed' : match.status,
        savedPrediction: savedPrediction || null
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
      <div className="max-w-full mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/matches')}
            className="hover:bg-white rounded-xl"
          >
            <ArrowLeft size={18} className="mr-2" />
            Volver a Partidos
          </Button>

          <div className="flex items-center gap-3">
            <Button 
                onClick={handleResetConvocatoria}
                variant="outline"
                className="h-10 border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl font-bold transition-all px-4"
              >
                <RotateCcw className="mr-2" size={18} />
                Reiniciar Convocatoria
              </Button>
            <Button 
              onClick={() => handleSave(false)}
              variant="outline"
              className="h-10 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold transition-all px-6"
            >
              <Save className="mr-2" size={18} />
              Guardar Borrador
            </Button>

            {match.status !== 'completed' && (
              <Button 
                onClick={() => handleSave(true)}
                className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold px-6 shadow-lg shadow-emerald-100 transition-all"
              >
                <CheckCircle2 className="mr-2" size={18} />
                Finalizar Partido
              </Button>
            )}
          </div>
        </div>

        {/* Top Section: Scoreboard (Compact & Fixed at top) */}
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-slate-950 mb-8 sticky top-4 z-30">
          <div className="grid grid-cols-1 md:grid-cols-12 items-center">
            {/* Match Info */}
            <div className="md:col-span-3 bg-emerald-600 p-4 text-white text-center md:text-left md:pl-8">
              <p className="text-emerald-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                {match.type === 'league' ? `Liga - J${match.round}` : match.type === 'cup' ? `Copa - ${match.round}` : 'Amistoso'}
              </p>
              <h2 className="text-lg font-black leading-tight">
                {format(new Date(match.date), 'dd MMMM yyyy', { locale: es })}
              </h2>
              {season?.division && (
                <p className="text-emerald-200 text-[9px] font-bold uppercase tracking-widest mt-1">
                  {season.division}
                </p>
              )}
            </div>

            {/* Scoreboard */}
            <div className="md:col-span-9 p-4 flex items-center justify-center gap-8 md:gap-16">
              {/* Local */}
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                    {match.isHome !== false ? (team?.name || 'LOCAL') : (opponent?.name || 'LOCAL')}
                  </span>
                </div>
                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700 overflow-hidden shadow-lg shrink-0">
                  {match.isHome !== false ? (
                    team?.shieldUrl ? <img src={team.shieldUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Trophy className="text-slate-600" size={24} />
                  ) : (
                    opponent?.shieldUrl ? <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ShieldAlert className="text-slate-600" size={24} />
                  )}
                </div>
                <div className="bg-black rounded-xl px-4 py-2 border border-slate-800 shadow-2xl min-w-[60px] text-center">
                  {match.isHome === false ? (
                    <input 
                      type="number" 
                      value={scoreOpponent}
                      onChange={(e) => setScoreOpponent(parseInt(e.target.value) || 0)}
                      className="w-full bg-transparent text-2xl font-mono font-black text-emerald-500 text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    <span className="text-2xl font-mono font-black text-emerald-500 tabular-nums">
                      {teamScore}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xl font-mono font-black text-slate-800">:</div>

              {/* Visitor */}
              <div className="flex items-center gap-4">
                <div className="bg-black rounded-xl px-4 py-2 border border-slate-800 shadow-2xl min-w-[60px] text-center order-2 sm:order-1">
                  {match.isHome !== false ? (
                    <input 
                      type="number" 
                      value={scoreOpponent}
                      onChange={(e) => setScoreOpponent(parseInt(e.target.value) || 0)}
                      className="w-full bg-transparent text-2xl font-mono font-black text-emerald-500 text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    <span className="text-2xl font-mono font-black text-emerald-500 tabular-nums">
                      {teamScore}
                    </span>
                  )}
                </div>
                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700 overflow-hidden shadow-lg shrink-0 order-1 sm:order-2">
                  {match.isHome !== false ? (
                    opponent?.shieldUrl ? <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ShieldAlert className="text-slate-600" size={24} />
                  ) : (
                    team?.shieldUrl ? <img src={team.shieldUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Trophy className="text-slate-600" size={24} />
                  )}
                </div>
                <div className="text-left hidden sm:block order-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                    {match.isHome !== false ? (opponent?.name || 'VISITANTE') : (team?.name || 'VISITANTE')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-8">
          {/* Main Column: Player Stats */}
          <div className="w-full">
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-white border-b border-gray-50 p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                      <Users className="text-emerald-600" size={24} />
                    </div>
                    <div>
                      <CardTitle className="text-xl md:text-2xl font-black">Convocatoria y Estadísticas</CardTitle>
                      <CardDescription>Gestiona la asistencia y el rendimiento por jugador.</CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex flex-wrap gap-2">
                      <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-600" size={14} />
                        <span className="text-emerald-900 font-bold text-xs">{attendingCount} Asisten</span>
                      </div>
                      {noResponseCount > 0 && (
                        <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 flex items-center gap-2">
                          <HelpCircle className="text-gray-400" size={14} />
                          <span className="text-gray-600 font-bold text-xs">{noResponseCount} Sin rpta</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetAttendance}
                        className="h-9 px-4 border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl font-bold flex items-center gap-2"
                      >
                        <RotateCcw size={14} />
                        Resetear Todo
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-gray-50/80">
                      <TableRow className="border-none">
                        <TableHead className="pl-8 py-4 font-black text-gray-400 uppercase text-[9px] tracking-[0.15em] w-[25%]">Jugador</TableHead>
                        <TableHead className="py-4 font-black text-gray-400 uppercase text-[9px] tracking-[0.15em] text-center w-[20%]">Asistencia</TableHead>
                        <TableHead className="py-4 font-black text-gray-400 uppercase text-[9px] tracking-[0.15em] text-center w-[11%]">Goles</TableHead>
                        <TableHead className="py-4 font-black text-gray-400 uppercase text-[9px] tracking-[0.15em] text-center w-[11%]">Asist.</TableHead>
                        <TableHead className="py-4 font-black text-gray-400 uppercase text-[9px] tracking-[0.15em] text-center w-[11%]">Amarillas</TableHead>
                        <TableHead className="py-4 font-black text-gray-400 uppercase text-[9px] tracking-[0.15em] text-center pr-8 w-[11%]">Rojas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {['Portero', 'Defensa', 'Medio', 'Delantero'].map((pos) => {
                        const posPlayers = visiblePlayers.filter(p => p.position === pos);
                        if (posPlayers.length === 0) return null;

                        return (
                          <React.Fragment key={pos}>
                            <TableRow className="bg-gray-50/20 border-none group">
                              <TableCell colSpan={6} className="py-2 pl-8 border-none">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    {pos}s
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                            {posPlayers.map((player, i) => {
                              const isInjured = injuries.some(inj => inj.playerId === player.id && !inj.endDate);
                              const attendance = localStats[player.id]?.attendance || 'noResponse';
                              
                              return (
                                <motion.tr 
                                  key={player.id}
                                  initial={{ opacity: 0, scale: 0.98 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: i * 0.02 }}
                                  className={cn(
                                    "border-b border-gray-50/60 transition-all duration-200 group/row",
                                    attendance === 'attending' ? "bg-white" : "bg-white/40 opacity-70"
                                  )}
                                >
                                  <TableCell className="pl-4 py-1.5 focus:outline-none">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] transition-transform group-hover/row:scale-110",
                                        attendance === 'attending' ? "bg-emerald-600 text-white shadow-md shadow-emerald-100" :
                                        attendance === 'notAttending' ? "bg-red-600 text-white shadow-md shadow-red-100" :
                                        attendance === 'justified' ? "bg-blue-600 text-white shadow-md shadow-blue-100" :
                                        attendance === 'doubtful' ? "bg-amber-600 text-white shadow-md shadow-amber-100" :
                                        "bg-gray-100 text-gray-400"
                                      )}>
                                        {isInjured && attendance !== 'attending' ? <Stethoscope size={12} /> : player.number}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className={cn(
                                            "font-bold text-sm transition-colors",
                                            attendance === 'attending' ? "text-gray-900" : "text-gray-500"
                                          )}>
                                            {player.alias || `${player.firstName} ${player.lastName}`}
                                          </p>
                                          {isInjured && (
                                            <span className="text-[7px] bg-red-500 text-white px-1 py-0.5 rounded font-black uppercase">Les</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 px-4">
                                    <div className="flex justify-center">
                                      <Select 
                                        value={attendance} 
                                        onValueChange={(v) => updatePlayerStat(player.id, 'attendance', v)}
                                      >
                                        <SelectTrigger className={cn(
                                          "h-7 w-32 border-none rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm transition-all text-center flex justify-center",
                                          attendance === 'attending' ? "bg-emerald-600 text-white" :
                                          attendance === 'notAttending' ? "bg-red-600 text-white" :
                                          attendance === 'justified' ? "bg-blue-600 text-white" :
                                          attendance === 'doubtful' ? "bg-amber-600 text-white" :
                                          "bg-gray-200 text-gray-500"
                                        )}>
                                          <div className="flex items-center gap-1.5 justify-center w-full">
                                            {attendance === 'attending' && <CheckCircle2 size={10} />}
                                            {attendance === 'notAttending' && <XCircle size={10} />}
                                            {attendance === 'justified' && <ShieldCheck size={10} />}
                                            {attendance === 'doubtful' && <AlertCircle size={10} />}
                                            {attendance === 'noResponse' && <HelpCircle size={10} />}
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
                                              <CheckCircle2 size={12} className="text-emerald-500" />
                                              <span>Asiste</span>
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="doubtful">
                                            <div className="flex items-center gap-2">
                                              <AlertCircle size={12} className="text-amber-500" />
                                              <span>Duda</span>
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="notAttending">
                                            <div className="flex items-center gap-2">
                                              <XCircle size={12} className="text-red-500" />
                                              <span>No asiste</span>
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="justified">
                                            <div className="flex items-center gap-2">
                                              <ShieldCheck size={12} className="text-blue-500" />
                                              <span>Justificado</span>
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="noResponse">
                                            <div className="flex items-center gap-2">
                                              <HelpCircle size={12} className="text-gray-400" />
                                              <span>Sin rpta</span>
                                            </div>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </TableCell>
                                <TableCell className="py-2 text-center">
                                  <Input 
                                    type="number" 
                                    className={cn(
                                      "h-7 w-12 mx-auto text-center border-none rounded-lg font-black text-xs",
                                      attendance === 'attending' ? "bg-gray-100 text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20" : "bg-gray-50 text-gray-300 opacity-30 cursor-not-allowed"
                                    )}
                                    value={localStats[player.id]?.goals || 0}
                                    onChange={(e) => updatePlayerStat(player.id, 'goals', parseInt(e.target.value) || 0)}
                                    disabled={attendance !== 'attending'}
                                  />
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  <Input 
                                    type="number" 
                                    className={cn(
                                      "h-7 w-12 mx-auto text-center border-none rounded-lg font-black text-xs",
                                      attendance === 'attending' ? "bg-gray-100 text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20" : "bg-gray-50 text-gray-300 opacity-30 cursor-not-allowed"
                                    )}
                                    value={localStats[player.id]?.assists || 0}
                                    onChange={(e) => updatePlayerStat(player.id, 'assists', parseInt(e.target.value) || 0)}
                                    disabled={attendance !== 'attending'}
                                  />
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  <Input 
                                    type="number" 
                                    className={cn(
                                      "h-7 w-12 mx-auto text-center border-none rounded-lg font-black text-xs",
                                      attendance === 'attending' ? "bg-gray-100 text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20" : "bg-gray-50 text-gray-300 opacity-30 cursor-not-allowed"
                                    )}
                                    value={localStats[player.id]?.yellowCards || 0}
                                    onChange={(e) => updatePlayerStat(player.id, 'yellowCards', parseInt(e.target.value) || 0)}
                                    disabled={attendance !== 'attending'}
                                  />
                                </TableCell>
                                  <TableCell className="py-2 text-center pr-8">
                                    <Input 
                                      type="number" 
                                      className={cn(
                                        "h-7 w-12 mx-auto text-center border-none rounded-lg font-black text-xs",
                                        attendance === 'attending' ? "bg-gray-100 text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20" : "bg-gray-50 text-gray-300 opacity-30 cursor-not-allowed"
                                      )}
                                      value={localStats[player.id]?.redCards || 0}
                                      onChange={(e) => updatePlayerStat(player.id, 'redCards', parseInt(e.target.value) || 0)}
                                      disabled={attendance !== 'attending'}
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
