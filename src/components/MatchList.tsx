import React from 'react';
import { 
  Plus, 
  Calendar, 
  Search, 
  Filter, 
  ChevronRight,
  Trophy,
  Users,
  ShieldAlert,
  Edit2,
  Trash2,
  MoreVertical,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
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
import { Player, Match, PlayerStat, Season, Opponent, Attendance, MatchType, Team } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface MatchListProps {
  team: Team | null;
  players: Player[];
  matches: Match[];
  stats: PlayerStat[];
  seasons: Season[];
  opponents: Opponent[];
  onAddMatch: (match: Omit<Match, 'id'>) => void;
  onUpdateMatch: (match: Match) => void;
  onDeleteMatch: (id: string) => void;
  onUpdateStats: (stats: PlayerStat[]) => void;
}

/**
 * Componente para mostrar y gestionar la lista de partidos.
 * Permite filtrar, crear nuevos partidos y registrar estadísticas.
 */
export default function MatchList({ 
  team,
  players, 
  matches, 
  stats, 
  seasons, 
  opponents, 
  onAddMatch, 
  onUpdateMatch, 
  onDeleteMatch,
  onUpdateStats
}: MatchListProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [selectedMatch, setSelectedMatch] = React.useState<Match | null>(null);
  const [filterOpponent, setFilterOpponent] = React.useState<string>('all');
  const [filterSeason, setFilterSeason] = React.useState<string>('all');

  const [filterType, setFilterType] = React.useState<string>('all');
  const [newMatchType, setNewMatchType] = React.useState<MatchType>('friendly');
  const [newMatchSeason, setNewMatchSeason] = React.useState<string>('');
  const [newMatchOpponent, setNewMatchOpponent] = React.useState<string>('');
  const [newMatchIsHome, setNewMatchIsHome] = React.useState<string>('true');

  // Reset state when dialog opens/closes
  const handleOpenChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (open) {
      // Initialize with defaults if not set
      const currentYear = new Date().getFullYear().toString();
      const currentSeason = seasons.find(s => s.name.includes(currentYear))?.id || (seasons.length > 0 ? seasons[0].id : '');
      setNewMatchSeason(currentSeason);
      
      const firstOpponent = opponents.length > 0 ? opponents[0].id : '';
      setNewMatchOpponent(firstOpponent);
      
      setNewMatchType('friendly');
      setNewMatchIsHome('true');
    } else {
      // Clear state when closing
      setNewMatchSeason('');
      setNewMatchOpponent('');
      setNewMatchType('friendly');
      setNewMatchIsHome('true');
    }
  };

  // Filtrar y ordenar partidos por fecha descendente
  const filteredMatches = matches.filter(m => {
    const matchOpponent = filterOpponent === 'all' || m.opponentId === filterOpponent;
    const matchSeason = filterSeason === 'all' || m.seasonId === filterSeason;
    const matchTypeFilter = filterType === 'all' || m.type === filterType;
    return matchOpponent && matchSeason && matchTypeFilter;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  /**
   * Maneja la creación de un nuevo partido desde el formulario.
   */
  const handleAddMatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const round = formData.get('round') as string;
    const matchData: Omit<Match, 'id'> = {
      seasonId: newMatchSeason,
      opponentId: newMatchOpponent,
      date: formData.get('date') as string,
      status: 'scheduled',
      type: newMatchType,
      isHome: newMatchIsHome === 'true',
    };
    if (round) {
      matchData.round = round;
    }
    onAddMatch(matchData);
    handleOpenChange(false);
  };

  const handleUpdateStats = (matchId: string, playerStats: Record<string, Partial<PlayerStat>>) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const updatedStats: PlayerStat[] = players.map(p => {
      const existing = stats.find(s => s.matchId === matchId && s.playerId === p.id);
      const updates = playerStats[p.id] || {};
      
      return {
        id: existing?.id || '',
        playerId: p.id,
        matchId: matchId,
        seasonId: match.seasonId,
        attendance: (updates.attendance as Attendance) || existing?.attendance || 'noResponse',
        goals: updates.goals ?? existing?.goals ?? 0,
        assists: updates.assists ?? existing?.assists ?? 0,
        yellowCards: updates.yellowCards ?? existing?.yellowCards ?? 0,
        redCards: updates.redCards ?? existing?.redCards ?? 0,
      };
    });

    onUpdateStats(updatedStats);
    
    // Also update match score if provided
    const scoreTeam = Object.values(playerStats).reduce((acc, s) => acc + (s.goals || 0), 0);
    // For simplicity, we might want a separate input for opponent score
    // Let's assume the user provides it in the dialog
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Historial de Partidos</h2>
          <p className="text-gray-500">Registra resultados y estadísticas individuales.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger render={<Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6" />}>
            <Plus size={18} className="mr-2" />
            Programar Partido
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Nuevo Partido</DialogTitle>
              <DialogDescription>Añade un nuevo encuentro al calendario.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddMatch} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Temporada</Label>
                <Select value={newMatchSeason} onValueChange={setNewMatchSeason}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecciona temporada" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Rival</Label>
                <Select value={newMatchOpponent} onValueChange={setNewMatchOpponent}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecciona rival" />
                  </SelectTrigger>
                  <SelectContent>
                    {opponents.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Partido</Label>
                <Select value={newMatchType} onValueChange={(v: MatchType) => setNewMatchType(v)} required>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly" label="Amistoso">Amistoso</SelectItem>
                    <SelectItem value="league" label="Liga">Liga</SelectItem>
                    <SelectItem value="cup" label="Copa">Copa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Condición</Label>
                <Select value={newMatchIsHome} onValueChange={setNewMatchIsHome} required>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecciona condición" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true" label="Local">Local</SelectItem>
                    <SelectItem value="false" label="Visitante">Visitante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newMatchType === 'league' && (
                <div className="space-y-2">
                  <Label>Jornada</Label>
                  <Input name="round" placeholder="Ej: Jornada 5" required className="rounded-xl" />
                </div>
              )}
              {newMatchType === 'cup' && (
                <div className="space-y-2">
                  <Label>Ronda</Label>
                  <Input name="round" placeholder="Ej: Cuartos de Final" required className="rounded-xl" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Fecha y Hora</Label>
                <Input name="date" type="datetime-local" required className="rounded-xl" />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                  Crear Partido
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border-none">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Rival</Label>
          <Select value={filterOpponent} onValueChange={setFilterOpponent}>
            <SelectTrigger className="border-none bg-gray-50 rounded-xl h-10 mt-1">
              <SelectValue placeholder="Todos los rivales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Todos los rivales">Todos los rivales</SelectItem>
              {opponents.map(o => <SelectItem key={o.id} value={o.id} label={o.name}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Temporada</Label>
          <Select value={filterSeason} onValueChange={setFilterSeason}>
            <SelectTrigger className="border-none bg-gray-50 rounded-xl h-10 mt-1">
              <SelectValue placeholder="Todas las temporadas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Todas las temporadas">Todas las temporadas</SelectItem>
              {seasons.map(s => <SelectItem key={s.id} value={s.id} label={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Tipo</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="border-none bg-gray-50 rounded-xl h-10 mt-1">
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Todos los tipos">Todos los tipos</SelectItem>
              <SelectItem value="friendly" label="Amistosos">Amistosos</SelectItem>
              <SelectItem value="league" label="Liga">Liga</SelectItem>
              <SelectItem value="cup" label="Copa">Copa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Match List */}
      <div className="space-y-4">
        {filteredMatches.map((match, i) => {
          const opponent = opponents.find(o => o.id === match.opponentId);
          const season = seasons.find(s => s.id === match.seasonId);
          const isCompleted = match.status === 'completed';
          const isWin = isCompleted && (match.scoreTeam || 0) > (match.scoreOpponent || 0);
          const isLoss = isCompleted && (match.scoreTeam || 0) < (match.scoreOpponent || 0);
          const isDraw = isCompleted && (match.scoreTeam || 0) === (match.scoreOpponent || 0);

          return (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden rounded-2xl group">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row items-center">
                    {/* Status Indicator */}
                    <div className={cn(
                      "w-full sm:w-2 h-2 sm:h-auto self-stretch",
                      !isCompleted ? "bg-blue-400" : isWin ? "bg-emerald-500" : isLoss ? "bg-red-500" : "bg-gray-400"
                    )} />
                    
                    <div className="flex-1 p-6 flex flex-col sm:flex-row items-center gap-6 w-full">
                      <div className="text-center sm:text-left min-w-[120px]">
                        <div className="mb-2">
                          {match.type === 'league' && <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">Liga {match.round ? `- ${match.round}` : ''}</Badge>}
                          {match.type === 'cup' && <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-none">Copa {match.round ? `- ${match.round}` : ''}</Badge>}
                          {(!match.type || match.type === 'friendly') && <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-none">Amistoso</Badge>}
                        </div>
                        <div className="flex items-center justify-center sm:justify-start gap-2 mb-2 sm:hidden">
                          {opponent?.shieldUrl && (
                            <img src={opponent.shieldUrl} alt={opponent?.name} className="w-6 h-6 rounded-full object-cover border bg-white" referrerPolicy="no-referrer" />
                          )}
                          <p className="text-sm font-bold truncate max-w-[150px]">{opponent?.name || 'Desconocido'}</p>
                        </div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          {format(new Date(match.date), 'EEEE', { locale: es })}
                        </p>
                        <p className="text-lg font-bold">
                          {format(new Date(match.date), 'dd MMM', { locale: es })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(match.date), 'HH:mm')} • {season?.name}
                        </p>
                      </div>

                      <div className="flex-1 flex items-center justify-center gap-4 sm:gap-8 w-full">
                        {/* Home Team */}
                        <div className="text-right flex-1 hidden sm:block">
                          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                            {match.isHome !== false ? 'Mi Equipo' : 'Rival'}
                          </p>
                          <div className="flex items-center justify-end gap-3">
                            <p className="text-xl font-black truncate max-w-[150px]">
                              {match.isHome !== false ? 'LOCAL' : (opponent?.name || 'Desconocido')}
                            </p>
                            {match.isHome !== false ? (
                              team?.shieldUrl && <img src={team.shieldUrl} alt={team.name} className="w-8 h-8 rounded-full object-cover border bg-white" referrerPolicy="no-referrer" />
                            ) : (
                              opponent?.shieldUrl && <img src={opponent.shieldUrl} alt={opponent.name} className="w-8 h-8 rounded-full object-cover border bg-white" referrerPolicy="no-referrer" />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {isCompleted ? (
                            <div className="flex items-center gap-3">
                              <span className={cn(
                                "text-4xl font-black w-12 h-12 flex items-center justify-center rounded-xl",
                                match.isHome !== false 
                                  ? (isWin ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-400")
                                  : (isLoss ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-400")
                              )}>
                                {match.isHome !== false ? match.scoreTeam : match.scoreOpponent}
                              </span>
                              <span className="text-gray-300 font-bold">-</span>
                              <span className={cn(
                                "text-4xl font-black w-12 h-12 flex items-center justify-center rounded-xl",
                                match.isHome !== false 
                                  ? (isLoss ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-400")
                                  : (isWin ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-400")
                              )}>
                                {match.isHome !== false ? match.scoreOpponent : match.scoreTeam}
                              </span>
                            </div>
                          ) : (
                            <div className="px-6 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold flex items-center gap-2">
                              <Clock size={16} />
                              PENDIENTE
                            </div>
                          )}
                        </div>

                        {/* Away Team */}
                        <div className="text-left flex-1 hidden sm:block">
                          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                            {match.isHome !== false ? 'Rival' : 'Mi Equipo'}
                          </p>
                          <div className="flex items-center gap-3">
                            {match.isHome !== false ? (
                              opponent?.shieldUrl && <img src={opponent.shieldUrl} alt={opponent.name} className="w-8 h-8 rounded-full object-cover border bg-white" referrerPolicy="no-referrer" />
                            ) : (
                              team?.shieldUrl && <img src={team.shieldUrl} alt={team.name} className="w-8 h-8 rounded-full object-cover border bg-white" referrerPolicy="no-referrer" />
                            )}
                            <p className="text-xl font-black truncate max-w-[150px]">
                              {match.isHome !== false ? (opponent?.name || 'Desconocido') : 'VISITANTE'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger render={<Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-emerald-50 hover:text-emerald-600" />}>
                            <Edit2 size={18} />
                          </DialogTrigger>
                          <MatchStatsDialog 
                            match={match} 
                            players={players} 
                            stats={stats} 
                            onSave={(m, s) => {
                              onUpdateMatch(m);
                              onUpdateStats(s);
                            }}
                          />
                        </Dialog>
                        <Button variant="ghost" size="icon" onClick={() => onDeleteMatch(match.id)} className="h-10 w-10 rounded-xl hover:bg-red-50 hover:text-red-500">
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {filteredMatches.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <Calendar className="mx-auto text-gray-200 mb-4" size={48} />
            <p className="text-gray-400 font-medium">No se encontraron partidos con estos filtros.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchStatsDialog({ match, players, stats, onSave }: { 
  match: Match, 
  players: Player[], 
  stats: PlayerStat[],
  onSave: (match: Match, stats: PlayerStat[]) => void 
}) {
  const [matchData, setMatchData] = React.useState<Match>(match);
  const [localStats, setLocalStats] = React.useState<Record<string, Partial<PlayerStat>>>(
    players.reduce((acc, p) => {
      const s = stats.find(stat => stat.matchId === match.id && stat.playerId === p.id);
      acc[p.id] = s ? { ...s } : { attendance: 'noResponse', goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
      return acc;
    }, {} as Record<string, Partial<PlayerStat>>)
  );

  const updatePlayerStat = (playerId: string, field: keyof PlayerStat, value: any) => {
    setLocalStats(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value }
    }));
  };

  const handleSave = () => {
    const finalStats: PlayerStat[] = players.map(p => ({
      id: (stats.find(s => s.matchId === match.id && s.playerId === p.id)?.id) || '',
      playerId: p.id,
      matchId: match.id,
      seasonId: match.seasonId,
      attendance: (localStats[p.id].attendance as Attendance) || 'noResponse',
      goals: localStats[p.id].goals || 0,
      assists: localStats[p.id].assists || 0,
      yellowCards: localStats[p.id].yellowCards || 0,
      redCards: localStats[p.id].redCards || 0,
    }));

    // Auto-calculate team score from goals
    const teamScore = finalStats.reduce((acc, s) => acc + s.goals, 0);
    
    onSave({ ...matchData, scoreTeam: teamScore, status: 'completed' }, finalStats);
  };

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl">
      <DialogHeader>
        <DialogTitle>Estadísticas del Partido</DialogTitle>
        <DialogDescription>Registra el resultado final y el desempeño de cada jugador.</DialogDescription>
      </DialogHeader>

      <div className="space-y-8 py-4">
        {/* Score Board */}
        <div className="flex items-center justify-center gap-8 p-6 bg-gray-50 rounded-2xl">
          <div className="text-center">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">
              {match.isHome !== false ? 'Mi Equipo' : 'Rival'}
            </p>
            {match.isHome !== false ? (
              <div className="text-4xl font-black bg-white w-16 h-16 flex items-center justify-center rounded-xl shadow-sm">
                {Object.values(localStats).reduce((acc, s) => acc + ((s as any).goals || 0), 0)}
              </div>
            ) : (
              <Input 
                type="number" 
                value={matchData.scoreOpponent || 0} 
                onChange={(e) => setMatchData({ ...matchData, scoreOpponent: parseInt(e.target.value) || 0 })}
                className="text-4xl font-black w-16 h-16 text-center rounded-xl shadow-sm border-none bg-white"
              />
            )}
          </div>
          <div className="text-2xl font-bold text-gray-300">VS</div>
          <div className="text-center">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">
              {match.isHome !== false ? 'Rival' : 'Mi Equipo'}
            </p>
            {match.isHome !== false ? (
              <Input 
                type="number" 
                value={matchData.scoreOpponent || 0} 
                onChange={(e) => setMatchData({ ...matchData, scoreOpponent: parseInt(e.target.value) || 0 })}
                className="text-4xl font-black w-16 h-16 text-center rounded-xl shadow-sm border-none bg-white"
              />
            ) : (
              <div className="text-4xl font-black bg-white w-16 h-16 flex items-center justify-center rounded-xl shadow-sm">
                {Object.values(localStats).reduce((acc, s) => acc + ((s as any).goals || 0), 0)}
              </div>
            )}
          </div>
        </div>

        {/* Player Stats Table */}
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-[200px]">Jugador</TableHead>
                <TableHead>Asistencia</TableHead>
                <TableHead className="text-center">Goles</TableHead>
                <TableHead className="text-center">Asist.</TableHead>
                <TableHead className="text-center">Amarillas</TableHead>
                <TableHead className="text-center">Rojas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map(player => (
                <TableRow key={player.id}>
                  <TableCell className="font-bold">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 w-5 h-5 flex items-center justify-center rounded-full">
                        {player.number}
                      </span>
                      {player.firstName} {player.lastName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={localStats[player.id].attendance} 
                      onValueChange={(v) => updatePlayerStat(player.id, 'attendance', v)}
                    >
                      <SelectTrigger className="h-8 border-none bg-gray-50 rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attending" label="Asiste">Asiste</SelectItem>
                        <SelectItem value="notAttending" label="No asiste">No asiste</SelectItem>
                        <SelectItem value="noResponse" label="Sin rpta">Sin rpta</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      className="h-8 w-12 mx-auto text-center border-none bg-gray-50 rounded-lg"
                      value={localStats[player.id].goals}
                      onChange={(e) => updatePlayerStat(player.id, 'goals', parseInt(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      className="h-8 w-12 mx-auto text-center border-none bg-gray-50 rounded-lg"
                      value={localStats[player.id].assists}
                      onChange={(e) => updatePlayerStat(player.id, 'assists', parseInt(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      className="h-8 w-12 mx-auto text-center border-none bg-gray-50 rounded-lg"
                      value={localStats[player.id].yellowCards}
                      onChange={(e) => updatePlayerStat(player.id, 'yellowCards', parseInt(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      className="h-8 w-12 mx-auto text-center border-none bg-gray-50 rounded-lg"
                      value={localStats[player.id].redCards}
                      onChange={(e) => updatePlayerStat(player.id, 'redCards', parseInt(e.target.value) || 0)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl font-bold">
          Guardar Estadísticas
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
