import React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ShieldCheck,
  AlertCircle,
  Users, 
  Calendar,
  Search,
  Filter,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger, 
  TooltipProvider 
} from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend
} from 'recharts';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Player, Match, PlayerStat, Season, Opponent, PlayerSeason } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import PlayerCumulativeAttendanceChart from './PlayerCumulativeAttendanceChart';

interface AttendanceTrackerProps {
  players: Player[];
  playerSeasons: PlayerSeason[];
  matches: Match[];
  stats: PlayerStat[];
  seasons: Season[];
  opponents: Opponent[];
  globalSeasonId: string;
  onUpdateAttendance?: (playerId: string, matchId: string, status: string) => Promise<void>;
}

export default function AttendanceTracker({ 
  players, 
  playerSeasons,
  matches, 
  stats, 
  seasons, 
  opponents,
  globalSeasonId,
  onUpdateAttendance
}: AttendanceTrackerProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [selectedPlayer, setSelectedPlayer] = React.useState<Player | null>(null);
  const [editingAttendance, setEditingAttendance] = React.useState<{playerId: string, matchId: string, status: string} | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [playerDetailView, setPlayerDetailView] = React.useState<'summary' | 'regularity'>('summary');

  // Filtrar partidos por temporada y tipo
  const seasonMatches = React.useMemo(() => {
    return matches
      .filter(m => {
        const seasonMatch = globalSeasonId === 'all' || m.seasonId === globalSeasonId;
        const typeMatch = typeFilter === 'all' || m.type === typeFilter;
        return seasonMatch && typeMatch;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matches, globalSeasonId, typeFilter]);

  // Filtrar jugadores por temporada y búsqueda
  const filteredPlayers = React.useMemo(() => {
    let result = players;
    if (globalSeasonId !== 'all') {
      const seasonPlayerIds = playerSeasons
        .filter(ps => ps.seasonId === globalSeasonId)
        .map(ps => ps.playerId);
      result = players.filter(p => seasonPlayerIds.includes(p.id));
    }

    return result
      .filter(p => 
        p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.alias && p.alias.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => (a.alias || a.firstName).localeCompare(b.alias || b.firstName));
  }, [players, playerSeasons, globalSeasonId, searchTerm]);

  // Agrupar por posición
  const playersByPosition = React.useMemo(() => {
    const order = ['Portero', 'Defensa', 'Medio', 'Delantero'];
    const groups: Record<string, Player[]> = {};
    
    order.forEach(pos => groups[pos] = []);
    
    filteredPlayers.forEach(p => {
      if (groups[p.position]) {
        groups[p.position].push(p);
      } else {
        if (!groups['Otros']) groups['Otros'] = [];
        groups['Otros'].push(p);
      }
    });
    
    return groups;
  }, [filteredPlayers]);

  const getAttendanceStatus = (playerId: string, matchId: string) => {
    const stat = stats.find(s => s.playerId === playerId && s.matchId === matchId);
    if (!stat) return 'noResponse';
    return stat.attendance; // 'attending', 'notAttending', 'noResponse'
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'attending':
        return <CheckCircle2 className="text-emerald-500" size={16} />;
      case 'notAttending':
        return <XCircle className="text-red-500" size={16} />;
      case 'justified':
        return <ShieldCheck className="text-blue-500" size={16} />;
      case 'doubtful':
        return <AlertCircle className="text-amber-500" size={16} />;
      case 'noResponse':
      default:
        return <HelpCircle className="text-gray-300" size={16} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'attending': return 'Asistió';
      case 'notAttending': return 'No asistió';
      case 'justified': return 'Justificado';
      case 'doubtful': return 'Duda';
      case 'noResponse': return 'Sin respuesta';
      default: return 'Desconocido';
    }
  };

  const getPlayerStats = (playerId: string) => {
    const playerStatsObj = seasonMatches.map(m => stats.find(s => s.playerId === playerId && s.matchId === m.id));
    const attending = playerStatsObj.filter(s => s?.attendance === 'attending').length;
    const notAttending = playerStatsObj.filter(s => s?.attendance === 'notAttending').length;
    const justified = playerStatsObj.filter(s => s?.attendance === 'justified').length;
    const doubtful = playerStatsObj.filter(s => s?.attendance === 'doubtful').length;
    const historicalDoubtful = playerStatsObj.filter(s => s?.wasDoubtful || s?.attendance === 'doubtful').length;
    
    const noResponse = seasonMatches.length - (attending + notAttending + justified + doubtful);
    const total = seasonMatches.length;

    return { attending, notAttending, justified, doubtful, historicalDoubtful, noResponse, total };
  };

  const handleUpdateStatus = async (status: string) => {
    if (!editingAttendance || !onUpdateAttendance) return;
    
    setIsUpdating(true);
    try {
      await onUpdateAttendance(editingAttendance.playerId, editingAttendance.matchId, status);
      setEditingAttendance(null);
    } catch (error) {
      console.error("Error updating attendance:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const chartData = selectedPlayer ? (() => {
    const s = getPlayerStats(selectedPlayer.id);
    return [
      { name: 'Asistió', value: s.attending, color: '#10b981' },
      { name: 'Justificado', value: s.justified, color: '#3b82f6' },
      { name: 'No asistió', value: s.notAttending, color: '#ef4444' },
      { name: 'Duda', value: s.doubtful, color: '#f59e0b' },
      { name: 'Sin respuesta', value: s.noResponse, color: '#d1d5db' },
    ].filter(d => d.value > 0);
  })() : [];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Control de Asistencia</h2>
            <p className="text-gray-500">Visualiza quién ha asistido a cada partido de la temporada.</p>
          </div>
        </header>

        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
          <CardHeader className="pb-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input 
                    placeholder="Buscar jugador..." 
                    className="pl-10 bg-gray-50 border-none rounded-xl h-11"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full md:w-40 bg-gray-50 border-none rounded-xl h-11 font-medium">
                    <SelectValue>
                      {typeFilter === 'all' ? 'Todos los tipos' : 
                       typeFilter === 'league' ? 'Liga' : 
                       typeFilter === 'cup' ? 'Copa' : 'Amistoso'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-xl">
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="league">Liga</SelectItem>
                    <SelectItem value="cup">Copa</SelectItem>
                    <SelectItem value="friendly">Amistoso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-emerald-500" size={14} /> Asistió
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="text-blue-500" size={14} /> Justificado
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="text-amber-500" size={14} /> Duda
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="text-red-500" size={14} /> No Asistió
                </div>
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="text-gray-300" size={14} /> Sin Respuesta
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 mt-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-y border-gray-100">
                    <th className="sticky left-0 z-10 bg-gray-50/50 p-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[180px] border-r border-gray-100">
                      Jugador
                    </th>
                    {seasonMatches.map(match => {
                      const opponent = opponents.find(o => o.id === match.opponentId);
                      return (
                        <th key={match.id} className="p-2 text-center min-w-[80px] border-r border-gray-100 last:border-r-0">
                          <Tooltip>
                            <TooltipTrigger render={
                              <div className="flex flex-col items-center gap-0.5 cursor-help">
                                <span className="text-[9px] font-black text-gray-900 uppercase leading-none">
                                  {format(new Date(match.date), 'dd/MM')}
                                </span>
                                {match.round && (
                                  <span className="text-[8px] font-bold text-emerald-600 uppercase leading-none">
                                    {match.type === 'league' ? `J.${match.round}` : match.round}
                                  </span>
                                )}
                                <div className="w-6 h-6 rounded-md bg-white border border-gray-100 flex items-center justify-center shadow-sm mt-0.5">
                                  {opponent?.shieldUrl ? (
                                    <img src={opponent.shieldUrl} alt={opponent.name} className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Calendar size={10} className="text-gray-300" />
                                  )}
                                </div>
                              </div>
                            } />
                            <TooltipContent className="p-3 bg-gray-900 text-white rounded-xl border-none shadow-xl">
                              <p className="font-bold text-xs">{opponent?.name || 'Rival'}</p>
                              <p className="text-[10px] text-gray-400">{format(new Date(match.date), 'PPPP', { locale: es })}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="bg-white/10 text-white border-none text-[9px]">
                                  {match.type === 'league' ? 'Liga' : match.type === 'cup' ? 'Copa' : 'Amistoso'}
                                </Badge>
                                {match.round && (
                                  <span className="text-[9px] font-bold text-emerald-400">
                                    {match.type === 'league' ? `Jornada ${match.round}` : match.round}
                                  </span>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(playersByPosition).map(([position, positionPlayers]) => (
                    <React.Fragment key={position}>
                      {positionPlayers.length > 0 && (
                        <>
                          <tr className="bg-gray-50/30">
                            <td 
                              colSpan={seasonMatches.length + 1} 
                              className="px-4 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100"
                            >
                              {position}
                            </td>
                          </tr>
                          {positionPlayers.map(player => {
                            const pStats = getPlayerStats(player.id);
                            return (
                              <tr key={player.id} className="border-b border-gray-50 hover:bg-emerald-50/20 transition-colors group">
                                <td 
                                  className="sticky left-0 z-10 bg-white p-2 border-r border-gray-100 group-hover:bg-emerald-50/20 cursor-pointer"
                                  onClick={() => setSelectedPlayer(player)}
                                >
                                  <Tooltip>
                                    <TooltipTrigger render={
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center border border-gray-100 shrink-0">
                                          <span className="text-[10px] font-black text-emerald-600">{player.number}</span>
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-gray-900 truncate">
                                            {player.alias || `${player.firstName} ${player.lastName}`}
                                          </p>
                                        </div>
                                      </div>
                                    } />
                                    <TooltipContent side="right" className="p-3 bg-white border border-gray-100 shadow-xl rounded-2xl min-w-[150px]">
                                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Resumen Asistencia</p>
                                      <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] font-bold text-gray-500">Asistidos:</span>
                                          <span className="text-[10px] font-black text-emerald-600">{pStats.attending}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] font-bold text-gray-500">Justificados:</span>
                                          <span className="text-[10px] font-black text-blue-500">{pStats.justified}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] font-bold text-gray-500">No asistidos:</span>
                                          <span className="text-[10px] font-black text-red-500">{pStats.notAttending}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] font-bold text-gray-500">Sin respuesta:</span>
                                          <span className="text-[10px] font-black text-gray-400">{pStats.noResponse}</span>
                                        </div>
                                        <div className="pt-1.5 mt-1.5 border-t border-gray-50 flex justify-between items-center">
                                          <span className="text-[10px] font-black text-gray-900 uppercase">Total:</span>
                                          <span className="text-[10px] font-black text-gray-900">{pStats.total}</span>
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </td>
                                {seasonMatches.map(match => {
                                  const status = getAttendanceStatus(player.id, match.id);
                                  return (
                                    <td 
                                      key={`${player.id}-${match.id}`} 
                                      className={cn(
                                        "p-2 text-center border-r border-gray-50 last:border-r-0 transition-colors",
                                        status === 'attending' ? "bg-emerald-50/30" :
                                        status === 'notAttending' ? "bg-red-50/30" :
                                        status === 'justified' ? "bg-blue-50/30" :
                                        status === 'doubtful' ? "bg-amber-50/30" :
                                        "bg-transparent"
                                      )}
                                    >
                                      <Tooltip>
                                        <TooltipTrigger onClick={() => setEditingAttendance({ playerId: player.id, matchId: match.id, status })}>
                                          <div 
                                            className={cn(
                                              "inline-flex items-center justify-center w-8 h-8 rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm border border-transparent",
                                              status === 'attending' ? "bg-emerald-100 border-emerald-200" :
                                              status === 'notAttending' ? "bg-red-100 border-red-200" :
                                              status === 'justified' ? "bg-blue-100 border-blue-200" :
                                              status === 'doubtful' ? "bg-amber-100 border-amber-200" :
                                              "bg-gray-50 border-gray-100 hover:bg-gray-100"
                                            )}
                                          >
                                            {renderStatusIcon(status)}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="text-[10px] font-bold p-2 bg-gray-900 text-white rounded-lg border-none shadow-xl">
                                          <div className="flex flex-col gap-1">
                                            <p>{player.alias || player.firstName} - {format(new Date(match.date), 'dd/MM')}</p>
                                            <p className="text-emerald-400">{getStatusLabel(status)}</p>
                                            <p className="text-gray-400 text-[8px] italic">Click para cambiar</p>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </td>
                                  );
                                })}
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              </table>
            </div>
            {filteredPlayers.length === 0 && (
              <div className="py-20 text-center">
                <Users className="mx-auto text-gray-200 mb-4" size={48} />
                <p className="text-gray-400 font-medium">No se encontraron jugadores.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
          <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl p-0 overflow-hidden bg-white">
            <DialogHeader className="p-6 bg-emerald-600 text-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black">
                  {selectedPlayer?.number}
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold">
                    {selectedPlayer?.alias || `${selectedPlayer?.firstName} ${selectedPlayer?.lastName}`}
                  </DialogTitle>
                  <DialogDescription className="text-emerald-100 font-medium">
                    {selectedPlayer?.position} • Estadísticas de Asistencia
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="p-6 space-y-6">
              <div className="flex bg-gray-100 p-1 rounded-2xl w-full">
                <button
                  onClick={() => setPlayerDetailView('summary')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    playerDetailView === 'summary' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  Resumen
                </button>
                <button
                  onClick={() => setPlayerDetailView('regularity')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    playerDetailView === 'regularity' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  Regularidad
                </button>
              </div>

              {playerDetailView === 'summary' ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-emerald-50 p-3 rounded-2xl text-center">
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Asistió</p>
                      <p className="text-xl font-black text-emerald-700">{selectedPlayer && getPlayerStats(selectedPlayer.id).attending}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-2xl text-center">
                      <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Justif.</p>
                      <p className="text-xl font-black text-blue-700">{selectedPlayer && getPlayerStats(selectedPlayer.id).justified}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-2xl text-center">
                      <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">No Asistió</p>
                      <p className="text-xl font-black text-red-700">{selectedPlayer && getPlayerStats(selectedPlayer.id).notAttending}</p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-2xl text-center">
                      <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1">Ha sido Duda</p>
                      <p className="text-xl font-black text-amber-700">{selectedPlayer && getPlayerStats(selectedPlayer.id).historicalDoubtful}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl text-center">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Sin Resp.</p>
                      <p className="text-xl font-black text-gray-600">{selectedPlayer && getPlayerStats(selectedPlayer.id).noResponse}</p>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <RechartsLegend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="h-64 w-full">
                  {selectedPlayer && (
                    <PlayerCumulativeAttendanceChart 
                      playerId={selectedPlayer.id} 
                      matches={seasonMatches}
                      stats={stats}
                    />
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Partidos</p>
                <p className="text-lg font-black text-gray-900">{selectedPlayer && getPlayerStats(selectedPlayer.id).total}</p>
              </div>

              <div className="mt-2">
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-12 font-bold shadow-lg shadow-emerald-200"
                  onClick={() => selectedPlayer && navigate(`/players/${selectedPlayer.id}`)}
                >
                  Ver Perfil Completo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingAttendance} onOpenChange={(open) => !open && setEditingAttendance(null)}>
          <DialogContent className="sm:max-w-[300px] rounded-3xl border-none shadow-2xl p-6 bg-white">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg font-bold text-center">Cambiar Asistencia</DialogTitle>
              <DialogDescription className="text-center text-xs">
                {editingAttendance && players.find(p => p.id === editingAttendance.playerId)?.alias} - {editingAttendance && format(new Date(matches.find(m => m.id === editingAttendance.matchId)?.date || ''), 'dd/MM')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-2">
              <Button 
                variant="outline" 
                className={cn("justify-start gap-3 h-12 rounded-xl border-gray-100 font-bold", editingAttendance?.status === 'attending' && "bg-emerald-50 border-emerald-200 text-emerald-700")}
                onClick={() => handleUpdateStatus('attending')}
                disabled={isUpdating}
              >
                <CheckCircle2 className="text-emerald-500" size={18} /> Asistió
              </Button>
              <Button 
                variant="outline" 
                className={cn("justify-start gap-3 h-12 rounded-xl border-gray-100 font-bold", editingAttendance?.status === 'justified' && "bg-blue-50 border-blue-200 text-blue-700")}
                onClick={() => handleUpdateStatus('justified')}
                disabled={isUpdating}
              >
                <ShieldCheck className="text-blue-500" size={18} /> Justificado
              </Button>
              <Button 
                variant="outline" 
                className={cn("justify-start gap-3 h-12 rounded-xl border-gray-100 font-bold", editingAttendance?.status === 'doubtful' && "bg-amber-50 border-amber-200 text-amber-700")}
                onClick={() => handleUpdateStatus('doubtful')}
                disabled={isUpdating}
              >
                <AlertCircle className="text-amber-500" size={18} /> Duda
              </Button>
              <Button 
                variant="outline" 
                className={cn("justify-start gap-3 h-12 rounded-xl border-gray-100 font-bold", editingAttendance?.status === 'notAttending' && "bg-red-50 border-red-200 text-red-700")}
                onClick={() => handleUpdateStatus('notAttending')}
                disabled={isUpdating}
              >
                <XCircle className="text-red-500" size={18} /> No Asistió
              </Button>
              <Button 
                variant="outline" 
                className={cn("justify-start gap-3 h-12 rounded-xl border-gray-100 font-bold", editingAttendance?.status === 'noResponse' && "bg-gray-50 border-gray-200 text-gray-500")}
                onClick={() => handleUpdateStatus('noResponse')}
                disabled={isUpdating}
              >
                <HelpCircle className="text-gray-300" size={18} /> Sin Respuesta
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
