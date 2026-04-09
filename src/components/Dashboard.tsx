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
  Clock,
  Shield,
  Loader2,
  Trash2,
  ExternalLink
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
import { Player, Match, PlayerStat, Opponent, Season, Field } from '../types';
import { cn } from '@/lib/utils';
import { seedDatabase } from '../lib/seedData';
import { cleanupDatabase } from '../lib/cleanup';
import { toast } from 'sonner';

interface DashboardProps {
  players: Player[];
  matches: Match[];
  stats: PlayerStat[];
  opponents: Opponent[];
  seasons: Season[];
  fields: Field[];
}

export default function Dashboard({ players, matches, stats, opponents, seasons, fields }: DashboardProps) {
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [isCleaning, setIsCleaning] = React.useState(false);
  const [selectedSeason, setSelectedSeason] = React.useState<string>('all');
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
    const matchSeason = selectedSeason === 'all' || m.seasonId === selectedSeason;
    const matchType = selectedType === 'all' || m.type === selectedType;
    return matchSeason && matchType;
  }), [matches, selectedSeason, selectedType]);

  const filteredStats = React.useMemo(() => stats.filter(s => {
    const match = matches.find(m => m.id === s.matchId);
    const matchSeason = selectedSeason === 'all' || match?.seasonId === selectedSeason;
    const matchType = selectedType === 'all' || match?.type === selectedType;
    return matchSeason && matchType;
  }), [stats, matches, selectedSeason, selectedType]);

  const filteredPlayers = React.useMemo(() => {
    if (selectedSeason === 'all') return players;
    return players.filter(p => p.seasonIds?.includes(selectedSeason));
  }, [players, selectedSeason]);

  // 2. Cálculos de estadísticas
  const { completedMatches, scheduledMatches, matchesWithScores, wins, losses, draws, totalGoals, totalAssists, totalYellowCards, totalRedCards, totalGoalsAgainst } = React.useMemo(() => {
    const completed = filteredMatches.filter(m => m.status === 'completed');
    const scheduled = filteredMatches.filter(m => m.status === 'scheduled')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const withScores = completed.filter(m => m.scoreTeam != null && m.scoreOpponent != null);

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
      totalGoalsAgainst: withScores.reduce((acc, m) => acc + (m.scoreOpponent || 0), 0)
    };
  }, [filteredMatches, filteredStats]);

  // 3. Top Goleadores (filtrados)
  const playerGoalsMap = new Map<string, number>();
  filteredStats.forEach(s => {
    // Solo incluir jugadores que están inscritos en la temporada actual
    if (filteredPlayers.some(p => p.id === s.playerId)) {
      if (s.goals > 0) {
        playerGoalsMap.set(s.playerId, (playerGoalsMap.get(s.playerId) || 0) + s.goals);
      }
    }
  });

  const playerGoals = Array.from(playerGoalsMap.entries()).map(([playerId, goals]) => {
    const p = players.find(p => p.id === playerId);
    return {
      name: p ? (p.alias || `${p.firstName} ${p.lastName}`) : 'Desconocido',
      goals
    };
  }).sort((a, b) => b.goals - a.goals).slice(0, 5);

  // 4. Histórico vs Rivales (filtrado)
  const opponentStats = opponents.map(opp => {
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

  // 5. Cálculo de IR (Índice de Rendimiento)
  const teamWinRate = completedMatches.length > 0
    ? ((wins + draws * 0.5) / completedMatches.length) * 10
    : 0;

  const playerIR = filteredPlayers.map(p => {
    const pStats = filteredStats.filter(s => s.playerId === p.id);
    const matchesPlayed = pStats.length;
    if (matchesPlayed === 0) return { ...p, ir: 0, matchesPlayed: 0 };

    const totalGoals = pStats.reduce((acc, s) => acc + (s.goals || 0), 0);
    const totalAssists = pStats.reduce((acc, s) => acc + (s.assists || 0), 0);
    const totalYellow = pStats.reduce((acc, s) => acc + (s.yellowCards || 0), 0);
    const totalRed = pStats.reduce((acc, s) => acc + (s.redCards || 0), 0);

    // 1. Rendimiento Estadístico (Peso 40%)
    const statsScore = (totalGoals * 2.0 + totalAssists * 1.0 - totalYellow * 1.0 - totalRed * 3.0);
    const avgStats = statsScore / matchesPlayed;
    const normStats = Math.min(Math.max((avgStats + 2) * 2, 0), 10);

    // 2. Compromiso (Peso 40%)
    const attending = pStats.filter(s => s.attendance === 'attending').length;
    const notAttending = pStats.filter(s => s.attendance === 'notAttending').length;
    const noResponse = pStats.filter(s => s.attendance === 'noResponse').length;
    const totalInvited = attending + notAttending + noResponse;
    
    const attendanceScore = (attending * 1.0 + notAttending * (-0.5) + noResponse * (-1.0));
    const avgAttendance = totalInvited > 0 ? attendanceScore / totalInvited : 0;
    const normAttendance = Math.min(Math.max((avgAttendance + 1) * 5, 0), 10);

    // 3. Éxito Colectivo (Peso 20%)
    const ir = (normStats * 0.4) + (normAttendance * 0.4) + (teamWinRate * 0.2);
    return { ...p, ir: parseFloat(ir.toFixed(1)), matchesPlayed };
  }).filter(p => p.matchesPlayed > 0).sort((a, b) => b.ir - a.ir).slice(0, 8);

  const stats_cards = [
    { title: 'Victorias', value: wins, icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Empates', value: draws, icon: Activity, color: 'text-gray-600', bg: 'bg-gray-50' },
    { title: 'Derrotas', value: losses, icon: Target, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'Goles Favor', value: totalGoals, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Goles Contra', value: totalGoalsAgainst, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: 'Amarillas', value: totalYellowCards, icon: Target, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { title: 'Rojas', value: totalRedCards, icon: Target, color: 'text-red-700', bg: 'bg-red-100' },
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

          <div className="flex-1 md:w-48">
            <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1 mb-1 block">Filtrar por Temporada</Label>
            <Select value={selectedSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger className="bg-white border-none shadow-sm rounded-xl h-11">
                {/* TRUCO: Div contenedor y búsqueda manual del nombre de la temporada */}
                <div className="flex items-center truncate">
                  <Filter size={16} className="mr-2 text-gray-400 shrink-0" />
                  <SelectValue>
                    {selectedSeason === 'all' 
                      ? 'Histórico (Todas)' 
                      : seasons.find(s => s.id === selectedSeason)?.name || 'Temporada'}
                  </SelectValue>
                </div>
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
      <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-11 gap-2 md:gap-3">
        {stats_cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow h-full">
              <CardContent className="p-2 flex flex-col items-center justify-center gap-1">
                <div className={cn("p-1.5 rounded-lg", card.bg)}>
                  <card.icon className={card.color} size={14} />
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-gray-400 uppercase truncate">{card.title}</p>
                  <h3 className="text-lg font-black text-gray-900">{card.value}</h3>
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
                    {playerGoals.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'][index % 5]} />
                    ))}
                    <LabelList dataKey="goals" position="right" fill="#6B7280" fontSize={12} />
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

      {/* Top Players Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Top Players by IR */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Top 8 Jugadores por IR</CardTitle>
            <CardDescription>Índice de Rendimiento (Compromiso + Estadísticas).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {playerIR.slice(0, 8).map((player, i) => (
                <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-xs overflow-hidden">
                      {player.photoUrl ? (
                        <img src={player.photoUrl} alt={player.alias} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <p className="font-bold text-gray-900">{player.alias || `${player.firstName} ${player.lastName}`}</p>
                  </div>
                  <div className="text-lg font-black text-emerald-600">{player.ir}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Players by Matches Played */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Top 8 Partidos Jugados</CardTitle>
            <CardDescription>Jugadores con más partidos disputados.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredPlayers
                .map(p => ({
                  ...p,
                  matches: filteredStats.filter(s => s.playerId === p.id && s.attendance === 'attending').length
                }))
                .sort((a, b) => b.matches - a.matches)
                .slice(0, 8)
                .map((player, i) => (
                  <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-700 text-xs overflow-hidden">
                        {player.photoUrl ? (
                          <img src={player.photoUrl} alt={player.alias} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <p className="font-bold text-gray-900">{player.alias || `${player.firstName} ${player.lastName}`}</p>
                    </div>
                    <div className="text-lg font-black text-purple-600">{player.matches}</div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Players by Least Matches */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Top 8 Menos Partidos</CardTitle>
            <CardDescription>Jugadores con menos partidos disputados.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredPlayers
                .map(p => ({
                  ...p,
                  matches: filteredStats.filter(s => s.playerId === p.id && s.attendance === 'attending').length
                }))
                .sort((a, b) => a.matches - b.matches)
                .slice(0, 8)
                .map((player, i) => (
                  <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-700 text-xs overflow-hidden">
                        {player.photoUrl ? (
                          <img src={player.photoUrl} alt={player.alias} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <p className="font-bold text-gray-900">{player.alias || `${player.firstName} ${player.lastName}`}</p>
                    </div>
                    <div className="text-lg font-black text-orange-600">{player.matches}</div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
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
