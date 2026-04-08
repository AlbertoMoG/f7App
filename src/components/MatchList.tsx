import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Calendar, 
  Edit2, 
  Trash2, 
  Clock, 
  ChevronDown,
  ChevronUp,
  Trophy,
  Star,
  ShieldAlert,
  Users,
  LayoutGrid,
  List as ListIcon,
  Filter,
  Instagram,
  Download,
  Share2,
  X,
  MapPin
} from 'lucide-react';
import { toPng } from 'html-to-image';
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
  const [filterMonth, setFilterMonth] = React.useState<string>('all');
  const [viewMode, setViewMode] = React.useState<'list' | 'compact'>('list');
  const [expandedMatchId, setExpandedMatchId] = React.useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const instagramPostRef = React.useRef<HTMLDivElement>(null);

  const months = [
    { value: '0', label: 'Enero' },
    { value: '1', label: 'Febrero' },
    { value: '2', label: 'Marzo' },
    { value: '3', label: 'Abril' },
    { value: '4', label: 'Mayo' },
    { value: '5', label: 'Junio' },
    { value: '6', label: 'Julio' },
    { value: '7', label: 'Agosto' },
    { value: '8', label: 'Septiembre' },
    { value: '9', label: 'Octubre' },
    { value: '10', label: 'Noviembre' },
    { value: '11', label: 'Diciembre' },
  ];

  const downloadInstagramPost = async () => {
    if (instagramPostRef.current === null) return;
    
    try {
      const dataUrl = await toPng(instagramPostRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `partidos-${months.find(m => m.value === filterMonth)?.label || 'mes'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating image:', err);
    }
  };

  const toggleExpand = (matchId: string) => {
    setExpandedMatchId(expandedMatchId === matchId ? null : matchId);
  };

  // Filtrar y ordenar partidos por fecha descendente
  const filteredMatches = matches.filter(m => {
    const date = new Date(m.date);
    const matchOpponent = filterOpponent === 'all' || m.opponentId === filterOpponent;
    const matchSeason = filterSeason === 'all' || m.seasonId === filterSeason;
    const matchTypeFilter = filterType === 'all' || m.type === filterType;
    const matchMonth = filterMonth === 'all' || date.getMonth().toString() === filterMonth;
    return matchOpponent && matchSeason && matchTypeFilter && matchMonth;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Group matches by month for compact view
  const matchesByMonth = filteredMatches.reduce((acc, match) => {
    const monthYear = format(new Date(match.date), 'MMMM yyyy', { locale: es });
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Historial de Partidos</h2>
          <p className="text-gray-500">Registra resultados y estadísticas individuales.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {filterMonth !== 'all' && (
            <Button 
              onClick={() => setIsShareModalOpen(true)}
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl h-11 px-6"
            >
              <Instagram size={18} className="mr-2" />
              Compartir Mes
            </Button>
          )}
          <Button 
            onClick={() => navigate('/matches/new')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6"
          >
            <Plus size={18} className="mr-2" />
            Programar Partido
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border-none items-end">
          
          {/* Filtro de Rival */}
          <div className="flex-1 min-w-[150px]">
            <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Rival</Label>
            <Select value={filterOpponent} onValueChange={setFilterOpponent}>
              <SelectTrigger className="border-none bg-gray-50 rounded-xl h-10 mt-1">
                <SelectValue>
                  {filterOpponent === 'all' 
                    ? 'Todos los rivales' 
                    : opponents.find(o => o.id === filterOpponent)?.name || <span className="text-gray-400">Todos los rivales</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los rivales</SelectItem>
                {opponents.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Temporada */}
          <div className="flex-1 min-w-[150px]">
            <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Temporada</Label>
            <Select value={filterSeason} onValueChange={setFilterSeason}>
              <SelectTrigger className="border-none bg-gray-50 rounded-xl h-10 mt-1">
                <SelectValue>
                  {filterSeason === 'all' 
                    ? 'Todas las temporadas' 
                    : seasons.find(s => s.id === filterSeason)?.name || <span className="text-gray-400">Todas las temporadas</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las temporadas</SelectItem>
                {seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Mes */}
          <div className="flex-1 min-w-[150px]">
            <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Mes</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="border-none bg-gray-50 rounded-xl h-10 mt-1">
                <SelectValue>
                  {filterMonth === 'all' 
                    ? 'Todos los meses' 
                    : months.find(m => m.value === filterMonth)?.label || <span className="text-gray-400">Todos los meses</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Tipo */}
          <div className="flex-1 min-w-[150px]">
            <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Tipo</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="border-none bg-gray-50 rounded-xl h-10 mt-1">
                <SelectValue>
                  {filterType === 'all' ? 'Todos los tipos' :
                  filterType === 'friendly' ? 'Amistosos' :
                  filterType === 'league' ? 'Liga' :
                  filterType === 'cup' ? 'Copa' :
                  <span className="text-gray-400">Todos los tipos</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="friendly">Amistosos</SelectItem>
                <SelectItem value="league">Liga</SelectItem>
                <SelectItem value="cup">Copa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-50 rounded-xl p-1 h-10">
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'} 
              size="icon" 
              onClick={() => setViewMode('list')}
              className={cn("rounded-lg h-8 w-8", viewMode === 'list' ? "bg-white shadow-sm text-emerald-600 hover:bg-white" : "text-gray-400")}
            >
              <ListIcon size={16} />
            </Button>
            <Button 
              variant={viewMode === 'compact' ? 'default' : 'ghost'} 
              size="icon" 
              onClick={() => setViewMode('compact')}
              className={cn("rounded-lg h-8 w-8", viewMode === 'compact' ? "bg-white shadow-sm text-emerald-600 hover:bg-white" : "text-gray-400")}
            >
              <LayoutGrid size={16} />
            </Button>
          </div>

        </div>
      </div>

      {/* Match List */}
      <div className="space-y-4">
        {viewMode === 'list' ? (
          filteredMatches.map((match, i) => {
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
                            <p className="text-sm font-black truncate max-w-[250px]">
                              {match.isHome !== false ? (team?.name || 'MI EQUIPO') : (opponent?.name || 'RIVAL')} 
                              <span className="mx-2 text-gray-300 font-normal">vs</span>
                              {match.isHome !== false ? (opponent?.name || 'RIVAL') : (team?.name || 'MI EQUIPO')}
                            </p>
                          </div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            {format(new Date(match.date), 'EEEE', { locale: es })}
                          </p>
                          <p className="text-lg font-bold">
                            {format(new Date(match.date), 'dd MMM', { locale: es })}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <Clock size={12} /> {format(new Date(match.date), 'HH:mm')}
                            {match.location && (
                              <>
                                <span className="text-gray-300">•</span>
                                <MapPin size={12} /> {match.location}
                              </>
                            )}
                            <span className="text-gray-300">•</span> {season?.name}
                          </p>
                        </div>

                        <div className="flex-1 flex items-center justify-center gap-4 sm:gap-8 w-full">
                          {/* Home Team */}
                          <div className="text-right flex-1 hidden sm:block">
                            <div className="flex items-center justify-end gap-3">
                              <p className="text-xl font-black truncate max-w-[150px]">
                                {match.isHome !== false ? (team?.name || 'MI EQUIPO') : (opponent?.name || 'RIVAL')}
                              </p>
                              {match.isHome !== false ? (
                                team?.shieldUrl && <img src={team.shieldUrl} alt={team.name} className="w-16 h-16 rounded-2xl object-cover border bg-white shadow-md" referrerPolicy="no-referrer" />
                              ) : (
                                opponent?.shieldUrl && <img src={opponent.shieldUrl} alt={opponent.name} className="w-16 h-16 rounded-2xl object-cover border bg-white shadow-md" referrerPolicy="no-referrer" />
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-center gap-2">
                            {isCompleted && (
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                Finalizado
                              </span>
                            )}
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
                          </div>

                          {/* Away Team */}
                          <div className="text-left flex-1 hidden sm:block">
                            <div className="flex items-center gap-3">
                              {match.isHome !== false ? (
                                opponent?.shieldUrl && <img src={opponent.shieldUrl} alt={opponent.name} className="w-16 h-16 rounded-2xl object-cover border bg-white shadow-md" referrerPolicy="no-referrer" />
                              ) : (
                                team?.shieldUrl && <img src={team.shieldUrl} alt={team.name} className="w-16 h-16 rounded-2xl object-cover border bg-white shadow-md" referrerPolicy="no-referrer" />
                              )}
                              <p className="text-xl font-black truncate max-w-[150px]">
                                {match.isHome !== false ? (opponent?.name || 'RIVAL') : (team?.name || 'MI EQUIPO')}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => toggleExpand(match.id)}
                            className={cn(
                              "h-10 w-10 rounded-xl transition-all",
                              expandedMatchId === match.id ? "bg-emerald-50 text-emerald-600" : "hover:bg-gray-100"
                            )}
                          >
                            {expandedMatchId === match.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </Button>
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

                    {/* Expanded Stats Section */}
                    {expandedMatchId === match.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-50 bg-gray-50/30 overflow-hidden"
                      >
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Users size={16} className="text-emerald-600" />
                              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Jugadores que asistieron</h4>
                            </div>
                            <div className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                                Total: {stats.filter(s => s.matchId === match.id && s.attendance === 'attending').length}
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            {['Portero', 'Defensa', 'Medio', 'Delantero'].map((pos) => {
                              const attendingStats = stats.filter(s => 
                                s.matchId === match.id && 
                                s.attendance === 'attending' &&
                                players.find(p => p.id === s.playerId)?.position === pos
                              );
                              
                              if (attendingStats.length === 0) return null;

                              return (
                                <div key={pos} className="space-y-2">
                                  <div className="flex items-center gap-2 px-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{pos}s</span>
                                    <div className="h-px flex-1 bg-gray-100" />
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {attendingStats.map(stat => {
                                      const player = players.find(p => p.id === stat.playerId);
                                      if (!player) return null;
                                      return (
                                        <div key={stat.id} className="bg-white/80 px-2.5 py-2 rounded-xl border border-gray-100 flex items-center justify-between gap-2 shadow-sm">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-sm font-black text-emerald-600 w-6 text-center">
                                              {player.number}
                                            </span>
                                            <span className="text-sm font-bold truncate text-gray-700">
                                              {player.alias || player.firstName}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {stat.goals > 0 && (
                                              <div className="flex items-center text-emerald-600 font-black text-xs">
                                                <Trophy size={12} className="mr-0.5" />
                                                {stat.goals}
                                              </div>
                                            )}
                                            {stat.assists > 0 && (
                                              <div className="flex items-center text-blue-600 font-black text-xs">
                                                <Star size={12} className="mr-0.5" />
                                                {stat.assists}
                                              </div>
                                            )}
                                            {(stat.yellowCards > 0 || stat.redCards > 0) && (
                                              <div className="flex gap-1">
                                                {Array.from({ length: stat.yellowCards }).map((_, i) => (
                                                  <div key={`y-${i}`} className="w-2.5 h-3.5 bg-yellow-400 rounded-[1px] shadow-sm" />
                                                ))}
                                                {Array.from({ length: stat.redCards }).map((_, i) => (
                                                  <div key={`r-${i}`} className="w-2.5 h-3.5 bg-red-500 rounded-[1px] shadow-sm" />
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                            {stats.filter(s => s.matchId === match.id && s.attendance === 'attending').length === 0 && (
                              <div className="py-2 text-center text-gray-400 italic text-[11px]">
                                Sin estadísticas registradas.
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        ) : (
          <div className="space-y-8">
            {Object.entries(matchesByMonth).map(([monthYear, monthMatches]) => (
              <div key={monthYear} className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">{monthYear}</h3>
                  <div className="h-px flex-1 bg-gray-100" />
                  <Badge variant="secondary" className="bg-gray-50 text-gray-400 border-none text-[10px] font-bold px-2 py-0.5 rounded-lg">
                    {monthMatches.length} partidos
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {monthMatches.map((match) => {
                    const opponent = opponents.find(o => o.id === match.opponentId);
                    const isCompleted = match.status === 'completed';
                    const isWin = isCompleted && (match.scoreTeam || 0) > (match.scoreOpponent || 0);
                    const isLoss = isCompleted && (match.scoreTeam || 0) < (match.scoreOpponent || 0);
                    const isDraw = isCompleted && (match.scoreTeam || 0) === (match.scoreOpponent || 0);

                    return (
                      <Card 
                        key={match.id} 
                        className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl cursor-pointer group overflow-hidden"
                        onClick={() => navigate(`/matches/${match.id}/stats`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                {format(new Date(match.date), 'EEEE dd', { locale: es })}
                              </span>
                              <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                <Clock size={10} /> {format(new Date(match.date), 'HH:mm')}
                              </span>
                              {match.location && (
                                <span className="text-[10px] text-gray-400 truncate max-w-[120px] flex items-center gap-1">
                                  <MapPin size={10} /> {match.location}
                                </span>
                              )}
                            </div>
                            {match.type && (
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant="secondary" className={cn(
                                  "text-[9px] font-black uppercase tracking-wider border-none",
                                  match.type === 'league' ? "bg-blue-50 text-blue-600" :
                                  match.type === 'cup' ? "bg-purple-50 text-purple-600" :
                                  "bg-orange-50 text-orange-600"
                                )}>
                                  {match.type === 'league' ? 'Liga' : match.type === 'cup' ? 'Copa' : 'Amistoso'}
                                </Badge>
                                {match.round && (
                                  <span className="text-[9px] font-bold text-gray-400 uppercase">
                                    {match.type === 'league' ? ` ${match.round}` : ` ${match.round}`}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-4 py-2">
                            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                              {match.isHome !== false ? (
                                team?.shieldUrl ? <img src={team.shieldUrl} className="w-10 h-10 rounded-xl object-cover border bg-white" referrerPolicy="no-referrer" /> : <div className="w-10 h-10 rounded-xl bg-gray-100" />
                              ) : (
                                opponent?.shieldUrl ? <img src={opponent.shieldUrl} className="w-10 h-10 rounded-xl object-cover border bg-white" referrerPolicy="no-referrer" /> : <div className="w-10 h-10 rounded-xl bg-gray-100" />
                              )}
                              <span className="text-xs font-black truncate w-full text-center">
                                {match.isHome !== false ? (team?.name || 'MI EQUIPO') : (opponent?.name || 'RIVAL')}
                              </span>
                            </div>

                            <div className="flex flex-col items-center">
                              {isCompleted ? (
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-xl font-black",
                                    match.isHome !== false ? (isWin ? "text-emerald-600" : "text-gray-900") : (isLoss ? "text-emerald-600" : "text-gray-900")
                                  )}>
                                    {match.isHome !== false ? match.scoreTeam : match.scoreOpponent}
                                  </span>
                                  <span className="text-gray-300 font-bold">-</span>
                                  <span className={cn(
                                    "text-xl font-black",
                                    match.isHome !== false ? (isLoss ? "text-red-600" : "text-gray-900") : (isWin ? "text-red-600" : "text-gray-900")
                                  )}>
                                    {match.isHome !== false ? match.scoreOpponent : match.scoreTeam}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-lg">VS</span>
                              )}
                            </div>

                            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                              {match.isHome !== false ? (
                                opponent?.shieldUrl ? <img src={opponent.shieldUrl} className="w-10 h-10 rounded-xl object-cover border bg-white" referrerPolicy="no-referrer" /> : <div className="w-10 h-10 rounded-xl bg-gray-100" />
                              ) : (
                                team?.shieldUrl ? <img src={team.shieldUrl} className="w-10 h-10 rounded-xl object-cover border bg-white" referrerPolicy="no-referrer" /> : <div className="w-10 h-10 rounded-xl bg-gray-100" />
                              )}
                              <span className="text-xs font-black truncate w-full text-center">
                                {match.isHome !== false ? (opponent?.name || 'RIVAL') : (team?.name || 'MI EQUIPO')}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {filteredMatches.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <Calendar className="mx-auto text-gray-200 mb-4" size={48} />
            <p className="text-gray-400 font-medium">No se encontraron partidos con estos filtros.</p>
          </div>
        )}
      </div>
      {/* Instagram Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl"
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Instagram size={20} className="text-pink-600" />
                Vista Previa Instagram
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsShareModalOpen(false)} className="rounded-full">
                <X size={20} />
              </Button>
            </div>

            <div className="p-8 bg-gray-100 flex justify-center">
              {/* Instagram Post Container (1080x1080 aspect ratio simulated) */}
              <div 
                ref={instagramPostRef}
                className="w-[400px] h-[400px] bg-emerald-900 text-white p-8 flex flex-col relative overflow-hidden shadow-xl"
                style={{ backgroundImage: 'radial-gradient(circle at top right, #065f46, #064e3b)' }}
              >
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/10 rounded-full -ml-24 -mb-24 blur-3xl" />
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      {team?.shieldUrl && (
                        <img src={team.shieldUrl} alt={team.name} className="w-12 h-12 rounded-xl border-2 border-white/20 shadow-lg" referrerPolicy="no-referrer" />
                      )}
                      <div>
                        <h4 className="text-lg font-black tracking-tight leading-none uppercase">{team?.name || 'MI EQUIPO'}</h4>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Calendario Mensual</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white/90 uppercase">{months.find(m => m.value === filterMonth)?.label}</p>
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Temporada {seasons.find(s => s.id === filterSeason)?.name || '23/24'}</p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 overflow-hidden">
                    {filteredMatches.slice(0, 5).map((m) => {
                      const opp = opponents.find(o => o.id === m.opponentId);
                      return (
                        <div key={m.id} className="bg-white/10 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex items-center gap-4">
                          <div className="flex flex-col items-center min-w-[45px] border-r border-white/10 pr-3">
                            <span className="text-lg font-black leading-none">{format(new Date(m.date), 'dd')}</span>
                            <span className="text-[9px] font-bold uppercase text-emerald-400">{format(new Date(m.date), 'EEE', { locale: es })}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge className="text-[8px] h-4 px-1.5 bg-emerald-500/20 text-emerald-300 border-none font-black uppercase">
                                {m.type === 'league' ? 'Liga' : m.type === 'cup' ? 'Copa' : 'Amistoso'}
                              </Badge>
                              {m.round && (
                                <span className="text-[8px] font-bold text-white/40 uppercase">
                                  {m.type === 'league' ? ` ${m.round}` : ` ${m.round}`}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-black truncate uppercase leading-tight">
                              {m.isHome !== false ? 'vs ' : '@ '}{opp?.name || 'RIVAL'}
                            </p>
                            {m.location && (
                              <p className="text-[9px] font-bold text-white/50 truncate flex items-center gap-1 mt-0.5">
                                <MapPin size={8} /> {m.location}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black">{format(new Date(m.date), 'HH:mm')}</p>
                            <p className="text-[8px] font-bold text-white/40 uppercase">Hora Local</p>
                          </div>
                        </div>
                      );
                    })}
                    {filteredMatches.length > 5 && (
                      <p className="text-center text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        + {filteredMatches.length - 5} partidos más este mes
                      </p>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                    <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-[0.3em]">#FutbolBase #Calendario</p>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 flex gap-3">
              <Button onClick={downloadInstagramPost} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold">
                <Download size={18} className="mr-2" />
                Descargar Imagen
              </Button>
              <Button variant="outline" onClick={() => setIsShareModalOpen(false)} className="flex-1 rounded-xl h-12 font-bold border-gray-200">
                Cancelar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
