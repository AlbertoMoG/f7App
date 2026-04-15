import React from 'react';
import { 
  Search, 
  Edit2, 
  UserPlus,
  Shield,
  Sword,
  Crosshair,
  Upload,
  Loader2,
  LayoutGrid,
  List,
  Layers,
  X,
  Info,
  UserMinus,
  UserCheck,
  Trash2,
  MoreVertical,
  Stethoscope,
  Activity,
  History,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Users,
  ClipboardCheck,
  Bandage
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Player, Position, PlayerStat, Season, Match, PlayerSeason, Injury, Opponent } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { uploadImage } from '../lib/imageUpload';
import { calculatePlayerRating } from '../lib/ratingSystem';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import InjuredPlayers from './InjuredPlayers';
import AttendanceTracker from './AttendanceTracker';

interface PlayerListProps {
  players: Player[];
  playerSeasons: PlayerSeason[];
  stats: PlayerStat[];
  matches: Match[];
  seasons: Season[];
  injuries: Injury[];
  opponents: Opponent[];
  globalSeasonId: string;
  onAddPlayer: (player: Omit<Player, 'id' | 'teamId'>) => void;
  onUpdatePlayer: (player: Player, seasonIds: string[]) => void;
  onDeletePlayer: (id: string) => void;
  onAddInjury: (injury: Omit<Injury, 'id' | 'teamId'>) => void;
  onUpdateInjury: (injury: Injury) => void;
  onUpdateAttendance?: (playerId: string, matchId: string, status: string) => Promise<void>;
}

const positionIcons: Record<Position, any> = {

  'Portero': Shield,
  'Defensa': Shield,
  'Medio': Sword,
  'Delantero': Crosshair
};

const positionColors: Record<Position, string> = {
  'Portero': 'bg-yellow-100 text-yellow-700',
  'Defensa': 'bg-blue-100 text-blue-700',
  'Medio': 'bg-emerald-100 text-emerald-700',
  'Delantero': 'bg-red-100 text-red-700'
};

const shortPositions: Record<Position, string> = {
  'Portero': 'POR',
  'Defensa': 'DEF',
  'Medio': 'MED',
  'Delantero': 'DEL'
};

const BAREMO_CONFIG = {
  WEIGHT_COMMITMENT: 0.60,
  WEIGHT_PERFORMANCE: 0.40,
  EXCELLENCE_GOAL: 10.0,
  POINTS: {
    WIN: 10,
    DRAW: 5,
    LOSS: 1,
    UNDER_4_GOALS: 4,
    GOAL: 10,
    ASSIST: 4,
    YELLOW: -1,
    RED: -3,
    NO_RESPONSE: -2,
    NO_ATTENDANCE: -0.15
  },
  REGULARITY_BONUS: 0.8
};

/**
 * Componente para mostrar y gestionar la lista de jugadores.
 * Permite añadir, editar y eliminar jugadores, así como ver sus estadísticas.
 */
export default function PlayerList({ players, playerSeasons, stats, matches, seasons, injuries, opponents, globalSeasonId, onAddPlayer, onUpdatePlayer, onDeletePlayer, onAddInjury, onUpdateInjury, onUpdateAttendance }: PlayerListProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<'plantilla' | 'asistencia' | 'lesionados'>('plantilla');
  const [viewMode, setViewMode] = React.useState<'grid' | 'table'>('table');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'active' | 'inactive' | 'all'>('active');
  const [positionFilter, setPositionFilter] = React.useState<Position | 'all'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingPlayer, setEditingPlayer] = React.useState<Player | null>(null);
  const [viewingPlayer, setViewingPlayer] = React.useState<Player | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = React.useState('');
  const [selectedSeasons, setSelectedSeasons] = React.useState<string[]>([]);
  const [injuryModalPlayer, setInjuryModalPlayer] = React.useState<Player | null>(null);
  const [recoveryModalPlayer, setRecoveryModalPlayer] = React.useState<Player | null>(null);
  const [groupByPosition, setGroupByPosition] = React.useState(true);
  const [sortConfig, setSortConfig] = React.useState<{
    field: 'number' | 'name' | 'position' | 'rating' | 'matches' | 'wins' | 'draws' | 'losses' | 'goals' | 'assists' | 'yellowCards' | 'redCards' | 'justified' | 'commitment' | 'performance' | 'attendanceRate';
    direction: 'asc' | 'desc';
  }>({ field: 'position', direction: 'asc' });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

const [selectedPosition, setSelectedPosition] = React.useState<Position | ''>('');

