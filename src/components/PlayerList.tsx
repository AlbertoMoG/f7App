import React from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  UserPlus,
  Shield,
  Sword,
  Crosshair,
  Upload,
  Loader2,
  LayoutGrid,
  List,
  X,
  Info,
  UserMinus,
  UserCheck
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
import { Player, Position, PlayerStat, Season, Match } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { uploadImage } from '../lib/imageUpload';
import { toast } from 'sonner';

interface PlayerListProps {
  players: Player[];
  stats: PlayerStat[];
  matches: Match[];
  seasons: Season[];
  onAddPlayer: (player: Omit<Player, 'id'>) => void;
  onUpdatePlayer: (player: Player) => void;
  onDeletePlayer: (id: string) => void;
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

/**
 * Componente para mostrar y gestionar la lista de jugadores.
 * Permite añadir, editar y eliminar jugadores, así como ver sus estadísticas.
 */
export default function PlayerList({ players, stats, matches, seasons, onAddPlayer, onUpdatePlayer, onDeletePlayer }: PlayerListProps) {
  const [viewMode, setViewMode] = React.useState<'grid' | 'table'>('table');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'active' | 'inactive' | 'all'>('active');
  const [positionFilter, setPositionFilter] = React.useState<Position | 'all'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingPlayer, setEditingPlayer] = React.useState<Player | null>(null);
  const [viewingPlayer, setViewingPlayer] = React.useState<Player | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

const [selectedPosition, setSelectedPosition] = React.useState<Position | ''>('');

// Y modifica este useEffect que ya tenías para que también limpie la posición
React.useEffect(() => {
  if (editingPlayer) {
    setUploadedPhotoUrl(editingPlayer.photoUrl || '');
    setSelectedPosition(editingPlayer.position);
  } else {
    setUploadedPhotoUrl('');
    setSelectedPosition('');
  }
}, [editingPlayer, isAddDialogOpen]);

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

  const calculateRating = (playerId: string) => {
    const playerStats = stats.filter(s => s.playerId === playerId);
    if (playerStats.length === 0) return 0;

    let score = 0;
    let gamesPlayed = 0;

    playerStats.forEach(s => {
      if (s.attendance === 'attending') {
        gamesPlayed++;
        score += 2; // Base for attending

        // Add points for match result
        const match = matches.find(m => m.id === s.matchId);
        if (match && match.status === 'completed' && match.scoreTeam !== undefined && match.scoreOpponent !== undefined) {
          if (match.scoreTeam > match.scoreOpponent) {
            score += 3; // Win
          } else if (match.scoreTeam === match.scoreOpponent) {
            score += 1; // Draw
          }
        }
      }
      score += (s.goals || 0) * 3;
      score += (s.assists || 0) * 2;
      score -= (s.yellowCards || 0) * 1;
      score -= (s.redCards || 0) * 3;
    });

    if (gamesPlayed === 0) return 0;
    return (score / gamesPlayed).toFixed(1);
  };

