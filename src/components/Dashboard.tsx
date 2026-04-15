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
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Player, Match, PlayerStat, Opponent, Season, Field, PlayerSeason, Injury } from '../types';
import { cn } from '@/lib/utils';
import { seedDatabase } from '../lib/seedData';
import { cleanupDatabase } from '../lib/cleanup';
import { toast } from 'sonner';
import { calculatePlayerRating } from '../lib/ratingSystem';
import { LazyTopPlayersCard } from './LazyTopPlayersCard';

interface DashboardProps {
  players: Player[];
  playerSeasons: PlayerSeason[];
  matches: Match[];
  stats: PlayerStat[];
  opponents: Opponent[];
  seasons: Season[];
  fields: Field[];
  injuries: Injury[];
  globalSeasonId: string;
}

export default function Dashboard({ players, playerSeasons, matches, stats, opponents, seasons, fields, injuries, globalSeasonId }: DashboardProps) {
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [isCleaning, setIsCleaning] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<string>('all');

  const handleSeed = async () => {
    setIsSeeding(true);
    await seedDatabase();
    setIsSeeding(false);
  };

  const handleCleanup = async () => {
    try {
      setIsCleaning(true);
      const { updatesCount, deletesCount } = await cleanupDatabase();
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

  // 4. Histórico vs Rivales (filtrado)
  const opponentStats = React.useMemo(() => {
    return opponents.map(opp => {
      const vsOppMatches = completedMatches.filter(m => m.opponentId === opp.id && m.scoreTeam != null && m.scoreOpponent != null);
      const vsWins = vsOppMatches.filter(m => m.scoreTeam! > m.scoreOpponent!).length;
      const vsLosses = vsOppMatches.filter(m => m.scoreTeam! < m.scoreOpponent!).length;
      const vsDraws = vsOppMatches.filter(m => m.scoreTeam! === m.scoreOpponent!).length;

      return {
        name: opp.name,
        wins: vsWins,
        losses: vsLosses,
        draws: vsDraws,
        total: vsOppMatches.length
      };
    }).filter(o => o.total > 0).sort((a, b) => b.total - a.total);
  }, [opponents, completedMatches]);

  // 5. Cálculo de Baremo (Nota Final)
  const playerBaremo = React.useMemo(() => {
    return filteredPlayers.map(p => {
      const rating = calculatePlayerRating(matches, injuries, stats, p, globalSeasonId);
      return { ...p, rating: parseFloat(rating.notaFinal.toFixed(2)) };
    }).sort((a, b) => b.rating - a.rating).slice(0, 8);
  }, [filteredPlayers, matches, injuries, stats, globalSeasonId]);

  // Memoized calculate functions for LazyTopPlayersCard
  const calculateBaremo = React.useCallback(() => playerBaremo, [playerBaremo]);
  const calculateGoals = React.useCallback(() => playerGoals, [playerGoals]);
  
  const calculateMaxStreak = React.useCallback(() => {
    return filteredPlayers
      .map(p => {
        const rating = calculatePlayerRating(matches, injuries, stats, p, globalSeasonId);
        return { ...p, racha: rating.rachaMaxima };
      })
      .sort((a, b) => b.racha - a.racha)
      .slice(0, 8);
  }, [filteredPlayers, matches, injuries, stats, globalSeasonId]);

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

  const stats_cards = [
    { title: 'Victorias', value: wins, icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Empates', value: draws, icon: Activity, color: 'text-gray-600', bg: 'bg-gray-50' },
    { title: 'Derrotas', value: losses, icon: Target, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'Racha Victorias', value: winStreak, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Racha Empates', value: drawStreak, icon: Activity, color: 'text-gray-600', bg: 'bg-gray-50' },
    { title: 'Racha Derrotas', value: lossStreak, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'Goles Favor', value: totalGoals, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Goles Contra', value: totalGoalsAgainst, icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: 'Amarillas', value: totalYellowCards, icon: Target, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { title: 'Rojas', value: totalRedCards, icon: Target, color: 'text-red-700', bg: 'bg-red-100' },
    { title: 'Lesionados', value: currentlyInjured, icon: Bandage, color: 'text-red-500', bg: 'bg-red-50' },
    { title: 'Jugados', value: completedMatches.length, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Programados', value: scheduledMatches.length, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: 'Jugadores', value: filteredPlayers.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: 'Asistencias', value: totalAssists, icon: Users, color: 'text-pink-600', bg: 'bg-pink-50' },
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3">
        {stats_cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 hover:bg-emerald-50/30 transition-all h-full cursor-default group">
              <CardContent className="p-3 flex items-center justify-between gap-2 h-full">
                <div className="flex flex-col items-start gap-1.5">
                  <div className={cn("p-1.5 rounded-lg transition-colors", card.bg, "group-hover:bg-white")}>
                    <card.icon className={card.color} size={16} />
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase leading-tight">{card.title}</p>
                </div>
                <div className="text-right">
                  <h3 className={cn("text-2xl font-black", card.color)}>{card.value}</h3>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

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

      {/* Top Players Stats */}
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

      {/* Upcoming Matches */}
      <Card className="border-none shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="text-emerald-600" size={20} />
            Próximos Partidos
          </CardTitle>
          <CardDescription>Partidos programados próximamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scheduledMatches.length === 0 ? (
              <p className="col-span-full text-center py-8 text-gray-400 italic text-sm">No hay partidos programados.</p>
            ) : (
              scheduledMatches.slice(0, 6).map(match => {
                const opponent = opponents.find(o => o.id === match.opponentId);
                const season = seasons.find(s => s.id === match.seasonId);
                return (
                  <div key={match.id} className="flex flex-col p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-20 h-20 bg-gray-50 rounded-xl shadow-inner flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                        {opponent?.shieldUrl ? (
                          <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-contain p-3" referrerPolicy="no-referrer" />
                        ) : (
                          <Shield size={40} className="text-gray-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-lg text-gray-900 truncate">{opponent?.name || 'Rival desconocido'}</p>
                        <p className="text-xs font-bold text-emerald-600 uppercase mt-1">
                          {season?.name || 'Sin temporada'}
                          {season?.division && <span className="text-gray-400 ml-1">• {season.division}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        <span>{format(new Date(match.date), "d 'de' MMMM, HH:mm", { locale: es })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target size={16} className="text-gray-400" />
                        <span className="truncate flex items-center">
                          {match.fieldId ? (
                            (() => {
                              const field = fields.find(f => f.id === match.fieldId);
                              return field?.location ? (
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(field.location)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition-colors font-bold border border-emerald-100 text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="truncate">{field.name}</span>
                                  <ExternalLink size={10} className="shrink-0" />
                                </a>
                              ) : (
                                <span className="font-bold text-gray-700 truncate">{field?.name || 'Campo desconocido'}</span>
                              );
                            })()
                          ) : (
                            <span className="text-gray-500 truncate">{match.location || 'Campo por confirmar'}</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity size={16} className="text-gray-400" />
                        <span className="capitalize">{match.type} {match.round ? `- Jornada ${match.round}` : ''}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
  return <label className={cn("text-sm font-medium leading-none", className)}>{children}</label>;
}
