import React from 'react';
import {
  Trophy,
  Users,
  Calendar,
  TrendingUp,
  TrendingDown,
  Database,
  Target,
  Activity,
  Filter,
  Clock,
  Shield,
  Loader2,
  Trash2,
  ExternalLink,
  Bandage,
  Check,
  Cake,
  Lightbulb,
  Home,
  Navigation,
  Sparkles,
  Info,
  ChevronRight,
  Brain,
  Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  LabelList
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { motion } from 'motion/react';
import { Player, Match, PlayerStat, Opponent, Season, Field, PlayerSeason, Injury, Position, StandingsEntry } from '../types';
import { cn } from '@/lib/utils';
import { seedDatabase } from '../lib/seedData';
import { cleanupDatabase } from '../lib/cleanup';
import { toast } from 'sonner';
import { calculatePlayerRating } from '../lib/ratingSystem';
import { formatMatchDate, getOpponentName } from '@/lib/matchDisplayLabel';
import { LazyTopPlayersCard } from './LazyTopPlayersCard';
import AttendanceChart from './AttendanceChart';

function NextMatchCountdown({ matchDateIso }: { matchDateIso: string }) {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const id = window.setInterval(() => bump(), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const target = new Date(matchDateIso).getTime();
  if (Number.isNaN(target)) return null;

  const ms = target - Date.now();
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);

  let body: React.ReactNode;
  if (ms <= 0) {
    body = (
      <p className="text-sm font-semibold text-amber-300/95 text-center py-0.5 leading-snug">
        La fecha del partido ya pasó: actualiza el calendario o registra el resultado.
      </p>
    );
  } else if (totalSec < 3600) {
    body = (
      <p className="text-center text-lg font-black tabular-nums text-white py-1">Menos de 1 hora</p>
    );
  } else {
    body = (
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-emerald-900/60 border border-emerald-700/40 px-2 py-2.5 text-center">
          <div className="text-2xl font-black tabular-nums leading-none">{days}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/90 mt-1">
            {days === 1 ? 'día' : 'días'}
          </div>
        </div>
        <div className="rounded-xl bg-emerald-900/60 border border-emerald-700/40 px-2 py-2.5 text-center">
          <div className="text-2xl font-black tabular-nums leading-none">{hours}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/90 mt-1">
            {hours === 1 ? 'hora' : 'horas'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Timer size={14} className="text-emerald-400 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Cuenta atrás</span>
      </div>
      {body}
    </div>
  );
}

interface DashboardProps {
  teamId?: string;
  players: Player[];
  playerSeasons: PlayerSeason[];
  matches: Match[];
  stats: PlayerStat[];
  opponents: Opponent[];
  seasons: Season[];
  fields: Field[];
  injuries: Injury[];
  globalSeasonId: string;
  standings?: StandingsEntry[];
}

export default function Dashboard({ 
  teamId,
  players, 
  playerSeasons, 
  matches, 
  stats, 
  opponents, 
  seasons, 
  fields, 
  injuries, 
  globalSeasonId,
  standings = []
}: DashboardProps) {
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [isCleaning, setIsCleaning] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<string>('all');
  const [recommendedMatchId, setRecommendedMatchId] = React.useState<string | null>(null);

  const handleSeed = async () => {
    setIsSeeding(true);
    await seedDatabase();
    setIsSeeding(false);
  };

  const handleCleanup = async () => {
    if (!teamId) {
      toast.error('No hay equipo seleccionado para limpiar datos');
      return;
    }
    try {
      setIsCleaning(true);
      const { updatesCount, deletesCount } = await cleanupDatabase(teamId);
      toast.success(`Limpieza completada: ${deletesCount} eliminados, ${updatesCount} actualizados.`);
    } catch (error) {
      console.error("Error cleaning database:", error);
      toast.error("Error al limpiar la base de datos");
    } finally {
      setIsCleaning(false);
    }
  };

  // 1. Filtrar datos por temporada y tipo
  const filteredMatches = React.useMemo(() => matches.filter(m => {
    const matchSeason = globalSeasonId === 'all' || m.seasonId === globalSeasonId;
    const matchType = selectedType === 'all' || m.type === selectedType;
    return matchSeason && matchType;
  }), [matches, globalSeasonId, selectedType]);

  const filteredStats = React.useMemo(() => stats.filter(s => {
    const match = matches.find(m => m.id === s.matchId);
    const matchSeason = globalSeasonId === 'all' || match?.seasonId === globalSeasonId;
    const matchType = selectedType === 'all' || match?.type === selectedType;
    return matchSeason && matchType;
  }), [stats, matches, globalSeasonId, selectedType]);

  const filteredPlayers = React.useMemo(() => {
    if (globalSeasonId === 'all') return players;
    const seasonPlayerIds = playerSeasons.filter(ps => ps.seasonId === globalSeasonId).map(ps => ps.playerId);
    return players.filter(p => seasonPlayerIds.includes(p.id));
  }, [players, playerSeasons, globalSeasonId]);

  // 2. Cálculos de estadísticas
  const { completedMatches, scheduledMatches, matchesWithScores, wins, losses, draws, totalGoals, totalAssists, totalYellowCards, totalRedCards, totalGoalsAgainst, winStreak, lossStreak, drawStreak } = React.useMemo(() => {
    const completed = filteredMatches.filter(m => m.status === 'completed')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const scheduled = filteredMatches.filter(m => m.status === 'scheduled')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const withScores = completed.filter(m => m.scoreTeam != null && m.scoreOpponent != null);

    // Calculate streaks
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;
    let currentDrawStreak = 0;
    let maxDrawStreak = 0;

    withScores.forEach(m => {
      const isWin = m.scoreTeam! > m.scoreOpponent!;
      const isLoss = m.scoreTeam! < m.scoreOpponent!;
      const isDraw = m.scoreTeam! === m.scoreOpponent!;

      if (isWin) {
        currentWinStreak++;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        currentLossStreak = 0;
        currentDrawStreak = 0;
      } else if (isLoss) {
        currentLossStreak++;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        currentWinStreak = 0;
        currentDrawStreak = 0;
      } else if (isDraw) {
        currentDrawStreak++;
        maxDrawStreak = Math.max(maxDrawStreak, currentDrawStreak);
        currentWinStreak = 0;
        currentLossStreak = 0;
      }
    });

    return {
      completedMatches: completed,
      scheduledMatches: scheduled,
      matchesWithScores: withScores,
      wins: withScores.filter(m => m.scoreTeam! > m.scoreOpponent!).length,
      losses: withScores.filter(m => m.scoreTeam! < m.scoreOpponent!).length,
      draws: withScores.filter(m => m.scoreTeam! === m.scoreOpponent!).length,
      totalGoals: filteredStats.reduce((acc, s) => acc + (s.goals || 0), 0),
      totalAssists: filteredStats.reduce((acc, s) => acc + (s.assists || 0), 0),
      totalYellowCards: filteredStats.reduce((acc, s) => acc + (s.yellowCards || 0), 0),
      totalRedCards: filteredStats.reduce((acc, s) => acc + (s.redCards || 0), 0),
      totalGoalsAgainst: withScores.reduce((acc, m) => acc + (m.scoreOpponent || 0), 0),
      winStreak: maxWinStreak,
      lossStreak: maxLossStreak,
      drawStreak: maxDrawStreak
    };
  }, [filteredMatches, filteredStats]);

  // 3. Top Goleadores (filtrados)
  const playerGoals = React.useMemo(() => {
    const playerGoalsMap = new Map<string, number>();
    filteredStats.forEach(s => {
      // Solo incluir jugadores que están inscritos en la temporada actual
      if (filteredPlayers.some(p => p.id === s.playerId)) {
        if (s.goals > 0) {
          playerGoalsMap.set(s.playerId, (playerGoalsMap.get(s.playerId) || 0) + s.goals);
        }
      }
    });

    return Array.from(playerGoalsMap.entries()).map(([playerId, goals]) => {
      const p = players.find(p => p.id === playerId);
      return {
        id: playerId,
        name: p ? (p.alias || p.firstName) : 'Desconocido',
        photoUrl: p?.photoUrl,
        goals
      };
    }).sort((a, b) => b.goals - a.goals).slice(0, 8);
  }, [filteredStats, filteredPlayers, players]);

  // Top Tarjeteros
  const playerCards = React.useMemo(() => {
    const playerCardsMap = new Map<string, { yellow: number, red: number, points: number }>();
    filteredStats.forEach(s => {
      if (filteredPlayers.some(p => p.id === s.playerId)) {
        if (s.yellowCards > 0 || s.redCards > 0) {
          const current = playerCardsMap.get(s.playerId) || { yellow: 0, red: 0, points: 0 };
          current.yellow += s.yellowCards || 0;
          current.red += s.redCards || 0;
          current.points += (s.yellowCards || 0) + (s.redCards || 0) * 2; // Red matters more
          playerCardsMap.set(s.playerId, current);
        }
      }
    });

    return Array.from(playerCardsMap.entries()).map(([playerId, stats]) => {
      const p = players.find(p => p.id === playerId);
      return {
        id: playerId,
        name: p ? (p.alias || p.firstName) : 'Desconocido',
        photoUrl: p?.photoUrl,
        stats
      };
    }).sort((a, b) => b.stats.points - a.stats.points).slice(0, 5);
  }, [filteredStats, filteredPlayers, players]);

  // Next Match & Last 5
  const nextMatchInfo = React.useMemo(() => {
    if (scheduledMatches.length === 0) return null;
    const nextMatch = scheduledMatches[0];
    const opponent = opponents.find(o => o.id === nextMatch.opponentId);
    const field = fields.find(f => f.id === nextMatch.fieldId);
    return { match: nextMatch, opponent, field };
  }, [scheduledMatches, opponents, fields]);

  const last5Matches = React.useMemo(() => {
    return matchesWithScores.slice(-5).map(m => {
        const isWin = m.scoreTeam! > m.scoreOpponent!;
        const isDraw = m.scoreTeam! === m.scoreOpponent!;
        const isLoss = m.scoreTeam! < m.scoreOpponent!;
        return {
            ...m,
            opponentName: getOpponentName(opponents, m.opponentId, 'Desconocido'),
            opponentShield: opponents.find((o) => o.id === m.opponentId)?.shieldUrl,
            result: isWin ? 'W' : (isDraw ? 'D' : 'L')
        };
    });
  }, [matchesWithScores, opponents]);


  // 4. Histórico vs Rivales (filtrado)
  const opponentStats = React.useMemo(() => {
    const byOpp = new Map<string, { wins: number; losses: number; draws: number; total: number }>();
    for (const m of completedMatches) {
      if (m.scoreTeam == null || m.scoreOpponent == null) continue;
      const oid = m.opponentId;
      let row = byOpp.get(oid);
      if (!row) {
        row = { wins: 0, losses: 0, draws: 0, total: 0 };
        byOpp.set(oid, row);
      }
      row.total++;
      if (m.scoreTeam > m.scoreOpponent) row.wins++;
      else if (m.scoreTeam < m.scoreOpponent) row.losses++;
      else row.draws++;
    }
    return opponents
      .map((opp) => {
        const r = byOpp.get(opp.id);
        if (!r || r.total === 0) return null;
        return {
          name: opp.name,
          wins: r.wins,
          losses: r.losses,
          draws: r.draws,
          total: r.total,
        };
      })
      .filter((o): o is { name: string; wins: number; losses: number; draws: number; total: number } => o != null)
      .sort((a, b) => b.total - a.total);
  }, [opponents, completedMatches]);

  // 5. Cálculo de Baremo (Nota Final)
  const allPlayerRatings = React.useMemo(() => {
    return filteredPlayers.map(p => {
      const breakdown = calculatePlayerRating(matches, injuries, stats, p, globalSeasonId, seasons);
      return { 
        ...p, 
        rating: breakdown.notaFinal,
        breakdown // Keep full breakdown for deeper analysis
      };
    }).sort((a, b) => b.rating - a.rating);
  }, [filteredPlayers, matches, injuries, stats, globalSeasonId, seasons]);

  const playerBaremo = React.useMemo(() => allPlayerRatings.slice(0, 8), [allPlayerRatings]);

  // Memoized calculate functions for LazyTopPlayersCard
  const calculateBaremo = React.useCallback(() => playerBaremo, [playerBaremo]);
  const calculateGoals = React.useCallback(() => playerGoals, [playerGoals]);
  
  const calculateMaxStreak = React.useCallback(() => {
    return filteredPlayers
      .map(p => {
        const rating = calculatePlayerRating(matches, injuries, stats, p, globalSeasonId, seasons);
        return { ...p, racha: rating.rachaMaxima };
      })
      .sort((a, b) => b.racha - a.racha)
      .slice(0, 8);
  }, [filteredPlayers, matches, injuries, stats, globalSeasonId, seasons]);

  const calculateMatchesPlayed = React.useCallback(() => {
    return filteredPlayers
      .map(p => ({
        ...p,
        matches: filteredStats.filter(s => s.playerId === p.id && s.attendance === 'attending').length
      }))
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 8);
  }, [filteredPlayers, filteredStats]);

  const calculateLeastMatches = React.useCallback(() => {
    return filteredPlayers
      .map(p => ({
        ...p,
        matches: filteredStats.filter(s => s.playerId === p.id && s.attendance === 'attending').length
      }))
      .sort((a, b) => a.matches - b.matches)
      .slice(0, 8);
  }, [filteredPlayers, filteredStats]);

  const currentlyInjured = React.useMemo(() => {
    const today = new Date();
    return injuries.filter(i => {
      const start = new Date(i.startDate);
      const end = i.endDate ? new Date(i.endDate) : null;
      return start <= today && (!end || end >= today);
    }).length;
  }, [injuries]);

  // Age Calculations Utils
  const calculateAge = React.useCallback((birthDate: string) => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const month = today.getMonth() - birth.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }, []);

  const ageStats = React.useMemo(() => {
    if (filteredPlayers.length === 0) return null;

    const ages = filteredPlayers.map(p => calculateAge(p.birthDate)).filter(age => age > 0);
    if (ages.length === 0) return null;

    const averageAge = ages.reduce((a, b) => a + b, 0) / ages.length;

    const positions: Position[] = ['Portero', 'Defensa', 'Medio', 'Delantero'];
    const avgAgeByPosition = positions.map(pos => {
      const posAges = filteredPlayers
        .filter(p => p.position === pos)
        .map(p => calculateAge(p.birthDate))
        .filter(age => age > 0);
      return {
        position: pos,
        avgAge: posAges.length > 0 ? posAges.reduce((a, b) => a + b, 0) / posAges.length : 0
      };
    });

    const sortedByAge = [...filteredPlayers].sort((a, b) => {
      return new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime();
    });

    // Upcoming Birthdays (next 30 days)
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDate = today.getDate();

    const upcomingBirthdays = filteredPlayers.map(p => {
      const birth = new Date(p.birthDate);
      const bMonth = birth.getMonth();
      const bDay = birth.getDate();
      
      // Calculate next occurrence
      let nextOccur = new Date(today.getFullYear(), bMonth, bDay);
      if (nextOccur < today) {
        nextOccur.setFullYear(today.getFullYear() + 1);
      }
      
      const diffTime = nextOccur.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return { 
        ...p, 
        daysUntil: diffDays,
        isBirthdayToday: bMonth === currentMonth && bDay === currentDate,
        isBirthdayThisMonth: bMonth === currentMonth
      };
    }).filter(p => p.daysUntil <= 30 || p.isBirthdayToday)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5);

    return {
      averageAge: parseFloat(averageAge.toFixed(1)),
      avgAgeByPosition,
      oldest: sortedByAge[0],
      youngest: sortedByAge[sortedByAge.length - 1],
      upcomingBirthdays,
      distribution: [
        { name: '< 20', value: ages.filter(a => a < 20).length },
        { name: '20-25', value: ages.filter(a => a >= 20 && a <= 25).length },
        { name: '26-30', value: ages.filter(a => a > 25 && a <= 30).length },
        { name: '31-35', value: ages.filter(a => a > 30 && a <= 35).length },
        { name: '36+', value: ages.filter(a => a > 35).length },
      ].filter(d => d.value > 0)
    };
  }, [filteredPlayers, calculateAge]);

  const statGroups = [
    {
      title: "Resultados",
      cards: [
        { title: 'Victorias', value: wins, icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { title: 'Empates', value: draws, icon: Activity, color: 'text-gray-600', bg: 'bg-gray-50' },
        { title: 'Derrotas', value: losses, icon: Target, color: 'text-red-600', bg: 'bg-red-50' },
      ]
    },
    {
      title: "Rendimiento",
      cards: [
        { title: 'Goles Favor', value: totalGoals, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
        { title: 'Goles Contra', value: totalGoalsAgainst, icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50' },
        { title: 'Asistencias', value: totalAssists, icon: Users, color: 'text-pink-600', bg: 'bg-pink-50' },
      ]
    },
    {
      title: "Rachas",
      cards: [
        { title: 'Victorias', value: winStreak, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { title: 'Empates', value: drawStreak, icon: Activity, color: 'text-gray-600', bg: 'bg-gray-50' },
        { title: 'Derrotas', value: lossStreak, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
      ]
    },
    {
      title: "Salud y Disciplina",
      cards: [
        { title: 'Lesionados', value: currentlyInjured, icon: Bandage, color: 'text-red-500', bg: 'bg-red-50' },
        { title: 'Amarillas', value: totalYellowCards, icon: Target, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        { title: 'Rojas', value: totalRedCards, icon: Target, color: 'text-red-700', bg: 'bg-red-100' },
      ]
    },
    {
      title: "General",
      cards: [
        { title: 'Part. Jugados', value: completedMatches.length, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
        { title: 'Programados', value: scheduledMatches.length, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
        { title: 'Jugadores', value: filteredPlayers.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      ]
    }
  ];

  const winRateData = [
    { name: 'Victorias', value: wins, fill: '#10B981' },
    { name: 'Empates', value: draws, fill: '#9CA3AF' },
    { name: 'Derrotas', value: losses, fill: '#EF4444' },
  ].filter(d => d.value > 0);

  const goalsData = [
    { name: 'A Favor', value: totalGoals, fill: '#3B82F6' },
    { name: 'En Contra', value: totalGoalsAgainst, fill: '#F97316' },
  ].filter(d => d.value > 0);

  // 10. Predicción de Resultados (Análisis de Historial, Calidad de Convocatoria, Racha, Clasificación y Factores Contextuales)

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Resumen del Equipo</h2>
          <p className="text-gray-500">Estadísticas generales y rendimiento del equipo.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button 
            variant="outline" 
            onClick={handleCleanup} 
            disabled={isCleaning} 
            className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-11"
          >
            {isCleaning ? <Loader2 className="animate-spin mr-2" size={16} /> : <Trash2 className="mr-2" size={16} />}
            Limpiar Huérfanos
          </Button>

          <div className="flex-1 md:w-48">
            <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1 mb-1 block">Tipo de Partido</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="bg-white border-none shadow-sm rounded-xl h-11">
                {/* TRUCO: Div contenedor y texto manual */}
                <div className="flex items-center truncate">
                  <Filter size={16} className="mr-2 text-gray-400 shrink-0" />
                  <SelectValue>
                    {selectedType === 'all' ? 'Todos los tipos' :
                     selectedType === 'league' ? 'Liga' :
                     selectedType === 'cup' ? 'Copa' :
                     selectedType === 'friendly' ? 'Amistoso' : 'Tipo de Partido'}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-xl">
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="league">Liga</SelectItem>
                <SelectItem value="cup">Copa</SelectItem>
                <SelectItem value="friendly">Amistoso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {players.length === 0 && (
            <Button
              onClick={handleSeed}
              disabled={isSeeding}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 group"
            >
              <Database size={18} className="mr-2 group-hover:hidden" />
              <Check size={18} className="mr-2 hidden group-hover:block" />
              {isSeeding ? 'Generando...' : 'Datos de Prueba'}
            </Button>
          )}
        </div>
      </header>

      {/* --- PANEL DEL ENTRENADOR --- */}
      <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-3xl p-6 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Shield size={200} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-800/50 rounded-xl backdrop-blur-sm border border-emerald-700/50">
              <Brain className="text-emerald-300" size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight text-white">Panel del Entrenador</h3>
              <p className="text-sm font-medium text-emerald-300/80">Vista rápida para la toma de decisiones.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Próxima Jornada */}
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Próxima Jornada</span>
                  {nextMatchInfo?.match && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-none hover:bg-emerald-500/30">
                        {nextMatchInfo.match.type === 'league' ? `Jornada ${nextMatchInfo.match.round}` : nextMatchInfo.match.type === 'cup' ? 'Copa' : 'Amistoso'}
                      </Badge>
                  )}
                </div>

                {nextMatchInfo ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center p-2 border border-emerald-700/50">
                        {nextMatchInfo.opponent?.shieldUrl ? (
                          <img src={nextMatchInfo.opponent.shieldUrl} alt={nextMatchInfo.opponent.name} className="w-full h-full object-contain drop-shadow-md" />
                        ) : (
                          <Shield size={24} className="text-emerald-300/50" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-300/60 uppercase tracking-wider mb-0.5">Rival</p>
                        <p className="font-bold text-lg leading-tight">
                          {getOpponentName(opponents, nextMatchInfo.match.opponentId, 'Por definir')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-emerald-400/50 font-medium italic text-sm mt-4">
                    No hay partidos programados.
                  </div>
                )}
              </div>
              
              {nextMatchInfo && (
                <div className="mt-6 pt-4 border-t border-emerald-800/50 space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 text-emerald-200">
                      <Calendar size={14} className="text-emerald-400" />
                      <span className="text-sm font-semibold">
                        {formatMatchDate(nextMatchInfo.match, 'dashboardDate')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-200">
                      <Clock size={14} className="text-emerald-400" />
                      <span className="text-sm font-semibold">
                        {formatMatchDate(nextMatchInfo.match, 'listTime')}
                      </span>
                    </div>
                  </div>
                  <NextMatchCountdown matchDateIso={nextMatchInfo.match.date} />
                </div>
              )}
            </div>

            {/* Últimos 5 Resultados */}
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-4 block">Forma (Últimos 5)</span>
              {last5Matches.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      {last5Matches.map((m, i) => (
                        <div key={m.id} className="flex flex-col items-center gap-1.5 flex-1">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-inner border border-white/10",
                            m.result === 'W' ? 'bg-emerald-500 text-white' :
                            m.result === 'D' ? 'bg-gray-500 text-white' :
                            'bg-red-500 text-white'
                          )}>
                            {m.result}
                          </div>
                          <span className="text-[9px] font-bold text-emerald-300/60 uppercase truncate max-w-[40px] text-center" title={m.opponentName}>
                            {m.opponentName.substring(0, 3)}
                          </span>
                        </div>
                      ))}
                      {/* Fill empty spots if less than 5 */}
                      {Array.from({ length: 5 - last5Matches.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="flex flex-col items-center gap-1.5 flex-1">
                          <div className="w-8 h-8 rounded-full bg-emerald-900/50 border border-emerald-800/30 flex items-center justify-center">
                            <span className="w-1 h-1 rounded-full bg-emerald-700/50"></span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-3 border-t border-emerald-800/50">
                        <p className="text-xs text-emerald-300/80 leading-relaxed font-medium">
                            El equipo ha sumado <strong className="text-emerald-400">{last5Matches.filter(m=>m.result === 'W').length * 3 + last5Matches.filter(m=>m.result === 'D').length} puntos</strong> de los últimos {last5Matches.length * 3} posibles.
                        </p>
                    </div>
                </div>
              ) : (
                <div className="text-emerald-400/50 font-medium italic text-sm mt-4">
                  Sin historial reciente.
                </div>
              )}
            </div>

            {/* Máximos Goleadores (Top 3) */}
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-4 block">Máximos Goleadores</span>
              <div className="space-y-3">
                {playerGoals.slice(0, 3).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 flex items-center justify-center font-black text-[10px] text-emerald-900 bg-emerald-400 rounded">
                        {i + 1}
                      </div>
                      <span className="text-sm font-bold text-emerald-50 truncate max-w-[100px]">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-900/80 px-2 py-1 rounded text-emerald-300">
                      <Target size={12} />
                      <span className="text-xs font-black">{p.goals}</span>
                    </div>
                  </div>
                ))}
                {playerGoals.length === 0 && (
                  <div className="text-emerald-400/50 font-medium italic text-sm">Sin datos.</div>
                )}
              </div>
            </div>

            {/* Más Tarjetas (Top 3) */}
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-4 block">Más Tarjetas (Alerta)</span>
              <div className="space-y-3">
                {playerCards.slice(0, 3).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 flex items-center justify-center font-black text-[10px] text-red-950 bg-red-400 rounded">
                        {i + 1}
                      </div>
                      <span className="text-sm font-bold text-emerald-50 truncate max-w-[90px]">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       {p.stats.yellow > 0 && (
                           <div className="flex items-center text-[10px] font-black bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-400/30">
                               {p.stats.yellow} <div className="w-2 h-3 bg-yellow-400 rounded-[1px] ml-1"></div>
                           </div>
                       )}
                       {p.stats.red > 0 && (
                           <div className="flex items-center text-[10px] font-black bg-red-400/20 text-red-400 px-1.5 py-0.5 rounded border border-red-400/30">
                               {p.stats.red} <div className="w-2 h-3 bg-red-500 rounded-[1px] ml-1"></div>
                           </div>
                       )}
                    </div>
                  </div>
                ))}
                {playerCards.length === 0 && (
                  <div className="text-emerald-400/50 font-medium italic text-sm">Equipo limpio.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
      {/* --------------------------- */}

      {/* Stats Navigation/Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
        {statGroups.map((group, idx) => (
          <div key={group.title} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3 h-full">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-50">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{group.title}</span>
            </div>
            <div className="flex flex-col gap-2">
                {group.cards.map((card, i) => (
                    <motion.div
                        key={card.title}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (idx * 0.1) + (i * 0.05) }}
                    >
                        <div className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-xl transition-colors", card.bg, "group-hover:bg-white group-hover:shadow-sm")}>
                                    <card.icon className={card.color} size={14} />
                                </div>
                                <p className="text-[11px] font-bold text-gray-600">{card.title}</p>
                            </div>
                            <span className={cn("text-lg font-black", card.color)}>{card.value}</span>
                        </div>
                    </motion.div>
                ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Attendance Chart */}
      <AttendanceChart 
        matches={filteredMatches} 
        stats={filteredStats} 
        seasons={seasons}
        globalSeasonId={globalSeasonId}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Win Rate Pie Chart */}
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle>Distribución de Resultados</CardTitle>
            <CardDescription>Porcentaje de éxito en partidos jugados.</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center">
            {winRateData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winRateData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {winRateData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 italic text-sm">No hay partidos jugados.</div>
            )}
          </CardContent>
        </Card>

        {/* Goals Donut Chart */}
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle>Balance de Goles</CardTitle>
            <CardDescription>Goles a favor vs. en contra.</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center">
            {goalsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={goalsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {goalsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 italic text-sm">No hay goles registrados.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Age Statistics Section */}
      {ageStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
          {/* Age Distribution Pie Chart */}
          <Card className="border border-gray-100 shadow-sm lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="text-emerald-600" size={18} />
                Distribución por Edad
              </CardTitle>
              <CardDescription>Segmentación de la plantilla por rangos.</CardDescription>
            </CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ageStats.distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {ageStats.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5]} />
                    ))}
                    <LabelList 
                      dataKey="name" 
                      position="outside" 
                      style={{ fontSize: '10px', fill: '#6B7280', fontWeight: 'bold' }} 
                    />
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Average Age by Position Bar Chart */}
          <Card className="border border-gray-100 shadow-sm lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="text-blue-600" size={18} />
                Edad Media por Posición
              </CardTitle>
              <CardDescription>Comparativa de veteranía por líneas.</CardDescription>
            </CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageStats.avgAgeByPosition} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="position" 
                    type="category" 
                    width={80} 
                    axisLine={false} 
                    tickLine={false} 
                    style={{ fontSize: '11px', fontWeight: 'bold', fill: '#4B5563' }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    formatter={(value: number) => [`${value.toFixed(1)} años`, 'Edad Media']}
                  />
                  <Bar dataKey="avgAge" radius={[0, 10, 10, 0]} barSize={24}>
                    {ageStats.avgAgeByPosition.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#FACC15', '#3B82F6', '#10B981', '#EF4444'][index % 4]} />
                    ))}
                    <LabelList 
                      dataKey="avgAge" 
                      position="right" 
                      formatter={(v: number) => v > 0 ? `${v.toFixed(1)}` : ''} 
                      style={{ fontSize: '10px', fontWeight: 'black', fill: '#374151' }} 
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Key Age Metrics */}
          <Card className="border border-gray-100 shadow-sm lg:col-span-1 bg-gradient-to-br from-white to-gray-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="text-orange-500" size={18} />
                Hitos de Edad
              </CardTitle>
              <CardDescription>Datos clave sobre la madurez del equipo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex flex-col items-center justify-center py-2 bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity size={40} className="text-emerald-600" />
                </div>
                <span className="text-[10px] uppercase font-black text-gray-400">Media del Equipo</span>
                <span className="text-4xl font-black text-emerald-600 leading-none mt-1">{ageStats.averageAge}</span>
                <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">años</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-100 transition-colors">
                  <p className="text-[9px] uppercase font-bold text-gray-400 mb-1">Más Veterano</p>
                  <p className="font-black text-gray-900 truncate">{ageStats.oldest.alias || ageStats.oldest.firstName}</p>
                  <p className="text-xs font-bold text-blue-600">{calculateAge(ageStats.oldest.birthDate)} años</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-emerald-100 transition-colors">
                  <p className="text-[9px] uppercase font-bold text-gray-400 mb-1">Más Joven</p>
                  <p className="font-black text-gray-900 truncate">{ageStats.youngest.alias || ageStats.youngest.firstName}</p>
                  <p className="text-xs font-bold text-emerald-600">{calculateAge(ageStats.youngest.birthDate)} años</p>
                </div>
              </div>

              {ageStats.upcomingBirthdays.length > 0 && (
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-50">
                    <Cake size={14} className="text-pink-500" />
                    <span className="text-[10px] uppercase font-black text-gray-400">Próximos Cumples</span>
                  </div>
                  <div className="space-y-2">
                    {ageStats.upcomingBirthdays.map(p => (
                      <div key={p.id} className="flex items-center justify-between group/bday">
                        <div className="flex items-center gap-2 max-w-[70%]">
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                            p.isBirthdayToday ? "bg-pink-100 text-pink-600 animate-pulse" : "bg-gray-100 text-gray-500"
                          )}>
                            {p.isBirthdayToday ? "🎂" : (p.alias || p.firstName).charAt(0)}
                          </div>
                          <span className={cn("text-[11px] font-bold truncate", p.isBirthdayToday ? "text-pink-600" : "text-gray-700")}>
                            {p.alias || p.firstName}
                          </span>
                        </div>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", 
                          p.isBirthdayToday ? "bg-pink-50 text-pink-600" : "text-gray-400")}>
                          {p.isBirthdayToday ? "¡HOY!" : `en ${p.daysUntil}d`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-[10px] text-emerald-700 bg-emerald-50/50 p-2 rounded-lg leading-relaxed font-medium">
                <Lightbulb size={12} className="text-emerald-500 shrink-0" />
                <p>Equipos con media 27-29 suelen combinar el pico físico con la madurez mental óptima.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Players Stats */}
      <div>
        <div className="mt-8 mb-6">
          <h3 className="text-xl font-bold tracking-tight opacity-90">Ránking de Jugadores</h3>
          <p className="text-sm text-gray-500">Los jugadores más destacados y comprometidos.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
        {/* Top Players by IR */}
        <LazyTopPlayersCard
          title="Top 8 Jugadores por Baremo"
          description="Nota final basada en Compromiso y Desempeño."
          calculate={calculateBaremo}
          renderItem={(player: any, i: number) => (
            <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                  i === 0 ? "bg-yellow-100 text-yellow-700" :
                  i === 1 ? "bg-gray-200 text-gray-700" :
                  i === 2 ? "bg-amber-100 text-amber-700" :
                  "bg-white text-gray-400 border border-gray-200"
                )}>
                  {i + 1}
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-xs overflow-hidden shrink-0">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.alias} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (player.alias || player.firstName).charAt(0).toUpperCase()
                  )}
                </div>
                <p className="font-bold text-gray-900 truncate">{player.alias || player.firstName}</p>
              </div>
              <div className="text-lg font-black text-emerald-600">{player.rating}</div>
            </div>
          )}
        />

        {/* Top Goalscorers */}
        <LazyTopPlayersCard
          title="Máximos Goleadores"
          description="Top 8 jugadores con más goles."
          calculate={calculateGoals}
          renderItem={(player: any, i: number) => (
            <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                  i === 0 ? "bg-yellow-100 text-yellow-700" :
                  i === 1 ? "bg-gray-200 text-gray-700" :
                  i === 2 ? "bg-amber-100 text-amber-700" :
                  "bg-white text-gray-400 border border-gray-200"
                )}>
                  {i + 1}
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-xs overflow-hidden shrink-0">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    player.name.charAt(0).toUpperCase()
                  )}
                </div>
                <p className="font-bold text-gray-900 truncate">{player.name}</p>
              </div>
              <div className="text-lg font-black text-blue-600">{player.goals}</div>
            </div>
          )}
        />

        {/* Top Players by Max Streak */}
        <LazyTopPlayersCard
          title="Top 8 Racha Máxima"
          description="Mayor número de partidos consecutivos asistidos."
          calculate={calculateMaxStreak}
          renderItem={(player: any, i: number) => (
            <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                  i === 0 ? "bg-yellow-100 text-yellow-700" :
                  i === 1 ? "bg-gray-200 text-gray-700" :
                  i === 2 ? "bg-amber-100 text-amber-700" :
                  "bg-white text-gray-400 border border-gray-200"
                )}>
                  {i + 1}
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-xs overflow-hidden shrink-0">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.alias} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (player.alias || player.firstName).charAt(0).toUpperCase()
                  )}
                </div>
                <p className="font-bold text-gray-900 truncate">{player.alias || player.firstName}</p>
              </div>
              <div className="text-lg font-black text-blue-600">{player.racha}</div>
            </div>
          )}
        />

        {/* Top Players by Matches Played */}
        <LazyTopPlayersCard
          title="Top 8 Partidos Jugados"
          description="Jugadores con más partidos disputados."
          calculate={calculateMatchesPlayed}
          renderItem={(player: any, i: number) => (
            <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                  i === 0 ? "bg-yellow-100 text-yellow-700" :
                  i === 1 ? "bg-gray-200 text-gray-700" :
                  i === 2 ? "bg-amber-100 text-amber-700" :
                  "bg-white text-gray-400 border border-gray-200"
                )}>
                  {i + 1}
                </div>
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-700 text-xs overflow-hidden shrink-0">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.alias} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (player.alias || player.firstName).charAt(0).toUpperCase()
                  )}
                </div>
                <p className="font-bold text-gray-900 truncate">{player.alias || player.firstName}</p>
              </div>
              <div className="text-lg font-black text-purple-600">{player.matches}</div>
            </div>
          )}
        />

        {/* Top Players by Least Matches */}
        <LazyTopPlayersCard
          title="Top 8 Menos Partidos"
          description="Jugadores con menos partidos disputados."
          calculate={calculateLeastMatches}
          renderItem={(player: any, i: number) => (
            <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                  i === 0 ? "bg-yellow-100 text-yellow-700" :
                  i === 1 ? "bg-gray-200 text-gray-700" :
                  i === 2 ? "bg-amber-100 text-amber-700" :
                  "bg-white text-gray-400 border border-gray-200"
                )}>
                  {i + 1}
                </div>
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-700 text-xs overflow-hidden shrink-0">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.alias} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (player.alias || player.firstName).charAt(0).toUpperCase()
                  )}
                </div>
                <p className="font-bold text-gray-900 truncate">{player.alias || player.firstName}</p>
              </div>
              <div className="text-lg font-black text-orange-600">{player.matches}</div>
            </div>
          )}
        />
      </div>
      </div>

    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
  return <label className={cn("text-sm font-medium leading-none", className)}>{children}</label>;
}