  const getPlayerStatsBySeason = (playerId: string) => {
    const playerStats = stats.filter(s => s.playerId === playerId);
    const statsBySeason: Record<string, { 
      matches: number, 
      goals: number, 
      assists: number, 
      yellowCards: number, 
      redCards: number,
      wins: number,
      draws: number,
      losses: number
    }> = {};
    
    playerStats.forEach(s => {
      if (!statsBySeason[s.seasonId]) {
        statsBySeason[s.seasonId] = { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, wins: 0, draws: 0, losses: 0 };
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
    return matchesSearch && matchesStatus && matchesPosition;
  });

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
      isInjured: formData.get('isInjured') === 'on',
      isActive: editingPlayer ? editingPlayer.isActive : true,
      seasonIds: formData.getAll('seasonIds') as string[],
    };
    if (photoUrl) {
      playerData.photoUrl = photoUrl;
    } else {
      playerData.photoUrl = null;
    }

    if (editingPlayer) {
      onUpdatePlayer({ ...playerData, id: editingPlayer.id });
      setEditingPlayer(null);
    } else {
      onAddPlayer(playerData);
      setIsAddDialogOpen(false);
    }
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
          <DialogTrigger render={<Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6" />}>
            <UserPlus size={18} className="mr-2" />
            Añadir Jugador
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
              <div className="flex items-center space-x-2 pt-2">
                <input type="checkbox" id="isInjured" name="isInjured" defaultChecked={editingPlayer?.isInjured} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600" />
                <Label htmlFor="isInjured" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Jugador Lesionado
                </Label>
              </div>
              <div className="space-y-2">
                <Label>Temporadas</Label>
                <div className="grid grid-cols-2 gap-2 border rounded-xl p-3 max-h-32 overflow-y-auto">
                  {seasons.map(season => (
                    <div key={season.id} className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id={`season-${season.id}`} 
                        name="seasonIds" 
                        value={season.id} 
                        defaultChecked={editingPlayer?.seasonIds?.includes(season.id)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600" 
                      />
                      <Label htmlFor={`season-${season.id}`} className="text-sm font-normal">{season.name}</Label>
                    </div>
                  ))}
                  {seasons.length === 0 && <p className="text-xs text-gray-500 col-span-2">No hay temporadas creadas.</p>}
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

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
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
              <SelectItem value="active">Solo Activos</SelectItem>
              <SelectItem value="inactive">Solo Bajas</SelectItem>
              <SelectItem value="all">Todos los estados</SelectItem>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence mode="popLayout">
                    {posPlayers.map((player, i) => {
                      const Icon = positionIcons[player.position];
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
                                  <Avatar className="h-16 w-16 border-2 border-emerald-50 rounded-2xl">
                                    <AvatarImage src={player.photoUrl} className="object-cover rounded-2xl" />
                                    <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold text-xl rounded-2xl">
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
                                    <Badge variant="secondary" className={cn("rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", positionColors[player.position])}>
                                      <Icon size={10} className="mr-1" />
                                      {player.position}
                                    </Badge>
                                    <span className="text-xs text-gray-400 font-medium">{calculateAge(player.birthDate)} años</span>
                                    {player.isInjured && (
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
                                <div className="text-center px-3 border-l border-gray-100">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">Baremo</p>
                                  <p className="text-xl font-black text-emerald-600">{calculateRating(player.id)}</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingPlayer(player); }} className="h-8 w-8 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                                    <Edit2 size={14} />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      const nextStatus = player.isActive === false;
                                      onUpdatePlayer({ ...player, isActive: nextStatus }); 
                                      toast.success(nextStatus ? 'Jugador dado de alta' : 'Jugador dado de baja');
                                    }} 
                                    className={cn(
                                      "h-8 w-8 rounded-lg",
                                      player.isActive === false 
                                        ? "text-emerald-500 hover:bg-emerald-50" 
                                        : "text-orange-400 hover:text-orange-600 hover:bg-orange-50"
                                    )}
                                    title={player.isActive === false ? "Dar de alta" : "Dar de baja"}
                                  >
                                    {player.isActive === false ? <UserCheck size={14} /> : <UserMinus size={14} />}
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 min-h-[600px]">
          {/* Table View */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              {['Portero', 'Defensa', 'Medio', 'Delantero'].map((pos) => {
                const posPlayers = filteredPlayers.filter(p => p.position === pos);
                if (posPlayers.length === 0) return null;
                const PosIcon = positionIcons[pos as Position];

                return (
                  <div key={pos} className="mb-8 last:mb-0">
                    <div className="bg-gray-50/80 px-6 py-2 flex items-center gap-2 border-y border-gray-100">
                      <PosIcon size={14} className="text-gray-500" />
                      <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        {pos}s
                      </h3>
                      <span className="bg-gray-200 text-gray-600 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                        {posPlayers.length}
                      </span>
                    </div>
                    <Table>
                      <TableHeader className="bg-white">
                        <TableRow className="hover:bg-transparent border-b border-gray-50">
                          <TableHead className="w-[60px] text-center font-bold text-gray-400 uppercase text-[10px]">#</TableHead>
                          <TableHead className="w-[80px] font-bold text-gray-400 uppercase text-[10px]">Foto</TableHead>
                          <TableHead className="font-bold text-gray-400 uppercase text-[10px]">Jugador</TableHead>
                          <TableHead className="text-center font-bold text-gray-400 uppercase text-[10px]">PJ</TableHead>
                          <TableHead className="text-center font-bold text-emerald-600 uppercase text-[10px]">V</TableHead>
                          <TableHead className="text-center font-bold text-gray-400 uppercase text-[10px]">E</TableHead>
                          <TableHead className="text-center font-bold text-red-600 uppercase text-[10px]">D</TableHead>
                          <TableHead className="text-center font-bold text-gray-400 uppercase text-[10px]">G</TableHead>
                          <TableHead className="text-center font-bold text-gray-400 uppercase text-[10px]">A</TableHead>
                          <TableHead className="text-center font-bold text-gray-400 uppercase text-[10px]">TA</TableHead>
                          <TableHead className="text-center font-bold text-gray-400 uppercase text-[10px]">TR</TableHead>
                          <TableHead className="text-right font-bold text-gray-400 uppercase text-[10px] pr-6">
                            <div className="flex items-center justify-end gap-1">
                              Baremo
                              <Tooltip>
                                <TooltipTrigger render={<Info size={12} className="text-gray-300 cursor-help" />} />
                                <TooltipContent className="max-w-[200px] p-3 text-xs bg-gray-900 text-white border-none rounded-xl">
                                  <p className="font-bold mb-1">Cálculo del Baremo:</p>
                                  <ul className="space-y-1 list-disc list-inside opacity-90">
                                    <li>Asistencia: +2 pts</li>
                                    <li>Victoria: +3 pts</li>
                                    <li>Empate: +1 pt</li>
                                    <li>Gol: +3 pts</li>
                                    <li>Asistencia de gol: +2 pts</li>
                                    <li>Amarilla: -1 pt</li>
                                    <li>Roja: -3 pts</li>
                                  </ul>
                                  <p className="mt-2 pt-2 border-t border-white/10 text-[10px]">Se divide el total entre los partidos jugados.</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {posPlayers.map((player) => {
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
                          }), { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, wins: 0, draws: 0, losses: 0 });

                          return (
                            <TableRow 
                              key={player.id}
                              onClick={() => setViewingPlayer(player)}
                              className={cn(
                                "cursor-pointer transition-colors border-b border-gray-50",
                                viewingPlayer?.id === player.id ? "bg-emerald-50/50" : "hover:bg-gray-50/50",
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
                                  <p className="font-bold text-sm text-gray-900">
                                    {player.alias || `${player.firstName} ${player.lastName}`}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-medium text-gray-500">{player.position}</span>
                                    {player.isInjured && (
                                      <span className="text-[9px] font-bold text-red-500 uppercase">Lesionado</span>
                                    )}
                                    {player.isActive === false && (
                                      <span className="text-[9px] font-bold text-orange-500 uppercase">Baja</span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-medium text-gray-600">{totals.matches}</TableCell>
                              <TableCell className="text-center font-bold text-emerald-600">{totals.wins}</TableCell>
                              <TableCell className="text-center font-bold text-gray-400">{totals.draws}</TableCell>
                              <TableCell className="text-center font-bold text-red-600">{totals.losses}</TableCell>
                              <TableCell className="text-center font-bold text-emerald-600">{totals.goals}</TableCell>
                              <TableCell className="text-center font-bold text-blue-600">{totals.assists}</TableCell>
                              <TableCell className="text-center font-medium text-yellow-600">{totals.yellowCards}</TableCell>
                              <TableCell className="text-center font-medium text-red-600">{totals.redCards}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-lg font-black text-emerald-600">{calculateRating(player.id)}</span>
                                  <div className="flex gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        const nextStatus = player.isActive === false;
                                        onUpdatePlayer({ ...player, isActive: nextStatus }); 
                                        toast.success(nextStatus ? 'Jugador dado de alta' : 'Jugador dado de baja');
                                      }} 
                                      className={cn(
                                        "h-8 w-8 rounded-lg",
                                        player.isActive === false 
                                          ? "text-emerald-500 hover:bg-emerald-50" 
                                          : "text-orange-400 hover:text-orange-600 hover:bg-orange-50"
                                      )}
                                      title={player.isActive === false ? "Dar de alta" : "Dar de baja"}
                                    >
                                      {player.isActive === false ? <UserCheck size={14} /> : <UserMinus size={14} />}
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
              {filteredPlayers.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-gray-400 font-medium">No se encontraron jugadores.</p>
                </div>
              )}
            </div>
          </div>

          {/* Side Panel for Stats */}
          {viewingPlayer && (
            <div className="w-full lg:w-80 bg-white rounded-2xl shadow-sm overflow-y-auto border border-gray-100 h-fit lg:sticky lg:top-6">
              {(() => {
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
                }), { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, wins: 0, draws: 0, losses: 0 });

                return (
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-emerald-50 rounded-2xl">
                          <AvatarImage src={viewingPlayer.photoUrl} className="object-cover rounded-2xl" />
                          <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold text-xl rounded-2xl">
                            {viewingPlayer.firstName[0]}{viewingPlayer.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-bold text-lg leading-tight">
                            {viewingPlayer.alias || `${viewingPlayer.firstName} ${viewingPlayer.lastName}`}
                          </h3>
                          <Badge variant="secondary" className={cn("mt-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", positionColors[viewingPlayer.position])}>
                            {viewingPlayer.position}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingPlayer(viewingPlayer)} className="h-8 w-8 text-gray-400 hover:text-emerald-600">
                          <Edit2 size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setViewingPlayer(null)} className="h-8 w-8 text-gray-400 hover:text-red-500">
                          <X size={14} />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Totales</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 p-3 rounded-xl text-center">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Partidos</p>
                            <p className="text-xl font-black text-gray-900">{totalStats.matches}</p>
                          </div>
                          <div className="bg-emerald-50 p-3 rounded-xl text-center">
                            <p className="text-[10px] text-emerald-600 uppercase font-bold">Goles</p>
                            <p className="text-xl font-black text-emerald-700">{totalStats.goals}</p>
                          </div>
                          <div className="bg-blue-50 p-3 rounded-xl text-center">
                            <p className="text-[10px] text-blue-600 uppercase font-bold">Asist.</p>
                            <p className="text-xl font-black text-blue-700">{totalStats.assists}</p>
                          </div>
                          <div className="bg-yellow-50 p-3 rounded-xl text-center">
                            <p className="text-[10px] text-yellow-600 uppercase font-bold">Tarjetas</p>
                            <p className="text-xl font-black text-yellow-700">{totalStats.yellowCards + totalStats.redCards}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Por Temporada</h4>
                        {Object.keys(statsBySeason).length > 0 ? (
                          <div className="space-y-2">
                            {Object.entries(statsBySeason).map(([seasonId, s]) => {
                              const season = seasons.find(se => se.id === seasonId);
                              return (
                                <div key={seasonId} className="p-3 border rounded-xl bg-gray-50/50">
                                  <span className="font-bold text-sm block mb-2">{season?.name || 'Temporada Desconocida'}</span>
                                  <div className="flex justify-between text-[10px] border-t border-gray-100 pt-2 mt-2">
                                    <span className="text-emerald-600">V: <strong className="text-emerald-700">{s.wins}</strong></span>
                                    <span className="text-gray-500">E: <strong className="text-gray-900">{s.draws}</strong></span>
                                    <span className="text-red-600">D: <strong className="text-red-700">{s.losses}</strong></span>
                                  </div>
                                  <div className="flex justify-between text-[10px] mt-1">
                                    <span className="text-gray-500">PJ: <strong className="text-gray-900">{s.matches}</strong></span>
                                    <span className="text-emerald-600">G: <strong className="text-emerald-700">{s.goals}</strong></span>
                                    <span className="text-blue-600">A: <strong className="text-blue-700">{s.assists}</strong></span>
                                    <span className="text-yellow-600">TA: <strong className="text-yellow-700">{s.yellowCards}</strong></span>
                                    <span className="text-red-600">TR: <strong className="text-red-700">{s.redCards}</strong></span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-xs italic">Sin estadísticas registradas.</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Player Details Dialog (Only for Grid View) */}
      {viewMode === 'grid' && (
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
              }), { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, wins: 0, draws: 0, losses: 0 });

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
                          {viewingPlayer.isInjured && (
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
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center">
                        <div className="bg-gray-50 p-2 rounded-xl">
                          <p className="text-[9px] text-gray-500 uppercase font-bold">PJ</p>
                          <p className="text-lg font-black text-gray-900">{totalStats.matches}</p>
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
                                  <Badge variant="secondary" className="bg-white text-gray-500 border-gray-100">
                                    {s.matches} partidos
                                  </Badge>
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
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