// Y modifica este useEffect que ya tenías para que también limpie la posición
React.useEffect(() => {
  if (editingPlayer) {
    setUploadedPhotoUrl(editingPlayer.photoUrl || '');
    setSelectedPosition(editingPlayer.position);
    const currentSeasons = playerSeasons
      .filter(ps => ps.playerId === editingPlayer.id)
      .map(ps => ps.seasonId);
    setSelectedSeasons(currentSeasons);
  } else {
    setUploadedPhotoUrl('');
    setSelectedPosition('');
    setSelectedSeasons([]);
  }
}, [editingPlayer, isAddDialogOpen, playerSeasons]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const url = await uploadImage(file, 'players');
      setUploadedPhotoUrl(url);
    } catch (error) {
      console.error("Error uploading player photo:", error);
      toast.error("Hubo un error al subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 0;
    const today = new Date();
    const birthDateObj = new Date(birthDate);
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const m = today.getMonth() - birthDateObj.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }
    return age;
  };

  const calculateRatingBreakdown = (player: Player) => {
    return calculatePlayerRating(matches, injuries, stats, player, globalSeasonId);
  };

  const calculateRating = (player: Player) => {
    return calculatePlayerRating(matches, injuries, stats, player, globalSeasonId).notaFinal.toFixed(2);
  };

  const getPlayerStatsBySeason = (playerId: string) => {
    const playerStats = stats.filter(s => s.playerId === playerId && (globalSeasonId === 'all' || s.seasonId === globalSeasonId));
    const statsBySeason: Record<string, { 
      matches: number, 
      goals: number, 
      assists: number, 
      yellowCards: number, 
      redCards: number,
      wins: number,
      draws: number,
      losses: number,
      justified: number
    }> = {};
    
    playerStats.forEach(s => {
      if (!statsBySeason[s.seasonId]) {
        statsBySeason[s.seasonId] = { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, wins: 0, draws: 0, losses: 0, justified: 0 };
      }
      
      if (s.attendance === 'attending') {
        statsBySeason[s.seasonId].matches += 1;
        
        // Calculate W/D/L
        const match = matches.find(m => m.id === s.matchId);
        if (match && match.status === 'completed' && match.scoreTeam !== undefined && match.scoreOpponent !== undefined) {
          if (match.scoreTeam > match.scoreOpponent) {
            statsBySeason[s.seasonId].wins += 1;
          } else if (match.scoreTeam === match.scoreOpponent) {
            statsBySeason[s.seasonId].draws += 1;
          } else {
            statsBySeason[s.seasonId].losses += 1;
          }
        }
      } else if (s.attendance === 'justified') {
        statsBySeason[s.seasonId].justified += 1;
      }
      statsBySeason[s.seasonId].goals += s.goals || 0;
      statsBySeason[s.seasonId].assists += s.assists || 0;
      statsBySeason[s.seasonId].yellowCards += s.yellowCards || 0;
      statsBySeason[s.seasonId].redCards += s.redCards || 0;
    });

    return statsBySeason;
  };

  const filteredPlayers = players.filter(p => {
    const matchesSearch = (
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.alias && p.alias.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'active' ? (p.isActive !== false) :
      (p.isActive === false);
    const matchesPosition = positionFilter === 'all' ? true : p.position === positionFilter;
    
    // Check if player is currently injured
    const activeInjury = injuries.find(i => i.playerId === p.id && !i.endDate);
    
    // Check if player is in the selected season
    const playerSeasonIds = playerSeasons.filter(ps => ps.playerId === p.id).map(ps => ps.seasonId);
    const matchesSeason = globalSeasonId === 'all' ? true : playerSeasonIds.includes(globalSeasonId);
    
    return matchesSearch && matchesStatus && matchesPosition && matchesSeason;
  });

  const playersWithStats = React.useMemo(() => {
    return filteredPlayers.map(player => {
      const playerSeasonStats = getPlayerStatsBySeason(player.id);
      const totals = Object.values(playerSeasonStats).reduce((acc, curr) => ({
        matches: acc.matches + curr.matches,
        goals: acc.goals + curr.goals,
        assists: acc.assists + curr.assists,
        yellowCards: acc.yellowCards + curr.yellowCards,
        redCards: acc.redCards + curr.redCards,
        wins: acc.wins + curr.wins,
        draws: acc.draws + curr.draws,
        losses: acc.losses + curr.losses,
        justified: acc.justified + curr.justified,
      }), { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, wins: 0, draws: 0, losses: 0, justified: 0 });
      
      const breakdown = calculateRatingBreakdown(player);
      
      return {
        ...player,
        totals,
        rating: breakdown.notaFinal,
        commitment: breakdown.notaCompromiso,
        performance: breakdown.notaDesempeno,
        attendanceRate: breakdown.partidosComputables > 0 
          ? (breakdown.partidosAsistidos / breakdown.partidosComputables) * 100 
          : 0
      };
    });
  }, [filteredPlayers, stats, matches, globalSeasonId]);

  const sortedPlayers = React.useMemo(() => {
    const sorted = [...playersWithStats];
    sorted.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortConfig.field) {
        case 'number':
          valA = a.number;
          valB = b.number;
          break;
        case 'name':
          valA = (a.alias || `${a.firstName} ${a.lastName}`).toLowerCase();
          valB = (b.alias || `${b.firstName} ${b.lastName}`).toLowerCase();
          break;
        case 'position':
          const posOrder = { 'Portero': 1, 'Defensa': 2, 'Medio': 3, 'Delantero': 4 };
          valA = posOrder[a.position as Position] || 99;
          valB = posOrder[b.position as Position] || 99;
          break;
        case 'rating':
          valA = a.rating;
          valB = b.rating;
          break;
        case 'matches':
          valA = a.totals.matches;
          valB = b.totals.matches;
          break;
        case 'wins':
          valA = a.totals.wins;
          valB = b.totals.wins;
          break;
        case 'draws':
          valA = a.totals.draws;
          valB = b.totals.draws;
          break;
        case 'losses':
          valA = a.totals.losses;
          valB = b.totals.losses;
          break;
        case 'goals':
          valA = a.totals.goals;
          valB = b.totals.goals;
          break;
        case 'assists':
          valA = a.totals.assists;
          valB = b.totals.assists;
          break;
        case 'yellowCards':
          valA = a.totals.yellowCards;
          valB = b.totals.yellowCards;
          break;
        case 'redCards':
          valA = a.totals.redCards;
          valB = b.totals.redCards;
          break;
        case 'justified':
          valA = a.totals.justified;
          valB = b.totals.justified;
          break;
        case 'commitment':
          valA = a.commitment;
          valB = b.commitment;
          break;
        case 'performance':
          valA = a.performance;
          valB = b.performance;
          break;
        case 'attendanceRate':
          valA = a.attendanceRate;
          valB = b.attendanceRate;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [playersWithStats, sortConfig]);

  const handleSort = (field: 'number' | 'name' | 'position' | 'rating' | 'matches' | 'wins' | 'draws' | 'losses' | 'goals' | 'assists' | 'yellowCards' | 'redCards' | 'justified' | 'commitment' | 'performance' | 'attendanceRate') => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ field }: { field: 'number' | 'name' | 'position' | 'rating' | 'matches' | 'wins' | 'draws' | 'losses' | 'goals' | 'assists' | 'yellowCards' | 'redCards' | 'justified' | 'commitment' | 'performance' | 'attendanceRate' }) => {
    if (sortConfig.field !== field) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={12} className="ml-1 text-emerald-600" /> 
      : <ArrowDown size={12} className="ml-1 text-emerald-600" />;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const photoUrl = uploadedPhotoUrl || formData.get('photoUrl') as string;
    const playerData: any = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      alias: (formData.get('alias') as string) || null,
      number: parseInt(formData.get('number') as string),
      position: formData.get('position') as Position,
      birthDate: formData.get('birthDate') as string,
      isActive: editingPlayer ? editingPlayer.isActive : true,
    };
    if (photoUrl) {
      playerData.photoUrl = photoUrl;
    } else {
      playerData.photoUrl = null;
    }

    if (editingPlayer) {
      onUpdatePlayer({ ...playerData, id: editingPlayer.id }, selectedSeasons);
      setEditingPlayer(null);
    } else {
      onAddPlayer({ ...playerData, seasonIds: selectedSeasons });
      setIsAddDialogOpen(false);
    }
  };

  const renderPlayerRow = (player: any) => {
    const activeInjury = injuries.find(i => i.playerId === player.id && !i.endDate);
    const totals = player.totals;

    return (
      <TableRow 
        key={player.id}
        onClick={() => setViewingPlayer(player)}
        className={cn(
          "cursor-pointer transition-all duration-200 border-b border-gray-100 group relative",
          viewingPlayer?.id === player.id 
            ? "bg-emerald-100 shadow-[inset_8px_0_0_0_#059669]" 
            : "hover:bg-emerald-50 hover:shadow-[inset_8px_0_0_0_#10b981]",
          player.isActive === false && "opacity-60"
        )}
      >
        <TableCell className="text-center font-bold text-gray-400">{player.number}</TableCell>
        <TableCell>
          <Avatar className="h-10 w-10 border border-gray-100 rounded-lg">
            <AvatarImage src={player.photoUrl} className="object-cover rounded-lg" />
            <AvatarFallback className="bg-gray-100 text-gray-600 text-xs font-bold rounded-lg">
              {player.firstName[0]}{player.lastName[0]}
            </AvatarFallback>
          </Avatar>
        </TableCell>
        <TableCell>
          <div>
            <div className="flex items-center gap-2">
              <p className={cn(
                "font-bold text-sm transition-colors",
                viewingPlayer?.id === player.id ? "text-emerald-900" : "text-gray-900 group-hover:text-emerald-700"
              )}>
                {player.alias || `${player.firstName} ${player.lastName}`}
              </p>
              <Badge className={cn("text-[8px] font-black px-1.5 py-0 rounded-sm border-none leading-none h-4 flex items-center justify-center", positionColors[player.position as Position])}>
                {shortPositions[player.position as Position]}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {activeInjury && (
                <span className="text-[9px] font-bold text-red-500 uppercase flex items-center gap-1">
                  <Activity size={10} />
                  Lesionado
                </span>
              )}
              {player.isActive === false && (
                <span className="text-[9px] font-bold text-orange-500 uppercase">Baja</span>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-center font-medium text-gray-600">{totals.matches}</TableCell>
        <TableCell className="text-center font-medium text-gray-400 text-[10px]">
          {player.attendanceRate.toFixed(0)}%
        </TableCell>
        <TableCell className="text-center font-bold text-blue-500">{totals.justified}</TableCell>
        <TableCell className="text-center font-bold text-emerald-600">{totals.wins}</TableCell>
        <TableCell className="text-center font-bold text-gray-400">{totals.draws}</TableCell>
        <TableCell className="text-center font-bold text-red-600">{totals.losses}</TableCell>
        <TableCell className="text-center font-bold text-emerald-600">{totals.goals}</TableCell>
        <TableCell className="text-center font-bold text-blue-600">{totals.assists}</TableCell>
        <TableCell className="text-center font-medium text-yellow-600">{totals.yellowCards}</TableCell>
        <TableCell className="text-center font-medium text-red-600">{totals.redCards}</TableCell>
        <TableCell className="text-center font-bold text-blue-600">{player.commitment.toFixed(2)}</TableCell>
        <TableCell className="text-center font-bold text-orange-600">{player.performance.toFixed(2)}</TableCell>
        <TableCell className="text-right pr-6">
          <div className="flex items-center justify-end gap-4">
            <Tooltip>
              <TooltipTrigger onClick={(e) => e.stopPropagation()} render={
                <div className="flex flex-col items-end gap-1.5 min-w-[80px] cursor-help">
                  <span className="text-sm font-black text-emerald-600 leading-none">
                    {player.rating.toFixed(2)}
                  </span>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(player.rating * 10, 100)}%` }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              } />
              <TooltipContent className="p-4 bg-gray-900 text-white border-none rounded-2xl shadow-2xl min-w-[200px]">
                {(() => {
                  const breakdown = calculateRatingBreakdown(player);
                  return (
                    <div className="space-y-2 text-xs">
                      <p className="font-bold text-emerald-400 border-b border-white/10 pb-1 mb-2">Desglose de {player.alias || player.firstName}:</p>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Partidos Finalizados:</span>
                        <span className="font-bold">{breakdown.partidosComputables}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Partidos Asistidos:</span>
                        <span className="font-bold text-emerald-400">{breakdown.partidosAsistidos}</span>
                      </div>
                      {player.position === 'Portero' && (
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Partidos Bajo 4 Goles:</span>
                          <span className="font-bold text-emerald-400">{breakdown.partidosBajo4Goles}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Partidos Justificados:</span>
                        <span className="font-bold text-blue-400">{breakdown.partidosJustificados}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Partidos Lesionado:</span>
                        <span className="font-bold text-red-400">{breakdown.partidosLesionado}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-white/5 pt-1">
                        <span className="text-gray-400 italic">Asistencia Efectiva:</span>
                        <span className="font-bold text-emerald-500">{breakdown.asistenciaEfectiva}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Racha Máxima:</span>
                        <span className="font-bold text-emerald-400">{breakdown.rachaMaxima}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Bono Regularidad:</span>
                        <span className="font-bold text-emerald-400">+{breakdown.bonoRegularidad}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-white/5 pt-1">
                        <span className="text-gray-400">Nota Compromiso (65%):</span>
                        <span className="font-bold text-blue-400">{breakdown.notaCompromiso}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Nota Desempeño (35%):</span>
                        <span className="font-bold text-orange-400">{breakdown.notaDesempeno}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-white/10 flex justify-between gap-4">
                        <span className="font-bold">Nota Final:</span>
                        <span className="font-bold text-emerald-400 text-sm">{breakdown.notaFinal}</span>
                      </div>
                    </div>
                  );
                })()}
              </TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger 
                  className="h-8 w-8 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical size={16} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-none shadow-xl p-1 min-w-[160px]">
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); setEditingPlayer(player); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-emerald-50 text-gray-700 hover:text-emerald-700"
                  >
                    <Edit2 size={14} />
                    <span className="font-medium">Editar Jugador</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (activeInjury) {
                        setRecoveryModalPlayer(player);
                      } else {
                        setInjuryModalPlayer(player);
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-red-50 text-red-600 hover:text-red-700 font-medium"
                  >
                    <Stethoscope size={14} />
                    <span>{activeInjury ? 'Registrar Recuperación' : 'Registrar Lesión'}</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      const nextStatus = player.isActive === false;
                      const currentSeasons = playerSeasons
                        .filter(ps => ps.playerId === player.id)
                        .map(ps => ps.seasonId);
                      onUpdatePlayer({ ...player, isActive: nextStatus }, currentSeasons); 
                      toast.success(nextStatus ? 'Jugador dado de alta' : 'Jugador dado de baja');
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer font-medium",
                      player.isActive === false 
                        ? "text-emerald-600 hover:bg-emerald-50" 
                        : "text-orange-600 hover:bg-orange-50"
                    )}
                  >
                    {player.isActive === false ? <UserCheck size={14} /> : <UserMinus size={14} />}
                    <span>{player.isActive === false ? "Dar de alta" : "Dar de baja"}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (confirm(`¿Estás seguro de que quieres eliminar a ${player.firstName} ${player.lastName}? Esta acción no se puede deshacer.`)) {
                        onDeletePlayer(player.id);
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-red-50 text-red-600 hover:text-red-700 font-medium"
                  >
                    <Trash2 size={14} />
                    <span>Eliminar Jugador</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderPlayerGridCard = (player: any, i: number) => {
    const Icon = positionIcons[player.position as Position];
    const activeInjury = injuries.find(i => i.playerId === player.id && !i.endDate);
    return (
      <motion.div
        key={player.id}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ delay: i * 0.05 }}
      >
        <Card 
          className={cn(
            "border-none shadow-sm hover:shadow-md transition-all group overflow-hidden rounded-2xl cursor-pointer",
            player.isActive === false && "opacity-60 grayscale-[0.5]"
          )}
          onClick={() => setViewingPlayer(player)}
        >
          <CardContent className="p-0 relative">
            {player.isActive === false && (
              <div className="absolute top-2 left-2 z-10">
                <Badge variant="secondary" className="bg-orange-500 text-white border-none shadow-sm text-[9px] font-black px-2 py-0.5 rounded-lg uppercase">
                  Baja
                </Badge>
              </div>
            )}
            <div className="p-6 flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-16 border-2 border-emerald-50 rounded-xl">
                  <AvatarImage src={player.photoUrl} className="object-cover rounded-xl" />
                  <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold text-xl rounded-xl">
                    {player.firstName[0]}{player.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[10px] font-bold h-6 w-6 rounded-full flex items-center justify-center border-2 border-white">
                  {player.number}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">
                  {player.alias || `${player.firstName} ${player.lastName}`}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="secondary" className={cn("rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", positionColors[player.position as Position])}>
                    <Icon size={10} className="mr-1" />
                    {player.position}
                  </Badge>
                  <span className="text-xs text-gray-400 font-medium">{calculateAge(player.birthDate)} años</span>
                  {activeInjury && (
                    <Badge variant="destructive" className="rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white border-none">
                      Lesionado
                    </Badge>
                  )}
                  {player.isActive === false && (
                    <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 border-none">
                      Baja
                    </Badge>
                  )}
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger render={
                  <div className="text-center px-3 border-l border-gray-100 cursor-help">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Baremo</p>
                    <p className="text-xl font-black text-emerald-600">{calculateRating(player)}</p>
                  </div>
                } />
                <TooltipContent className="p-4 bg-gray-900 text-white border-none rounded-2xl shadow-2xl min-w-[200px]">
                  {(() => {
                    const breakdown = calculateRatingBreakdown(player);
                    return (
                      <div className="space-y-2 text-xs">
                        <p className="font-bold text-emerald-400 border-b border-white/10 pb-1 mb-2">Desglose de {player.alias || player.firstName}:</p>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Partidos Finalizados:</span>
                          <span className="font-bold">{breakdown.partidosComputables}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Partidos Asistidos:</span>
                          <span className="font-bold text-emerald-400">{breakdown.partidosAsistidos}</span>
                        </div>
                        {player.position === 'Portero' && (
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-400">Partidos Bajo 4 Goles:</span>
                            <span className="font-bold text-emerald-400">{breakdown.partidosBajo4Goles}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Partidos Justificados:</span>
                          <span className="font-bold text-blue-400">{breakdown.partidosJustificados}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Partidos Lesionado:</span>
                          <span className="font-bold text-red-400">{breakdown.partidosLesionado}</span>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-white/5 pt-1">
                          <span className="text-gray-400 italic">Asistencia Efectiva:</span>
                          <span className="font-bold text-emerald-500">{breakdown.asistenciaEfectiva}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Racha Máxima:</span>
                          <span className="font-bold text-emerald-400">{breakdown.rachaMaxima}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Bono Regularidad:</span>
                          <span className="font-bold text-emerald-400">+{breakdown.bonoRegularidad}</span>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-white/5 pt-1">
                          <span className="text-gray-400">Nota Compromiso (65%):</span>
                          <span className="font-bold text-blue-400">{breakdown.notaCompromiso}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Nota Desempeño (35%):</span>
                          <span className="font-bold text-orange-400">{breakdown.notaDesempeno}</span>
                        </div>
                        <div className="pt-2 mt-2 border-t border-white/10 flex justify-between gap-4">
                          <span className="font-bold">Nota Final:</span>
                          <span className="font-bold text-emerald-400 text-sm">{breakdown.notaFinal}</span>
                        </div>
                      </div>
                    );
                  })()}
                </TooltipContent>
              </Tooltip>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger 
                    className="h-8 w-8 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical size={16} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-none shadow-xl p-1 min-w-[160px]">
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); setEditingPlayer(player); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-emerald-50 text-gray-700 hover:text-emerald-700"
                    >
                      <Edit2 size={14} />
                      <span className="font-medium">Editar Jugador</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (activeInjury) {
                          setRecoveryModalPlayer(player);
                        } else {
                          setInjuryModalPlayer(player);
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-red-50 text-red-600 hover:text-red-700 font-medium"
                    >
                      <Stethoscope size={14} />
                      <span>{activeInjury ? 'Registrar Recuperación' : 'Registrar Lesión'}</span>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        const nextStatus = player.isActive === false;
                        const currentSeasons = playerSeasons
                          .filter(ps => ps.playerId === player.id)
                          .map(ps => ps.seasonId);
                        onUpdatePlayer({ ...player, isActive: nextStatus }, currentSeasons); 
                        toast.success(nextStatus ? 'Jugador dado de alta' : 'Jugador dado de baja');
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer font-medium",
                        player.isActive === false 
                          ? "text-emerald-600 hover:bg-emerald-50" 
                          : "text-orange-600 hover:bg-orange-50"
                      )}
                    >
                      {player.isActive === false ? <UserCheck size={14} /> : <UserMinus size={14} />}
                      <span>{player.isActive === false ? "Dar de alta" : "Dar de baja"}</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (confirm(`¿Estás seguro de que quieres eliminar a ${player.firstName} ${player.lastName}? Esta acción no se puede deshacer.`)) {
                          onDeletePlayer(player.id);
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-red-50 text-red-600 hover:text-red-700 font-medium"
                    >
                      <Trash2 size={14} />
                      <span>Eliminar Jugador</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">

      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Plantilla</h2>
          <p className="text-gray-500">Gestiona los jugadores de tu equipo.</p>
        </div>
        <Dialog open={isAddDialogOpen || !!editingPlayer} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingPlayer(null);
          } else {
            setIsAddDialogOpen(true);
          }
        }}>
          <DialogTrigger render={<Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6 group" />}>
            <div className="flex items-center">
              <UserPlus size={18} className="mr-2 group-hover:hidden" />
              <Check size={18} className="mr-2 hidden group-hover:block" />
              Añadir Jugador
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editingPlayer ? 'Editar Jugador' : 'Nuevo Jugador'}</DialogTitle>
            </DialogHeader>
            <form key={editingPlayer?.id || 'new'} onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input id="firstName" name="firstName" defaultValue={editingPlayer?.firstName} required className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input id="lastName" name="lastName" defaultValue={editingPlayer?.lastName} required className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alias">Alias (Opcional)</Label>
                <Input id="alias" name="alias" defaultValue={editingPlayer?.alias} placeholder="Ej: El Bicho" className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="number">Dorsal</Label>
                  <Input id="number" name="number" type="number" defaultValue={editingPlayer?.number} required className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
                  <Input id="birthDate" name="birthDate" type="date" defaultValue={editingPlayer?.birthDate} required className="rounded-xl" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="position">Posición</Label>
                <Select 
                  name="position" 
                  value={selectedPosition || ''} 
                  onValueChange={(val: Position) => setSelectedPosition(val)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue>
                      {selectedPosition ? (
                        <span className="flex items-center gap-2">
                          {selectedPosition}
                        </span>
                      ) : (
                        <span className="text-gray-400">Selecciona posición</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Portero">Portero</SelectItem>
                    <SelectItem value="Defensa">Defensa</SelectItem>
                    <SelectItem value="Medio">Medio</SelectItem>
                    <SelectItem value="Delantero">Delantero</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photoUrl">URL de Foto (Opcional)</Label>
                <div className="flex gap-2">
                  <Input 
                    id="photoUrl" 
                    name="photoUrl" 
                    value={uploadedPhotoUrl}
                    onChange={(e) => setUploadedPhotoUrl(e.target.value)}
                    placeholder="https://... o sube una imagen" 
                    className="rounded-xl flex-1" 
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="rounded-xl px-3"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Temporadas</Label>
                <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto p-2 border border-gray-100 rounded-xl">
                  {seasons.map((season) => (
                    <div key={season.id} className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id={`season-${season.id}`} 
                        checked={selectedSeasons.includes(season.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSeasons([...selectedSeasons, season.id]);
                          } else {
                            setSelectedSeasons(selectedSeasons.filter(id => id !== season.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                      />
                      <Label htmlFor={`season-${season.id}`} className="text-xs cursor-pointer truncate">
                        {season.name}
                      </Label>
                    </div>
                  ))}
                  {seasons.length === 0 && (
                    <p className="text-[10px] text-gray-400 col-span-2 text-center py-2">No hay temporadas creadas</p>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                  {editingPlayer ? 'Guardar Cambios' : 'Crear Jugador'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Injury Modal */}
      <Dialog open={!!injuryModalPlayer} onOpenChange={(open) => !open && setInjuryModalPlayer(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Stethoscope size={20} />
              Registrar Lesión
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            onAddInjury({
              playerId: injuryModalPlayer!.id,
              startDate: formData.get('startDate') as string,
              cause: formData.get('cause') as string || null,
            });
            setInjuryModalPlayer(null);
          }} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha y Hora de Inicio</Label>
              <Input 
                id="startDate" 
                name="startDate" 
                type="datetime-local" 
                defaultValue={new Date().toISOString().slice(0, 16)} 
                required 
                className="rounded-xl" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cause">Causa / Descripción (Opcional)</Label>
              <textarea 
                id="cause" 
                name="cause" 
                placeholder="Ej: Esguince de tobillo en entrenamiento"
                className="w-full min-h-[100px] p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm transition-all"
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl">
                Confirmar Lesión
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recovery Modal */}
      <Dialog open={!!recoveryModalPlayer} onOpenChange={(open) => !open && setRecoveryModalPlayer(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <Activity size={20} />
              Registrar Recuperación
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const activeInjury = injuries.find(i => i.playerId === recoveryModalPlayer!.id && !i.endDate);
            if (activeInjury) {
              onUpdateInjury({
                ...activeInjury,
                endDate: formData.get('endDate') as string,
              });
            }
            setRecoveryModalPlayer(null);
          }} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha y Hora de Recuperación</Label>
              <Input 
                id="endDate" 
                name="endDate" 
                type="datetime-local" 
                defaultValue={new Date().toISOString().slice(0, 16)} 
                required 
                className="rounded-xl" 
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                Confirmar Recuperación
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        <button 
          onClick={() => setActiveTab('plantilla')}
          className={cn("flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'plantilla' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
        >
          <Users size={16} />
          Plantilla
        </button>
        <button 
          onClick={() => setActiveTab('asistencia')}
          className={cn("flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'asistencia' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
        >
          <ClipboardCheck size={16} />
          Asistencia
        </button>
        <button 
          onClick={() => setActiveTab('lesionados')}
          className={cn("flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'lesionados' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
        >
          <Bandage size={16} />
          Lesionados
        </button>
      </div>

      {activeTab === 'plantilla' ? (
        <>
          <div className="flex flex-col sm:flex-row gap-4 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input 
                placeholder="Buscar por nombre..." 
                className="pl-10 h-12 bg-white border-none shadow-sm rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          <div className="w-full sm:w-48">
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-12 bg-white border-none shadow-sm rounded-xl">
                <SelectValue>
                  {statusFilter === 'active' ? 'Solo Activos' : 
                  statusFilter === 'inactive' ? 'Solo Bajas' : 
                  'Todos los estados'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-xl">
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Solo Activos</SelectItem>
                <SelectItem value="inactive">Solo Bajas</SelectItem>
                
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select value={positionFilter} onValueChange={(v: any) => setPositionFilter(v)}>
              <SelectTrigger className="h-12 bg-white border-none shadow-sm rounded-xl">
                <SelectValue>
                  {positionFilter === 'all' ? 'Todas las posiciones' : positionFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-xl">
                <SelectItem value="all">Todas las posiciones</SelectItem>
                <SelectItem value="Portero">Portero</SelectItem>
                <SelectItem value="Defensa">Defensa</SelectItem>
                <SelectItem value="Medio">Medio</SelectItem>
                <SelectItem value="Delantero">Delantero</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex bg-white rounded-xl shadow-sm p-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setGroupByPosition(!groupByPosition)}
              className={cn("rounded-lg mr-1", groupByPosition ? "bg-emerald-50 text-emerald-600" : "text-gray-400")}
              title={groupByPosition ? "Desagrupar por posición" : "Agrupar por posición"}
            >
              <Layers size={18} className={groupByPosition ? "opacity-100" : "opacity-50"} />
            </Button>
            <div className="w-px h-6 bg-gray-100 my-auto mx-1" />
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'ghost'} 
              size="icon" 
              onClick={() => setViewMode('grid')}
              className={cn("rounded-lg", viewMode === 'grid' ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-gray-400")}
            >
              <LayoutGrid size={18} />
            </Button>
            <Button 
              variant={viewMode === 'table' ? 'default' : 'ghost'} 
              size="icon" 
              onClick={() => setViewMode('table')}
              className={cn("rounded-lg", viewMode === 'table' ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-gray-400")}
            >
              <List size={18} />
            </Button>
          </div>
      </div>

      {viewMode === 'grid' ? (
        groupByPosition ? (
          <div className="space-y-8">
            {['Portero', 'Defensa', 'Medio', 'Delantero'].map((pos) => {
              const posPlayers = filteredPlayers.filter(p => p.position === pos);
              if (posPlayers.length === 0) return null;
              const PosIcon = positionIcons[pos as Position];

              return (
                <div key={pos} className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className={cn("p-2 rounded-lg", positionColors[pos as Position])}>
                      <PosIcon size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                      {pos}s
                    </h3>
                    <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-none text-[10px] font-bold px-1.5 py-0 rounded-md">
                      {posPlayers.length}
                    </Badge>
                    <div className="h-px flex-1 bg-gray-100 ml-2" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                      {posPlayers.map((player, i) => renderPlayerGridCard(player, i))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence mode="popLayout">
              {filteredPlayers.map((player, i) => renderPlayerGridCard(player, i))}
            </AnimatePresence>
          </div>
        )
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 min-h-[600px]">
          {/* Table View */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-white">
                  <TableRow className="hover:bg-transparent border-b border-gray-100">
                    <TableHead 
                      className="w-[80px] text-center font-bold text-gray-400 uppercase text-[10px] cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleSort('number')}
                    >
                      <div className="flex items-center justify-center">
                        # <SortIcon field="number" />
                      </div>
                    </TableHead>
                    <TableHead className="w-[80px] font-bold text-gray-400 uppercase text-[10px]">Foto</TableHead>
                    <TableHead 
                      className="font-bold text-gray-400 uppercase text-[10px] cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Jugador <SortIcon field="name" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-gray-400 uppercase text-[10px] cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleSort('matches')}
                    >
                      <div className="flex items-center justify-center">
                        PJ <SortIcon field="matches" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-gray-400 uppercase text-[10px] cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleSort('attendanceRate')}
                    >
                      <div className="flex items-center justify-center">
                        % <SortIcon field="attendanceRate" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-gray-400 uppercase text-[10px] cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleSort('justified')}
                    >
                      <div className="flex items-center justify-center">
                        J <SortIcon field="justified" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-emerald-600 uppercase text-[10px] cursor-pointer hover:text-emerald-700 transition-colors"
                      onClick={() => handleSort('wins')}
                    >
                      <div className="flex items-center justify-center">
                        V <SortIcon field="wins" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-gray-400 uppercase text-[10px] cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleSort('draws')}
                    >
                      <div className="flex items-center justify-center">
                        E <SortIcon field="draws" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-red-600 uppercase text-[10px] cursor-pointer hover:text-red-700 transition-colors"
                      onClick={() => handleSort('losses')}
                    >
                      <div className="flex items-center justify-center">
                        D <SortIcon field="losses" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-gray-400 uppercase text-[10px] cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleSort('goals')}
                    >
                      <div className="flex items-center justify-center">
                        G <SortIcon field="goals" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-gray-400 uppercase text-[10px] cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleSort('assists')}
                    >
                      <div className="flex items-center justify-center">
                        A <SortIcon field="assists" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-gray-400 uppercase text-[10px] cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleSort('yellowCards')}
                    >
                      <div className="flex items-center justify-center">
                        TA <SortIcon field="yellowCards" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-gray-400 uppercase text-[10px] cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleSort('redCards')}
                    >
                      <div className="flex items-center justify-center">
                        TR <SortIcon field="redCards" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-blue-600 uppercase text-[10px] cursor-pointer hover:text-blue-700 transition-colors"
                      onClick={() => handleSort('commitment')}
                    >
                      <div className="flex items-center justify-center">
                        Comp. <SortIcon field="commitment" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-orange-600 uppercase text-[10px] cursor-pointer hover:text-orange-700 transition-colors"
                      onClick={() => handleSort('performance')}
                    >
                      <div className="flex items-center justify-center">
                        Desem. <SortIcon field="performance" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right font-bold text-gray-400 uppercase text-[10px] pr-6 cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleSort('rating')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Baremo <SortIcon field="rating" />
                        <Tooltip>
                          <TooltipTrigger onClick={(e) => e.stopPropagation()} render={<Info size={12} className="text-gray-300 cursor-help" />} />
                          <TooltipContent className="max-w-[260px] p-4 text-xs bg-gray-900 text-white border-none rounded-2xl shadow-2xl">
                            <p className="font-bold mb-2 text-emerald-400">Cálculo del Baremo (Solo partidos finalizados):</p>
                            
                            <div className="space-y-3">
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">1. Compromiso ({BAREMO_CONFIG.WEIGHT_COMMITMENT * 100}%)</p>
                                <p className="opacity-90 leading-relaxed">
                                  ((P. Asistidos + (P. Justificados × 1.0) + (P. Lesión × 0.65)) / P. Finalizados) × 10
                                </p>
                                <p className="text-[9px] text-emerald-400 mt-1 italic">Las ausencias justificadas no penalizan el compromiso.</p>
                                <p className="text-[9px] text-emerald-400 mt-0.5 italic">Las lesiones penalizan un 65% MENOS que una falta.</p>
                                <p className="text-[9px] text-red-400 mt-0.5 italic">Penalización No Asistencia: {BAREMO_CONFIG.POINTS.NO_ATTENDANCE} pts</p>
                                <p className="text-[9px] text-red-400 mt-0.5 italic">Penalización No Contestar: {BAREMO_CONFIG.POINTS.NO_RESPONSE} pts</p>
                              </div>

                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">2. Desempeño ({BAREMO_CONFIG.WEIGHT_PERFORMANCE * 100}%)</p>
                                <p className="text-[9px] text-gray-400 mb-1 italic">Meta Excelencia: {BAREMO_CONFIG.EXCELLENCE_GOAL} pts/partido</p>
                                <ul className="space-y-1 list-none opacity-90">
                                  <li className="flex justify-between"><span>Victoria:</span> <span className="font-bold text-emerald-400">+{BAREMO_CONFIG.POINTS.WIN} pts</span></li>
                                  <li className="flex justify-between"><span>Empate:</span> <span className="font-bold text-emerald-400">+{BAREMO_CONFIG.POINTS.DRAW} pts</span></li>
                                  <li className="flex justify-between"><span>Derrota:</span> <span className="font-bold text-emerald-400">+{BAREMO_CONFIG.POINTS.LOSS} pts</span></li>
                                  <li className="flex justify-between"><span>Bajo 4 Goles (Porteros):</span> <span className="font-bold text-emerald-400">+{BAREMO_CONFIG.POINTS.UNDER_4_GOALS} pts</span></li>
                                  <li className="flex justify-between"><span>Gol:</span> <span className="font-bold text-emerald-400">+{BAREMO_CONFIG.POINTS.GOAL} pts</span></li>
                                  <li className="flex justify-between"><span>Asistencia:</span> <span className="font-bold text-emerald-400">+{BAREMO_CONFIG.POINTS.ASSIST} pts</span></li>
                                  <li className="flex justify-between"><span>Amarilla:</span> <span className="font-bold text-red-400">{BAREMO_CONFIG.POINTS.YELLOW} pts</span></li>
                                  <li className="flex justify-between"><span>Roja:</span> <span className="font-bold text-red-400">{BAREMO_CONFIG.POINTS.RED} pts</span></li>
                                </ul>
                              </div>

                              <p className="pt-2 border-t border-white/10 text-[10px] text-gray-400 italic">
                                Nota Final = (Compromiso × {BAREMO_CONFIG.WEIGHT_COMMITMENT}) + (Desempeño × {BAREMO_CONFIG.WEIGHT_PERFORMANCE}) + Bono Regularidad ({BAREMO_CONFIG.REGULARITY_BONUS} pts / 3 partidos)
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupByPosition ? (
                    ['Portero', 'Defensa', 'Medio', 'Delantero'].map((pos) => {
                      const posPlayers = sortedPlayers.filter(p => p.position === pos);
                      if (posPlayers.length === 0) return null;
                      const PosIcon = positionIcons[pos as Position];

                      return (
                        <React.Fragment key={pos}>
                          <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                            <TableCell colSpan={16} className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <div className={cn("p-1.5 rounded-lg", positionColors[pos as Position])}>
                                  <PosIcon size={12} />
                                </div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{pos}s</span>
                                <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-none text-[9px] font-bold px-1.5 py-0 rounded-md">
                                  {posPlayers.length}
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                          {posPlayers.map((player) => renderPlayerRow(player))}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    sortedPlayers.map((player) => renderPlayerRow(player))
                  )}
                </TableBody>
              </Table>
              {sortedPlayers.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-gray-400 font-medium">No se encontraron jugadores.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Player Details Dialog */}
      <Dialog open={!!viewingPlayer} onOpenChange={(open) => !open && setViewingPlayer(null)}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl">
            {viewingPlayer && (() => {
              const statsBySeason = getPlayerStatsBySeason(viewingPlayer.id);
              const totalStats = Object.values(statsBySeason).reduce((acc, curr) => ({
                matches: acc.matches + curr.matches,
                goals: acc.goals + curr.goals,
                assists: acc.assists + curr.assists,
                yellowCards: acc.yellowCards + curr.yellowCards,
                redCards: acc.redCards + curr.redCards,
                wins: acc.wins + curr.wins,
                draws: acc.draws + curr.draws,
                losses: acc.losses + curr.losses,
                justified: acc.justified + curr.justified,
              }), { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, wins: 0, draws: 0, losses: 0, justified: 0 });

              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-2xl flex items-center gap-3">
                      <Avatar className="h-14 w-14 border-2 border-emerald-50 rounded-2xl">
                        <AvatarImage src={viewingPlayer.photoUrl} className="object-cover rounded-2xl" />
                        <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold rounded-2xl">
                          {viewingPlayer.firstName[0]}{viewingPlayer.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        {viewingPlayer.alias || `${viewingPlayer.firstName} ${viewingPlayer.lastName}`}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={cn("rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", positionColors[viewingPlayer.position])}>
                            {viewingPlayer.position}
                          </Badge>
                          {injuries.some(i => i.playerId === viewingPlayer.id && !i.endDate) && (
                            <Badge variant="destructive" className="rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white border-none">
                              Lesionado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-6 py-4">
                    <div>
                      <h3 className="text-lg font-bold mb-3">Estadísticas Totales</h3>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 text-center">
                        <div className="bg-gray-50 p-2 rounded-xl">
                          <p className="text-[9px] text-gray-500 uppercase font-bold">PJ</p>
                          <p className="text-lg font-black text-gray-900">{totalStats.matches}</p>
                        </div>
                        <div className="bg-blue-50 p-2 rounded-xl">
                          <p className="text-[9px] text-blue-600 uppercase font-bold">Just.</p>
                          <p className="text-lg font-black text-blue-700">{totalStats.justified}</p>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-xl">
                          <p className="text-[9px] text-emerald-600 uppercase font-bold">V</p>
                          <p className="text-lg font-black text-emerald-700">{totalStats.wins}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-xl">
                          <p className="text-[9px] text-gray-500 uppercase font-bold">E</p>
                          <p className="text-lg font-black text-gray-900">{totalStats.draws}</p>
                        </div>
                        <div className="bg-red-50 p-2 rounded-xl">
                          <p className="text-[9px] text-red-600 uppercase font-bold">D</p>
                          <p className="text-lg font-black text-red-700">{totalStats.losses}</p>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-xl">
                          <p className="text-[9px] text-emerald-600 uppercase font-bold">Goles</p>
                          <p className="text-lg font-black text-emerald-700">{totalStats.goals}</p>
                        </div>
                        <div className="bg-blue-50 p-2 rounded-xl">
                          <p className="text-[9px] text-blue-600 uppercase font-bold">Asist.</p>
                          <p className="text-lg font-black text-blue-700">{totalStats.assists}</p>
                        </div>
                        <div className="bg-yellow-50 p-2 rounded-xl">
                          <p className="text-[9px] text-yellow-600 uppercase font-bold">T. Ama</p>
                          <p className="text-lg font-black text-yellow-700">{totalStats.yellowCards}</p>
                        </div>
                        <div className="bg-red-50 p-2 rounded-xl">
                          <p className="text-[9px] text-red-600 uppercase font-bold">T. Roja</p>
                          <p className="text-lg font-black text-red-700">{totalStats.redCards}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold mb-3">Histórico por Temporada</h3>
                      {Object.keys(statsBySeason).length > 0 ? (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                          {Object.entries(statsBySeason).map(([seasonId, s]) => {
                            const season = seasons.find(se => se.id === seasonId);
                            return (
                              <div key={seasonId} className="p-4 border rounded-2xl bg-gray-50/50">
                                <div className="flex justify-between items-center mb-3">
                                  <span className="font-black text-gray-900">{season?.name || 'Temporada Desconocida'}</span>
                                  <div className="flex gap-2">
                                    <Badge variant="secondary" className="bg-white text-gray-500 border-gray-100">
                                      {s.matches} PJ
                                    </Badge>
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100">
                                      {s.justified} Just.
                                    </Badge>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  <div className="bg-emerald-50/50 p-2 rounded-xl text-center border border-emerald-100/50">
                                    <p className="text-[9px] text-emerald-600 uppercase font-bold">Victorias</p>
                                    <p className="text-sm font-black text-emerald-700">{s.wins}</p>
                                  </div>
                                  <div className="bg-gray-100/50 p-2 rounded-xl text-center border border-gray-200/50">
                                    <p className="text-[9px] text-gray-500 uppercase font-bold">Empates</p>
                                    <p className="text-sm font-black text-gray-900">{s.draws}</p>
                                  </div>
                                  <div className="bg-red-50/50 p-2 rounded-xl text-center border border-red-100/50">
                                    <p className="text-[9px] text-red-600 uppercase font-bold">Derrotas</p>
                                    <p className="text-sm font-black text-red-700">{s.losses}</p>
                                  </div>
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                  <span>Goles: <span className="text-emerald-600">{s.goals}</span></span>
                                  <span>Asist: <span className="text-blue-600">{s.assists}</span></span>
                                  <span>T. Ama: <span className="text-yellow-600">{s.yellowCards}</span></span>
                                  <span>T. Roja: <span className="text-red-600">{s.redCards}</span></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm italic">No hay estadísticas registradas para este jugador.</p>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                        onClick={() => navigate(`/players/${viewingPlayer.id}`)}
                      >
                        Ver Perfil Completo
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
        </>
      ) : activeTab === 'asistencia' ? (
        <AttendanceTracker 
          players={players}
          playerSeasons={playerSeasons}
          matches={matches}
          stats={stats}
          seasons={seasons}
          opponents={opponents}
          globalSeasonId={globalSeasonId}
          onUpdateAttendance={onUpdateAttendance}
        />
      ) : (
        <InjuredPlayers 
          players={players} 
          injuries={injuries} 
          seasons={seasons} 
          playerSeasons={playerSeasons} 
        />
      )}
    </div>
  );
}
