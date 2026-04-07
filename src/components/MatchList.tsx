import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Calendar, 
  Edit2, 
  Trash2, 
  Clock, 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Player, Match, PlayerStat, Season, Opponent, MatchType, Team } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface MatchListProps {
  team: Team | null;
  players: Player[];
  matches: Match[];
  stats: PlayerStat[];
  seasons: Season[];
  opponents: Opponent[];
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
  onUpdateMatch, 
  onDeleteMatch,
  onUpdateStats
}: MatchListProps) {
  const navigate = useNavigate();
  const [filterOpponent, setFilterOpponent] = React.useState<string>('all');
  const [filterSeason, setFilterSeason] = React.useState<string>('all');
  const [filterType, setFilterType] = React.useState<string>('all');

  // Filtrar y ordenar partidos por fecha descendente
  const filteredMatches = matches.filter(m => {
    const matchOpponent = filterOpponent === 'all' || m.opponentId === filterOpponent;
    const matchSeason = filterSeason === 'all' || m.seasonId === filterSeason;
    const matchTypeFilter = filterType === 'all' || m.type === filterType;
    return matchOpponent && matchSeason && matchTypeFilter;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Historial de Partidos</h2>
          <p className="text-gray-500">Registra resultados y estadísticas individuales.</p>
        </div>
        <Button 
          onClick={() => navigate('/matches/new')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6"
        >
          <Plus size={18} className="mr-2" />
          Programar Partido
        </Button>
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
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => navigate(`/matches/${match.id}/stats`)}
                          className="h-10 w-10 rounded-xl hover:bg-emerald-50 hover:text-emerald-600"
                        >
                          <Edit2 size={18} />
                        </Button>
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
