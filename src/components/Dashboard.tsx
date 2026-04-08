import React from 'react';
import {
  Trophy,
  Users,
  Calendar,
  TrendingUp,
  Database,
  Target,
  Activity,
  Filter,
  Clock
} from 'lucide-react';
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
  Pie
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { motion } from 'motion/react';
import { Player, Match, PlayerStat, Opponent, Season } from '../types';
import { cn } from '@/lib/utils';
import { seedDatabase } from '../lib/seedData';

interface DashboardProps {
  players: Player[];
  matches: Match[];
  stats: PlayerStat[];
  opponents: Opponent[];
  seasons: Season[];
}

export default function Dashboard({ players, matches, stats, opponents, seasons }: DashboardProps) {
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [selectedSeason, setSelectedSeason] = React.useState<string>('all');

  const handleSeed = async () => {
    setIsSeeding(true);
    await seedDatabase();
    setIsSeeding(false);
  };

  // 1. Filtrar datos por temporada
  const filteredMatches = selectedSeason === 'all'
    ? matches
    : matches.filter(m => m.seasonId === selectedSeason);

  const filteredStats = selectedSeason === 'all'
    ? stats
    : stats.filter(s => {
        const match = matches.find(m => m.id === s.matchId);
        return match?.seasonId === selectedSeason;
      });

  const filteredPlayers = selectedSeason === 'all'
    ? players
    : players.filter(p => p.seasonIds?.includes(selectedSeason));

  // 2. Cálculos de estadísticas
  const completedMatches = filteredMatches.filter(m => m.status === 'completed');
  const scheduledMatches = filteredMatches.filter(m => m.status === 'scheduled');

  const wins = completedMatches.filter(m => (m.scoreTeam || 0) > (m.scoreOpponent || 0)).length;
  const losses = completedMatches.filter(m => (m.scoreTeam || 0) < (m.scoreOpponent || 0)).length;
  const draws = completedMatches.filter(m => (m.scoreTeam || 0) === (m.scoreOpponent || 0)).length;

  const totalGoals = filteredStats.reduce((acc, s) => acc + (s.goals || 0), 0);
  const totalAssists = filteredStats.reduce((acc, s) => acc + (s.assists || 0), 0);

  // 3. Top Goleadores (filtrados)
  const playerGoals = filteredPlayers.map(p => ({
    name: p.alias || `${p.firstName} ${p.lastName}`,
    goals: filteredStats.filter(s => s.playerId === p.id).reduce((acc, s) => acc + (s.goals || 0), 0)
  })).filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 5);

  // 4. Histórico vs Rivales (filtrado)
  const opponentStats = opponents.map(opp => {
    const vsOppMatches = completedMatches.filter(m => m.opponentId === opp.id);
    const vsWins = vsOppMatches.filter(m => (m.scoreTeam || 0) > (m.scoreOpponent || 0)).length;
    const vsLosses = vsOppMatches.filter(m => (m.scoreTeam || 0) < (m.scoreOpponent || 0)).length;
    const vsDraws = vsOppMatches.filter(m => (m.scoreTeam || 0) === (m.scoreOpponent || 0)).length;

    return {
      name: opp.name,
      wins: vsWins,
      losses: vsLosses,
      draws: vsDraws,
      total: vsOppMatches.length
    };
  }).filter(o => o.total > 0).sort((a, b) => b.total - a.total);

  const stats_cards = [
    { title: 'Victorias', value: wins, icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Empates', value: draws, icon: Activity, color: 'text-gray-600', bg: 'bg-gray-50' },
    { title: 'Derrotas', value: losses, icon: Target, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'Goles', value: totalGoals, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
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

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Resumen del Equipo</h2>
          <p className="text-gray-500">Estadísticas generales y rendimiento del equipo.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:w-64">
            <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1 mb-1 block">Filtrar por Temporada</Label>
            <Select value={selectedSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger className="bg-white border-none shadow-sm rounded-xl h-11">
                <Filter size={16} className="mr-2 text-gray-400" />
                <SelectValue placeholder="Todas las temporadas" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-xl">
                <SelectItem value="all">Histórico (Todas)</SelectItem>
                {seasons.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {players.length === 0 && (
            <Button
              onClick={handleSeed}
              disabled={isSeeding}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11"
            >
              <Database size={18} className="mr-2" />
              {isSeeding ? 'Generando...' : 'Datos de Prueba'}
            </Button>
          )}
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 md:gap-6">
        {stats_cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow h-full">
              <CardContent className="p-4 md:p-6 flex items-center gap-3 md:gap-4">
                <div className={cn("p-2 md:p-3 rounded-xl md:rounded-2xl shrink-0", card.bg)}>
                  <card.icon className={card.color} size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase truncate">{card.title}</p>
                  <h3 className="text-lg md:text-2xl font-black">{card.value}</h3>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Win Rate Pie Chart */}
        <Card className="border-none shadow-sm lg:col-span-1">
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
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
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

        {/* Goals Chart */}
        <Card className="border-none shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Máximos Goleadores</CardTitle>
            <CardDescription>Top 5 jugadores en la temporada seleccionada.</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            {playerGoals.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={playerGoals} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="goals" radius={[0, 4, 4, 0]} barSize={20}>
                    {playerGoals.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'][index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">
                No hay goles registrados en esta temporada.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historical vs Opponents */}
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Histórico vs Rivales</CardTitle>
            <CardDescription>Resultados detallados contra cada equipo.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opponentStats.map((opp, i) => (
              <motion.div
                key={opp.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-emerald-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 truncate">{opp.name}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{opp.total} partidos</p>
                </div>
                <div className="flex gap-3 ml-4">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-emerald-600 uppercase">V</p>
                    <p className="text-sm font-black">{opp.wins}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-gray-400 uppercase">E</p>
                    <p className="text-sm font-black">{opp.draws}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-red-500 uppercase">D</p>
                    <p className="text-sm font-black">{opp.losses}</p>
                  </div>
                </div>
              </motion.div>
            ))}
            {opponentStats.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400 italic bg-gray-50 rounded-2xl">
                No hay datos disponibles para la temporada seleccionada.
              </div>
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
