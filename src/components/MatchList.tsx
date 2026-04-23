import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Calendar, 
  Trash2, 
  Clock, 
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Star,
  Users,
  LayoutGrid,
  List as ListIcon,
  Instagram,
  Download,
  X,
  MapPin,
  ExternalLink,
  ClipboardList,
  Pencil,
  Check,
  Shield,
  Eye,
  EyeOff,
  Zap,
  MoreVertical,
  ShieldCheck,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Player, Match, PlayerStat, Season, Opponent, Team, Field, Lineup, Injury, PlayerSeason } from '../types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths, 
  isSameMonth, 
  isToday 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MatchListProps {
  team: Team | null;
  players: Player[];
  matches: Match[];
  stats: PlayerStat[];
  seasons: Season[];
  opponents: Opponent[];
  fields: Field[];
  onUpdateMatch: (match: Match) => void;
  onDeleteMatch: (id: string) => void;
  onUpdateStats: (stats: PlayerStat[]) => void;
  lineups: Lineup[];
  playerSeasons: PlayerSeason[];
  injuries: Injury[];
  globalSeasonId: string;
  onSetActiveTab: (tab: string, matchId?: string) => void;
  initialMatchId?: string | null;
  onClearInitialMatchId?: () => void;
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
  fields,
  onDeleteMatch,
  lineups,
  playerSeasons,
  injuries,
  globalSeasonId,
  onSetActiveTab,
  initialMatchId,
  onClearInitialMatchId
}: MatchListProps) {
  const navigate = useNavigate();
  const [filterOpponent, setFilterOpponent] = React.useState<string>('all');
  const [filterType, setFilterType] = React.useState<string>('all');
  const [filterMonth, setFilterMonth] = React.useState<string>('all');
  const [filterYear, setFilterYear] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [viewMode, setViewMode] = React.useState<'list' | 'compact' | 'calendar'>('list');
  const [currentCalendarDate, setCurrentCalendarDate] = React.useState(new Date());
  const [expandedMatchId, setExpandedMatchId] = React.useState<string | null>(null);
  const [selectedMatchForDetails, setSelectedMatchForDetails] = React.useState<Match | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const [noConvocatoriaModalOpen, setNoConvocatoriaModalOpen] = React.useState(false);
  const [showUpcoming, setShowUpcoming] = React.useState(true);
  const instagramPostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (initialMatchId) {
      const match = matches.find(m => m.id === initialMatchId);
      if (match) {
        setSelectedMatchForDetails(match);
      }
      if (onClearInitialMatchId) {
        onClearInitialMatchId();
      }
    }
  }, [initialMatchId, matches, onClearInitialMatchId]);

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

  const years = Array.from(new Set(matches.map(m => new Date(m.date).getFullYear().toString()))).sort((a, b) => parseInt(b) - parseInt(a));

  const handleShareClick = () => {
    if (filterMonth === 'all' || filterYear === 'all') {
      toast.error('Por favor, selecciona tanto un mes como un año para compartir.');
      return;
    }
    setIsShareModalOpen(true);
  };

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
    const match = matches.find(m => m.id === matchId);
    if (match) setSelectedMatchForDetails(match);
  };

  const handleLineupClick = (e: React.MouseEvent, matchId: string, hasLineup: boolean) => {
    e.stopPropagation();
    if (hasLineup) {
      onSetActiveTab('simulator', matchId);
    } else {
      const matchStats = stats.filter(s => s.matchId === matchId && s.attendance === 'attending');
      if (matchStats.length === 0) {
        setNoConvocatoriaModalOpen(true);
      } else {
        onSetActiveTab('simulator', matchId);
      }
    }
  };

  const filteredOpponents = React.useMemo(() => {
    if (globalSeasonId === 'all') return opponents;
    const opponentIdsInSeason = new Set(matches.filter(m => m.seasonId === globalSeasonId).map(m => m.opponentId));
    return opponents.filter(o => opponentIdsInSeason.has(o.id));
  }, [opponents, matches, globalSeasonId]);

  React.useEffect(() => {
    if (filterOpponent !== 'all' && globalSeasonId !== 'all') {
      const opponentIdsInSeason = new Set(matches.filter(m => m.seasonId === globalSeasonId).map(m => m.opponentId));
      if (!opponentIdsInSeason.has(filterOpponent)) {
        setFilterOpponent('all');
      }
    }
  }, [globalSeasonId, matches, filterOpponent]);

  // Filtrar y ordenar partidos por fecha descendente
  const filteredMatches = matches.filter(m => {
    const date = new Date(m.date);
    const matchOpponent = filterOpponent === 'all' || m.opponentId === filterOpponent;
    const matchSeason = globalSeasonId === 'all' || m.seasonId === globalSeasonId;
    const matchTypeFilter = filterType === 'all' || m.type === filterType;
    const matchMonth = filterMonth === 'all' || date.getMonth().toString() === filterMonth;
    const matchYear = filterYear === 'all' || date.getFullYear().toString() === filterYear;
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    return matchOpponent && matchSeason && matchTypeFilter && matchMonth && matchYear && matchStatus;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Próximos 5 partidos programados
  const upcomingMatches = React.useMemo(() => {
    return matches
      .filter(m => {
        const matchSeason = globalSeasonId === 'all' || m.seasonId === globalSeasonId;
        return m.status === 'scheduled' && matchSeason;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [matches, globalSeasonId]);

  // Group matches by month for compact view
  const matchesByMonth = filteredMatches.reduce((acc, match) => {
    const monthYear = format(new Date(match.date), 'MMMM yyyy', { locale: es });
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  const calendarDays = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(currentCalendarDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentCalendarDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentCalendarDate]);

  const getMatchesForDay = (day: Date) => {
    return matches.filter(m => isSameDay(new Date(m.date), day));
  };

  const nextMonth = () => setCurrentCalendarDate(addMonths(currentCalendarDate, 1));
  const prevMonth = () => setCurrentCalendarDate(subMonths(currentCalendarDate, 1));

  return (
    <TooltipProvider>
      <div className="space-y-4">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Historial de Partidos</h2>
          <p className="text-gray-500">Registra resultados y estadísticas individuales.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleShareClick}
            variant="outline"
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl h-11 px-6"
          >
            <Instagram size={18} className="mr-2" />
            Compartir Mes
          </Button>
          <Button 
            onClick={() => navigate('/matches/new')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6 group"
          >
            <Plus size={18} className="mr-2 group-hover:hidden" />
            <Check size={18} className="mr-2 hidden group-hover:block" />
            Programar Partido
          </Button>
        </div>
      </header>

      {/* Próximos Partidos Destacados */}
      {upcomingMatches.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Clock className="text-emerald-600" size={20} />
                Próximos Partidos
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowUpcoming(!showUpcoming)}
                className="h-8 w-8 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                title={showUpcoming ? "Ocultar próximos partidos" : "Mostrar próximos partidos"}
              >
                {showUpcoming ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 rounded-full px-3">
              {upcomingMatches.length} {upcomingMatches.length === 1 ? 'partido programado' : 'partidos programados'}
            </Badge>
          </div>
          
          {showUpcoming && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 pt-1 pb-2">
                {upcomingMatches.map((match, index) => {
                  const opponent = opponents.find(o => o.id === match.opponentId);
                  const field = fields.find(f => f.id === match.fieldId);
                  const date = new Date(match.date);
                  
                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group cursor-pointer border-l-4 border-l-emerald-500 h-full" 
                        onClick={() => toggleExpand(match.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <Badge className={cn(
                                  "text-[10px] uppercase font-black px-2 py-0.5 rounded-md w-fit",
                                  match.type === 'league' ? "bg-blue-100 text-blue-700" :
                                  match.type === 'cup' ? "bg-purple-100 text-purple-700" :
                                  "bg-gray-100 text-gray-700"
                                )}>
                                  {match.type === 'league' ? 'Liga' : match.type === 'cup' ? 'Copa' : 'Amistoso'}
                                </Badge>
                                {(() => {
                                  const season = seasons.find(s => s.id === match.seasonId);
                                  return season?.division && (
                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                                      {season.division}
                                    </span>
                                  );
                                })()}
                              </div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase">
                                {match.isHome ? 'Local' : 'Visitante'}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 group-hover:bg-emerald-50 transition-colors">
                                {opponent?.shieldUrl ? (
                                  <img src={opponent.shieldUrl} alt={opponent.name} className="w-7 h-7 object-contain" referrerPolicy="no-referrer" />
                                ) : (
                                  <Shield size={20} className="text-gray-300" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">{opponent?.name || 'Rival'}</h4>
                                <p className="text-[11px] text-gray-500 flex items-center gap-1 font-medium">
                                  <Calendar size={12} className="text-emerald-500" />
                                  {format(date, 'd MMM, HH:mm', { locale: es })}
                                </p>
                              </div>
                            </div>

                            {field && (
                              <div className="pt-2 border-t border-gray-50 flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                                <MapPin size={12} className="shrink-0 text-gray-300" />
                                <span className="truncate">{field.name}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </section>
      )}

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
                {filteredOpponents.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
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

          {/* Filtro de Año */}
          <div className="flex-1 min-w-[150px]">
            <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Año</Label>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="border-none bg-gray-50 rounded-xl h-10 mt-1">
                <SelectValue>
                  {filterYear === 'all' 
                    ? 'Todos los años' 
                    : filterYear || <span className="text-gray-400">Todos los años</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los años</SelectItem>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
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

          {/* Filtro de Estado */}
          <div className="flex-1 min-w-[150px]">
            <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Estado</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="border-none bg-gray-50 rounded-xl h-10 mt-1">
                <SelectValue>
                  {filterStatus === 'all' ? 'Todos' :
                  filterStatus === 'completed' ? 'Jugados' :
                  filterStatus === 'scheduled' ? 'Pendientes' :
                  <span className="text-gray-400">Todos</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completed">Jugados</SelectItem>
                <SelectItem value="scheduled">Pendientes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-50 rounded-xl p-1 h-10">
            <Tooltip>
              <TooltipTrigger render={
                <Button 
                  variant={viewMode === 'list' ? 'default' : 'ghost'} 
                  size="icon" 
                  onClick={() => setViewMode('list')}
                  className={cn("rounded-lg h-8 w-8", viewMode === 'list' ? "bg-white shadow-sm text-emerald-600 hover:bg-white" : "text-gray-400")}
                >
                  <ListIcon size={16} />
                </Button>
              } />
              <TooltipContent>Vista de Lista</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={
                <Button 
                  variant={viewMode === 'compact' ? 'default' : 'ghost'} 
                  size="icon" 
                  onClick={() => setViewMode('compact')}
                  className={cn("rounded-lg h-8 w-8", viewMode === 'compact' ? "bg-white shadow-sm text-emerald-600 hover:bg-white" : "text-gray-400")}
                >
                  <LayoutGrid size={16} />
                </Button>
              } />
              <TooltipContent>Vista Compacta</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={
                <Button 
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
                  size="icon" 
                  onClick={() => setViewMode('calendar')}
                  className={cn("rounded-lg h-8 w-8", viewMode === 'calendar' ? "bg-white shadow-sm text-emerald-600 hover:bg-white" : "text-gray-400")}
                >
                  <Calendar size={16} />
                </Button>
              } />
              <TooltipContent>Vista de Calendario</TooltipContent>
            </Tooltip>
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
            const associatedLineup = lineups.find(l => l.matchId === match.id);

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
                      
                      <div className="flex-1 p-4 flex flex-col sm:flex-row items-center gap-4 w-full">
                        <div className="text-center sm:text-left min-w-[120px] flex flex-col justify-center">
                          <div className="mb-2 flex flex-wrap gap-1 justify-center sm:justify-start">
                            {match.type === 'league' && <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">Liga {match.round ? `- ${match.round}` : ''}</Badge>}
                            {match.type === 'cup' && <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-none">Copa {match.round ? `- ${match.round}` : ''}</Badge>}
                            {(!match.type || match.type === 'friendly') && <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-none">Amistoso</Badge>}
                            {season && (
                              <Badge variant="outline" className="text-gray-500 border-gray-200">
                                {season.name} {season.division && `(${season.division})`}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-center sm:justify-start gap-2 mb-2 sm:hidden">
                            <p className="text-sm font-black truncate max-w-[250px]">
                              {match.isHome !== false ? (team?.name || 'MI EQUIPO') : (opponent?.name || 'RIVAL')} 
                              <span className="mx-2 text-gray-300 font-normal">vs</span>
                              {match.isHome !== false ? (opponent?.name || 'RIVAL') : (team?.name || 'MI EQUIPO')}
                            </p>
                          </div>
                          <div className="flex items-center justify-center sm:justify-start gap-2 text-gray-500">
                            <div className="text-center">
                              <p className="text-xs font-bold uppercase tracking-wider">
                                {format(new Date(match.date), 'EEEE', { locale: es })}
                              </p>
                              <p className="text-lg font-bold text-[#141414]">
                                {format(new Date(match.date), 'dd MMM', { locale: es })}
                              </p>
                            </div>
                            <div className="h-8 w-px bg-gray-200 mx-2 hidden sm:block"></div>
                            <div className="text-left hidden sm:block">
                              <p className="text-xs flex items-center gap-1.5 font-medium">
                                <Clock size={12} /> {format(new Date(match.date), 'HH:mm')}
                              </p>
                              {(match.fieldId || match.location) && (
                                <div className="text-xs flex items-center gap-1.5 mt-0.5">
                                  <MapPin size={12} className="text-emerald-600" /> 
                                  {match.fieldId ? (
                                    (() => {
                                      const field = fields.find(f => f.id === match.fieldId);
                                      return field?.location ? (
                                        <a 
                                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(field.location)}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="hover:text-emerald-600 transition-colors truncate max-w-[120px]"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {field.name}
                                        </a>
                                      ) : (
                                        <span className="truncate max-w-[120px]">{field?.name || 'Campo desconocido'}</span>
                                      );
                                    })()
                                  ) : (
                                    <span className="truncate max-w-[120px]">{match.location}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 flex items-center justify-center gap-4 sm:gap-8 w-full">
                          {/* Home Team */}
                            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                              <span className="text-xl font-black truncate w-full text-center">
                                {match.isHome !== false ? (team?.name || 'MI EQUIPO') : (opponent?.name || 'RIVAL')}
                              </span>
                              {match.isHome !== false ? (
                                team?.shieldUrl ? <img src={team.shieldUrl} alt={team.name} className="w-20 h-24 rounded-xl object-cover border bg-white shadow-md" referrerPolicy="no-referrer" /> : <div className="w-20 h-24 rounded-xl bg-gray-100" />
                              ) : (
                                opponent?.shieldUrl ? <img src={opponent.shieldUrl} alt={opponent.name} className="w-20 h-24 rounded-xl object-cover border bg-white shadow-md" referrerPolicy="no-referrer" /> : <div className="w-20 h-24 rounded-xl bg-gray-100" />
                              )}
                            </div>

                          <div className="flex flex-col items-center gap-2">
                            {isCompleted && (
                              <Badge className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-none",
                                isWin ? "bg-emerald-500 text-white border-emerald-400" :
                                isLoss ? "bg-red-500 text-white border-red-400" :
                                "bg-gray-400 text-white border-gray-300"
                              )}>
                                {isWin ? 'Victoria' : isLoss ? 'Derrota' : 'Empate'}
                              </Badge>
                            )}
                            <div className="flex items-center gap-4">
                              {isCompleted ? (
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "text-4xl font-black w-14 h-14 flex items-center justify-center rounded-2xl shadow-sm border-2",
                                    isWin ? "bg-emerald-50 border-emerald-200 text-emerald-600" :
                                    isLoss ? "bg-red-50 border-red-200 text-red-600" :
                                    "bg-gray-50 border-gray-200 text-gray-500"
                                  )}>
                                    {match.isHome !== false ? match.scoreTeam : match.scoreOpponent}
                                  </div>
                                  <span className="text-gray-300 font-bold text-2xl">-</span>
                                  <div className={cn(
                                    "text-4xl font-black w-14 h-14 flex items-center justify-center rounded-2xl shadow-sm border-2",
                                    isWin ? "bg-emerald-50 border-emerald-200 text-emerald-600" :
                                    isLoss ? "bg-red-50 border-red-200 text-red-600" :
                                    "bg-gray-50 border-gray-200 text-gray-500"
                                  )}>
                                    {match.isHome !== false ? match.scoreOpponent : match.scoreTeam}
                                  </div>
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
                          <div className="flex-1 flex flex-col items-center gap-2 hidden sm:flex">
                            <span className="text-xl font-black truncate w-full text-center">
                              {match.isHome !== false ? (opponent?.name || 'RIVAL') : (team?.name || 'MI EQUIPO')}
                            </span>
                            {match.isHome !== false ? (
                              opponent?.shieldUrl ? <img src={opponent.shieldUrl} alt={opponent.name} className="w-20 h-24 rounded-xl object-cover border bg-white shadow-md" referrerPolicy="no-referrer" /> : <div className="w-20 h-24 rounded-xl bg-gray-100" />
                            ) : (
                              team?.shieldUrl ? <img src={team.shieldUrl} alt={team.name} className="w-20 h-24 rounded-xl object-cover border bg-white shadow-md" referrerPolicy="no-referrer" /> : <div className="w-20 h-24 rounded-xl bg-gray-100" />
                            )}
                          </div>
                        </div>

                          <div className="flex gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="h-10 w-10 rounded-xl hover:bg-gray-100 flex items-center justify-center outline-none">
                                <MoreVertical size={18} className="text-gray-500" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                                <DropdownMenuItem onClick={() => setSelectedMatchForDetails(match)} className="gap-2 cursor-pointer">
                                  <Eye size={16} className="text-gray-500" />
                                  <span>Ver Detalles</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/matches/${match.id}/stats`)} className="gap-2 cursor-pointer">
                                  <ClipboardList size={16} className="text-gray-500" />
                                  <span>Convocatoria y Estadísticas</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => handleLineupClick(e, match.id, !!associatedLineup)} className="gap-2 cursor-pointer">
                                  <LayoutGrid size={16} className={associatedLineup ? "text-emerald-600" : "text-gray-500"} />
                                  <span className={associatedLineup ? "text-emerald-600 font-medium" : ""}>
                                    {associatedLineup ? "Ver Alineación" : "Crear Alineación"}
                                  </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/matches/${match.id}/edit`)} className="gap-2 cursor-pointer">
                                  <Pencil size={16} className="text-gray-500" />
                                  <span>Editar Partido</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDeleteMatch(match.id)} className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                                  <Trash2 size={16} />
                                  <span>Eliminar Partido</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        ) : viewMode === 'compact' ? (
          <div className="space-y-4">
            {Object.entries(matchesByMonth).map(([monthYear, monthMatches]) => (
              <div key={monthYear} className="space-y-2">
                <div className="flex items-center gap-3 px-2">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{monthYear}</h3>
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-[9px] font-bold text-gray-400 uppercase">
                    {monthMatches.length} {monthMatches.length === 1 ? 'partido' : 'partidos'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
                  {monthMatches.map((match) => {
                    const opponent = opponents.find(o => o.id === match.opponentId);
                    const isCompleted = match.status === 'completed';
                    const isWin = isCompleted && (match.scoreTeam || 0) > (match.scoreOpponent || 0);
                    const isLoss = isCompleted && (match.scoreTeam || 0) < (match.scoreOpponent || 0);
                    const associatedLineup = lineups.find(l => l.matchId === match.id);

                    return (
                      <Card 
                        key={match.id} 
                        className={cn(
                          "border-2 shadow-none hover:shadow-md transition-all rounded-3xl cursor-pointer group overflow-hidden",
                          isCompleted 
                            ? (isWin ? "border-emerald-200 bg-emerald-50/20" : isLoss ? "border-red-200 bg-red-50/20" : "border-gray-200 bg-gray-50/40") 
                            : "border-blue-100 bg-blue-50/10"
                        )}
                        onClick={() => setSelectedMatchForDetails(match)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            {/* Date Badge */}
                            <div className={cn(
                              "flex flex-col items-center justify-center w-12 h-12 rounded-2xl shrink-0 border-2 shadow-sm",
                              isCompleted 
                                ? (isWin ? "bg-emerald-600 border-emerald-500 text-white" : isLoss ? "bg-red-600 border-red-500 text-white" : "bg-gray-400 border-gray-300 text-white") 
                                : "bg-blue-600 border-blue-500 text-white"
                            )}>
                              <span className="text-[9px] font-black uppercase leading-none mb-0.5">
                                {format(new Date(match.date), 'EEE', { locale: es })}
                              </span>
                              <span className="text-lg font-black leading-none">
                                {format(new Date(match.date), 'dd')}
                              </span>
                            </div>

                            {/* Match Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-wider truncate",
                                  isCompleted 
                                    ? (isWin ? "text-emerald-700" : isLoss ? "text-red-700" : "text-gray-500") 
                                    : "text-blue-700"
                                )}>
                                  {isCompleted ? (isWin ? 'Victoria' : isLoss ? 'Derrota' : 'Empate') : 'Pendiente'}
                                </span>
                                {match.round && (
                                  <span className="text-[9px] font-black text-gray-400 uppercase">
                                    {match.type === 'league' ? `J${match.round}` : match.round}
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {match.isHome !== false ? (
                                    team?.shieldUrl ? <img src={team.shieldUrl} className="w-5 h-6 object-contain shrink-0" referrerPolicy="no-referrer" /> : <Shield size={12} className="text-gray-400 shrink-0" />
                                  ) : (
                                    opponent?.shieldUrl ? <img src={opponent.shieldUrl} className="w-5 h-6 object-contain shrink-0" referrerPolicy="no-referrer" /> : <Shield size={12} className="text-gray-400 shrink-0" />
                                  )}
                                  <span className="text-xs font-bold text-gray-900 truncate">
                                    {match.isHome !== false ? (team?.name || 'MI EQUIPO') : (opponent?.name || 'RIVAL')}
                                  </span>
                                </div>
                                {isCompleted && (
                                  <span className={cn(
                                    "text-base font-black",
                                    isWin ? "text-emerald-600" : isLoss ? "text-red-600" : "text-gray-500"
                                  )}>
                                    {match.isHome !== false ? match.scoreTeam : match.scoreOpponent}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-2 mt-0.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  {match.isHome !== false ? (
                                    opponent?.shieldUrl ? <img src={opponent.shieldUrl} className="w-5 h-6 object-contain shrink-0" referrerPolicy="no-referrer" /> : <Shield size={12} className="text-gray-400 shrink-0" />
                                  ) : (
                                    team?.shieldUrl ? <img src={team.shieldUrl} className="w-5 h-6 object-contain shrink-0" referrerPolicy="no-referrer" /> : <Shield size={12} className="text-gray-400 shrink-0" />
                                  )}
                                  <span className="text-xs font-bold text-gray-900 truncate">
                                    {match.isHome !== false ? (opponent?.name || 'RIVAL') : (team?.name || 'MI EQUIPO')}
                                  </span>
                                </div>
                                {isCompleted ? (
                                  <span className={cn(
                                    "text-base font-black",
                                    isLoss ? "text-red-600" : "text-gray-900"
                                  )}>
                                    {match.isHome !== false ? match.scoreOpponent : match.scoreTeam}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">Pendiente</span>
                                )}
                              </div>
                            </div>

                            {/* More Actions Menu */}
                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger 
                                  className="h-8 w-8 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center outline-none"
                                >
                                  <MoreVertical size={16} />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl border-none shadow-xl min-w-[160px]">
                                  <DropdownMenuItem onClick={() => setSelectedMatchForDetails(match)} className="gap-2 py-2 cursor-pointer rounded-lg">
                                    <Eye size={14} className="text-emerald-600" />
                                    <span className="font-bold text-xs">Ver Detalles</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate(`/matches/${match.id}/stats`)} className="gap-2 py-2 cursor-pointer rounded-lg">
                                    <ClipboardList size={14} className="text-emerald-600" />
                                    <span className="font-bold text-xs">Estadísticas</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate(`/matches/${match.id}/edit`)} className="gap-2 py-2 cursor-pointer rounded-lg">
                                    <Pencil size={14} className="text-blue-600" />
                                    <span className="font-bold text-xs">Editar Partido</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => handleLineupClick(e as any, match.id, !!associatedLineup)} className="gap-2 py-2 cursor-pointer rounded-lg">
                                    <LayoutGrid size={14} className={associatedLineup ? "text-emerald-600" : "text-gray-400"} />
                                    <span className="font-bold text-xs">{associatedLineup ? 'Ver Alineación' : 'Crear Alineación'}</span>
                                  </DropdownMenuItem>
                                  <div className="h-px bg-gray-50 my-1" />
                                  <DropdownMenuItem onClick={() => onDeleteMatch(match.id)} className="gap-2 py-2 cursor-pointer rounded-lg text-red-600 focus:text-red-600 focus:bg-red-50">
                                    <Trash2 size={14} />
                                    <span className="font-bold text-xs">Eliminar</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-black text-gray-900 capitalize">
                  {format(currentCalendarDate, 'MMMM yyyy', { locale: es })}
                </h3>
                <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1">
                  <Button variant="ghost" size="icon" onClick={prevMonth} className="h-7 w-7 rounded-lg">
                    <ChevronLeft size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentCalendarDate(new Date())} className="px-3 h-7 text-xs font-bold uppercase tracking-wider">
                    Hoy
                  </Button>
                  <Button variant="ghost" size="icon" onClick={nextMonth} className="h-7 w-7 rounded-lg">
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" /> Victoria
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500" /> Derrota
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400" /> Pendiente
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-gray-100">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                <div key={day} className="py-2 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] bg-gray-50/30">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-[90px]">
              {calendarDays.map((day, i) => {
                const dayMatches = getMatchesForDay(day);
                const isCurrentMonth = isSameMonth(day, currentCalendarDate);
                const isTodayDate = isToday(day);

                return (
                  <div 
                    key={day.toString()} 
                    className={cn(
                      "border-r border-b border-gray-100 p-1.5 transition-colors relative group",
                      !isCurrentMonth ? "bg-gray-50/50" : "bg-white",
                      isTodayDate && "bg-emerald-50/30"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn(
                        "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                        isTodayDate ? "bg-emerald-600 text-white shadow-sm" : 
                        isCurrentMonth ? "text-gray-900" : "text-gray-300"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    <div className="space-y-1 overflow-y-auto max-h-[60px] scrollbar-hide">
                      {dayMatches.map(match => {
                        const opponent = opponents.find(o => o.id === match.opponentId);
                        const isCompleted = match.status === 'completed';
                        const isWin = isCompleted && (match.scoreTeam || 0) > (match.scoreOpponent || 0);
                        const isLoss = isCompleted && (match.scoreTeam || 0) < (match.scoreOpponent || 0);
                        
                        return (
                          <Tooltip key={match.id}>
                            <TooltipTrigger onClick={() => navigate(`/matches/${match.id}/stats`)}>
                              <div 
                                className={cn(
                                  "text-[10px] p-1.5 rounded-lg border cursor-pointer transition-all truncate font-bold flex items-center gap-1.5",
                                  !isCompleted ? "bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100" :
                                  isWin ? "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                                  isLoss ? "bg-red-50 border-red-100 text-red-700 hover:bg-red-100" :
                                  "bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100"
                                )}
                              >
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full shrink-0",
                                  !isCompleted ? "bg-blue-400" : isWin ? "bg-emerald-500" : isLoss ? "bg-red-500" : "bg-gray-400"
                                )} />
                                <span className="truncate">
                                  {match.isHome !== false ? 'vs ' : '@ '}{opponent?.name || 'Rival'}
                                </span>
                                {isCompleted && (
                                  <span className={cn(
                                    "ml-auto font-black text-[9px]",
                                    isWin ? "text-emerald-600" : isLoss ? "text-red-600" : "text-gray-500"
                                  )}>
                                    {match.isHome !== false ? `${match.scoreTeam}-${match.scoreOpponent}` : `${match.scoreOpponent}-${match.scoreTeam}`}
                                  </span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="p-3 rounded-xl border-none shadow-xl bg-gray-900 text-white">
                              <div className="space-y-1">
                                <p className="font-bold text-xs">{opponent?.name || 'Rival'}</p>
                                <p className="text-[10px] text-gray-400">
                                  {format(new Date(match.date), 'HH:mm')} • {match.type === 'league' ? 'Liga' : match.type === 'cup' ? 'Copa' : 'Amistoso'}
                                  {(() => {
                                    const season = seasons.find(s => s.id === match.seasonId);
                                    return season?.division ? ` • ${season.division}` : '';
                                  })()}
                                </p>
                              {isCompleted && (
                                <p className={cn(
                                  "text-xs font-black",
                                  isWin ? "text-emerald-400" : isLoss ? "text-red-400" : "text-gray-400"
                                )}>
                                  Resultado: {match.scoreTeam} - {match.scoreOpponent}
                                </p>
                              )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
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
              {/* Instagram Post Container (1080x1350 aspect ratio simulated) */}
              <div 
                ref={instagramPostRef}
                className="w-[400px] h-[500px] bg-emerald-900 text-white p-10 flex flex-col relative overflow-hidden shadow-xl"
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
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Temporada {seasons.find(s => s.id === globalSeasonId)?.name || '23/24'}</p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 overflow-hidden">
                    {filteredMatches.slice(0, 5).map((m) => {
                      const opp = opponents.find(o => o.id === m.opponentId);
                      return (
                        <div key={m.id} className="bg-white/5 backdrop-blur-sm border border-white/5 p-2 rounded-xl flex items-center gap-3">
                          <div className="flex flex-col items-center min-w-[30px] border-r border-white/10 pr-2">
                            <span className="text-sm font-black leading-none">{format(new Date(m.date), 'dd')}</span>
                            <span className="text-[6px] font-bold uppercase text-emerald-400">{format(new Date(m.date), 'EEE', { locale: es })}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black truncate uppercase leading-tight">
                              {m.isHome !== false ? 'vs ' : '@ '}{opp?.name || 'RIVAL'}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge className="text-[6px] h-2.5 px-1 bg-emerald-500/20 text-emerald-300 border-none font-black uppercase">
                                {m.type === 'league' ? 'Liga' : m.type === 'cup' ? 'Copa' : 'Amistoso'}
                              </Badge>
                              {(m.fieldId || m.location) && (
                                <span className="text-[6px] font-bold text-white/50 truncate flex items-center gap-0.5">
                                  <MapPin size={6} className="text-emerald-400" /> 
                                  {m.fieldId ? (
                                    (() => {
                                      const field = fields.find(f => f.id === m.fieldId);
                                      return field?.name || 'Campo desconocido';
                                    })()
                                  ) : (
                                    m.location
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-black">{format(new Date(m.date), 'HH:mm')}</p>
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
      <Dialog open={noConvocatoriaModalOpen} onOpenChange={setNoConvocatoriaModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <ClipboardList size={20} />
              Sin Convocatoria
            </DialogTitle>
            <DialogDescription>
              No hay jugadores convocados para este partido. Para crear una alineación, primero debes registrar la convocatoria en la sección de estadísticas del partido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setNoConvocatoriaModalOpen(false)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match Details Modal */}
      <Dialog open={!!selectedMatchForDetails} onOpenChange={(open) => !open && setSelectedMatchForDetails(null)}>
        <DialogContent className="sm:max-w-5xl rounded-3xl border-none shadow-2xl p-0 overflow-hidden bg-white max-h-[95vh] flex flex-col">
          {selectedMatchForDetails && (() => {
            const match = selectedMatchForDetails;
            const opponent = opponents.find(o => o.id === match.opponentId);
            const field = fields.find(f => f.id === match.fieldId);
            const season = seasons.find(s => s.id === match.seasonId);
            const isCompleted = match.status === 'completed';
            const isWin = isCompleted && (match.scoreTeam || 0) > (match.scoreOpponent || 0);
            const isLoss = isCompleted && (match.scoreTeam || 0) < (match.scoreOpponent || 0);
            
            // Get all players for this season
            const seasonPlayerIds = playerSeasons
              .filter(ps => ps.seasonId === match.seasonId)
              .map(ps => ps.playerId);
            const seasonPlayers = players.filter(p => seasonPlayerIds.includes(p.id));

            // Organize attendance
            const matchStats = stats.filter(s => s.matchId === match.id && s.attendance === 'attending');
            const justifiedStats = stats.filter(s => s.matchId === match.id && s.attendance === 'justified');
            const notAttendingStats = stats.filter(s => s.matchId === match.id && s.attendance === 'notAttending');
            
            // "No Response" includes those with explicit 'noResponse' status OR no status record at all
            const respondedPlayerIds = stats
              .filter(s => s.matchId === match.id && s.attendance !== 'noResponse')
              .map(s => s.playerId);
            
            const noResponsePlayers = seasonPlayers.filter(p => !respondedPlayerIds.includes(p.id));

            return (
              <>
                <DialogHeader className="p-6 bg-emerald-900 text-white relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                  <div className="relative z-10">
                      <div className="flex flex-col items-center gap-1 mb-4">
                        <div className="flex justify-center items-center gap-4">
                          <Badge className={cn(
                            "uppercase font-black px-3 py-0.5 rounded-lg border-none text-[10px]",
                            match.type === 'league' ? "bg-blue-500 text-white" :
                            match.type === 'cup' ? "bg-purple-500 text-white" :
                            "bg-gray-500 text-white"
                          )}>
                            {match.type === 'league' ? 'Liga' : match.type === 'cup' ? 'Copa' : 'Amistoso'}
                          </Badge>
                          {match.round && (
                            <span className="text-emerald-400 font-black uppercase tracking-widest text-[10px]">
                              {match.type === 'league' ? `Jornada ${match.round}` : match.round}
                            </span>
                          )}
                        </div>
                        {season?.division && (
                          <span className="text-[9px] font-black text-emerald-500/70 uppercase tracking-[0.2em]">
                            {season.division}
                          </span>
                        )}
                      </div>

                    <div className="flex items-center justify-between gap-4 sm:gap-12">
                      {/* Home */}
                      <div className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-lg font-black text-center leading-tight min-h-[2.5rem] flex items-center">
                          {match.isHome !== false ? (team?.name || 'MI EQUIPO') : (opponent?.name || 'RIVAL')}
                        </span>
                        {match.isHome !== false ? (
                          team?.shieldUrl ? <img src={team.shieldUrl} alt={team.name} className="w-16 h-20 rounded-xl object-cover border-2 border-white/20 bg-white shadow-xl" referrerPolicy="no-referrer" /> : <div className="w-16 h-20 rounded-xl bg-white/10 border-2 border-dashed border-white/20" />
                        ) : (
                          opponent?.shieldUrl ? <img src={opponent.shieldUrl} alt={opponent.name} className="w-16 h-20 rounded-xl object-cover border-2 border-white/20 bg-white shadow-xl" referrerPolicy="no-referrer" /> : <div className="w-16 h-20 rounded-xl bg-white/10 border-2 border-dashed border-white/20" />
                        )}
                      </div>

                      {/* Score/VS */}
                      <div className="flex flex-col items-center gap-2">
                        {isCompleted ? (
                          <div className="flex flex-col items-center gap-3">
                            <Badge className={cn(
                              "text-xs font-black uppercase tracking-[0.2em] px-4 py-1 rounded-full border-none shadow-lg",
                              isWin ? "bg-emerald-500 text-white" : isLoss ? "bg-red-500 text-white" : "bg-gray-500 text-white"
                            )}>
                              {isWin ? 'Victoria' : isLoss ? 'Derrota' : 'Empate'}
                            </Badge>
                            <div className="flex items-center gap-6">
                              <span className={cn(
                                "text-6xl font-black drop-shadow-md",
                                isWin ? "text-emerald-400" : isLoss ? "text-red-400" : "text-white"
                              )}>
                                {match.isHome !== false ? match.scoreTeam : match.scoreOpponent}
                              </span>
                              <span className="text-3xl text-white/20 font-bold">-</span>
                              <span className={cn(
                                "text-6xl font-black drop-shadow-md",
                                isLoss ? "text-red-400" : "text-white/90"
                              )}>
                                {match.isHome !== false ? match.scoreOpponent : match.scoreTeam}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="px-6 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
                            <span className="text-xl font-black tracking-[0.3em]">VS</span>
                          </div>
                        )}
                        <div className="flex flex-col items-center text-emerald-400 font-bold text-[10px] uppercase tracking-widest">
                          <span>{format(new Date(match.date), 'dd MMM yyyy', { locale: es })}</span>
                          <span>{format(new Date(match.date), 'HH:mm')}</span>
                        </div>
                      </div>

                      {/* Away */}
                      <div className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-lg font-black text-center leading-tight min-h-[2.5rem] flex items-center">
                          {match.isHome !== false ? (opponent?.name || 'RIVAL') : (team?.name || 'MI EQUIPO')}
                        </span>
                        {match.isHome !== false ? (
                          opponent?.shieldUrl ? <img src={opponent.shieldUrl} alt={opponent.name} className="w-16 h-20 rounded-xl object-cover border-2 border-white/20 bg-white shadow-xl" referrerPolicy="no-referrer" /> : <div className="w-16 h-20 rounded-xl bg-white/10 border-2 border-dashed border-white/20" />
                        ) : (
                          team?.shieldUrl ? <img src={team.shieldUrl} alt={team.name} className="w-16 h-20 rounded-xl object-cover border-2 border-white/20 bg-white shadow-xl" referrerPolicy="no-referrer" /> : <div className="w-16 h-20 rounded-xl bg-white/10 border-2 border-dashed border-white/20" />
                        )}
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Info */}
                    <div className="lg:col-span-4 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <MapPin size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ubicación</p>
                            {field ? (
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-900 truncate">{field.name}</p>
                                {field.location && (
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(field.location)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-600 hover:text-emerald-700 shrink-0"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <p className="font-bold text-gray-900 truncate">{match.location || 'No especificada'}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <Trophy size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Temporada</p>
                            <p className="font-bold text-gray-900">{season?.name || 'General'}</p>
                            {season?.division && (
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{season.division}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex flex-col justify-center items-center text-center">
                        <Users size={32} className="text-emerald-600 mb-2" />
                        <p className="text-3xl font-black text-emerald-900">{matchStats.length}</p>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Jugadores Convocados</p>
                        <div className="flex flex-wrap justify-center gap-2 mt-2">
                          {justifiedStats.length > 0 && (
                            <span className="text-[9px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-md">{justifiedStats.length} Justificados</span>
                          )}
                          {notAttendingStats.length > 0 && (
                            <span className="text-[9px] font-bold text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded-md">{notAttendingStats.length} No Asisten</span>
                          )}
                          {noResponsePlayers.length > 0 && (
                            <span className="text-[9px] font-bold text-gray-500 uppercase bg-gray-100 px-2 py-0.5 rounded-md">{noResponsePlayers.length} Sin Respuesta</span>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-100">
                        <Button 
                          onClick={() => navigate(`/matches/${match.id}/stats`)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold"
                        >
                          <Pencil size={18} className="mr-2" />
                          Gestionar Estadísticas
                        </Button>
                      </div>
                    </div>

                    {/* Right Column: Player Stats */}
                    <div className="lg:col-span-8 space-y-6">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Convocatoria y Rendimiento</h4>
                        <div className="h-px flex-1 bg-gray-100" />
                      </div>

                      {matchStats.length > 0 || justifiedStats.length > 0 || notAttendingStats.length > 0 || noResponsePlayers.length > 0 ? (
                        <div className="space-y-8">
                          {matchStats.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
                              {['Portero', 'Defensa', 'Medio', 'Delantero'].map((pos) => {
                                const posStats = matchStats.filter(s => players.find(p => p.id === s.playerId)?.position === pos);
                                if (posStats.length === 0) return null;

                                return (
                                  <div key={pos} className="space-y-3">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest px-2 bg-emerald-50 w-fit rounded-md py-0.5">{pos}s</p>
                                    <div className="space-y-2">
                                      {posStats.map(stat => {
                                        const player = players.find(p => p.id === stat.playerId);
                                        if (!player) return null;
                                        const hasActions = stat.goals > 0 || stat.assists > 0 || stat.yellowCards > 0 || stat.redCards > 0;

                                        return (
                                          <div key={stat.id} className="flex items-center justify-between p-2.5 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-emerald-200 transition-colors">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 text-[10px] font-black text-emerald-600 shrink-0">
                                                {player.number}
                                              </div>
                                              <span className="font-bold text-gray-900 text-sm truncate">{player.alias || player.firstName}</span>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                              {stat.goals > 0 && Array.from({ length: stat.goals }).map((_, i) => <Trophy key={i} size={12} className="text-emerald-500" />)}
                                              {stat.assists > 0 && Array.from({ length: stat.assists }).map((_, i) => <Star key={i} size={12} className="text-blue-500" />)}
                                              {stat.yellowCards > 0 && <div className="w-2 h-3 bg-yellow-400 rounded-sm" />}
                                              {stat.redCards > 0 && <div className="w-2 h-3 bg-red-500 rounded-sm" />}
                                              {!hasActions && <span className="text-[9px] font-bold text-gray-300 uppercase">Presente</span>}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {justifiedStats.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Ausencias Justificadas</h4>
                                <div className="h-px flex-1 bg-blue-50" />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {justifiedStats.map(stat => {
                                  const player = players.find(p => p.id === stat.playerId);
                                  if (!player) return null;
                                  return (
                                    <Badge key={stat.id} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 rounded-lg flex items-center gap-2">
                                      <ShieldCheck size={12} />
                                      <span className="font-bold">{player.alias || player.firstName}</span>
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {notAttendingStats.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest">No Asisten</h4>
                                <div className="h-px flex-1 bg-red-50" />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {notAttendingStats.map(stat => {
                                  const player = players.find(p => p.id === stat.playerId);
                                  if (!player) return null;
                                  return (
                                    <Badge key={stat.id} variant="secondary" className="bg-red-50 text-red-700 border-red-100 px-3 py-1 rounded-lg flex items-center gap-2">
                                      <XCircle size={12} />
                                      <span className="font-bold">{player.alias || player.firstName}</span>
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {noResponsePlayers.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Sin Respuesta</h4>
                                <div className="h-px flex-1 bg-gray-100" />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {noResponsePlayers.map(player => {
                                  return (
                                    <Badge key={player.id} variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200 px-3 py-1 rounded-lg flex items-center gap-2">
                                      <HelpCircle size={12} />
                                      <span className="font-bold">{player.alias || player.firstName}</span>
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                          <ClipboardList className="mx-auto text-gray-300 mb-3" size={48} />
                          <p className="text-gray-400 font-medium">No hay jugadores registrados en la convocatoria.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
