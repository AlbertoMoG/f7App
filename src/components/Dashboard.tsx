import React from 'react';
import { 
  Trophy, 
  Users, 
  Calendar, 
  TrendingUp,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion } from 'motion/react';
import { Player, Match, PlayerStat, Opponent } from '../types';
import { cn } from '@/lib/utils';
import { seedDatabase } from '../lib/seedData';

interface DashboardProps {
  players: Player[];
  matches: Match[];
  stats: PlayerStat[];
  opponents: Opponent[];
}

export default function Dashboard({ players, matches, stats, opponents }: DashboardProps) {
  const [isSeeding, setIsSeeding] = React.useState(false);

  const handleSeed = async () => {
    setIsSeeding(true);
    await seedDatabase();
    setIsSeeding(false);
  };

  const completedMatches = matches.filter(m => m.status === 'completed');
  const wins = completedMatches.filter(m => (m.scoreTeam || 0) > (m.scoreOpponent || 0)).length;
  const totalGoals = stats.reduce((acc, s) => acc + (s.goals || 0), 0);
  const totalAssists = stats.reduce((acc, s) => acc + (s.assists || 0), 0);
  
  const avgAttendance = stats.length > 0 
    ? (stats.filter(s => s.attendance === 'attending').length / stats.length * 100).toFixed(1)
    : 0;

  // Top Scorers
  const playerGoals = players.map(p => ({
    name: `${p.firstName} ${p.lastName}`,
    goals: stats.filter(s => s.playerId === p.id).reduce((acc, s) => acc + (s.goals || 0), 0)
  })).sort((a, b) => b.goals - a.goals).slice(0, 5);

  // Performance Trend (last 5 matches)
  const trendData = completedMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-5).map(m => ({
    date: new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    score: m.scoreTeam
  }));

  // Historical vs Opponents
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
  }).filter(o => o.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

  const stats_cards = [
    { title: 'Victorias', value: wins, icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Goles Totales', value: totalGoals, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Asistencias', value: totalAssists, icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: 'Partidos Jugados', value: completedMatches.length, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Resumen del Equipo</h2>
          <p className="text-gray-500">Estadísticas generales y rendimiento histórico.</p>
        </div>
        {players.length === 0 && (
          <Button 
            onClick={handleSeed} 
            disabled={isSeeding}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
          >
            <Database size={18} className="mr-2" />
            {isSeeding ? 'Generando...' : 'Generar Datos de Prueba'}
          </Button>
        )}
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats_cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl", card.bg)}>
                  <card.icon className={card.color} size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.title}</p>
                  <h3 className="text-2xl font-bold">{card.value}</h3>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Goals Chart */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Máximos Goleadores</CardTitle>
            <CardDescription>Top 5 jugadores con más goles.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
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
          </CardContent>
        </Card>

        {/* Historical vs Opponents */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Histórico vs Rivales</CardTitle>
            <CardDescription>Resultados contra los equipos más frecuentes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {opponentStats.map((opp, i) => (
                <div key={opp.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1">
                    <p className="font-bold">{opp.name}</p>
                    <p className="text-xs text-gray-500">{opp.total} partidos jugados</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="text-center px-2">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">V</p>
                      <p className="font-bold">{opp.wins}</p>
                    </div>
                    <div className="text-center px-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">E</p>
                      <p className="font-bold">{opp.draws}</p>
                    </div>
                    <div className="text-center px-2">
                      <p className="text-[10px] font-bold text-red-500 uppercase">D</p>
                      <p className="font-bold">{opp.losses}</p>
                    </div>
                  </div>
                </div>
              ))}
              {opponentStats.length === 0 && (
                <div className="text-center py-8 text-gray-400 italic">
                  No hay suficientes datos históricos.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
