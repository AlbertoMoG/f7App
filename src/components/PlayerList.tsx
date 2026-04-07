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
  List
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
import { Player, Position, PlayerStat, Season } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { uploadImage } from '../lib/imageUpload';

interface PlayerListProps {
  players: Player[];
  stats: PlayerStat[];
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
export default function PlayerList({ players, stats, seasons, onAddPlayer, onUpdatePlayer, onDeletePlayer }: PlayerListProps) {
  const [viewMode, setViewMode] = React.useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingPlayer, setEditingPlayer] = React.useState<Player | null>(null);
  const [viewingPlayer, setViewingPlayer] = React.useState<Player | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingPlayer) {
      setUploadedPhotoUrl(editingPlayer.photoUrl || '');
    } else {
      setUploadedPhotoUrl('');
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
      alert("Hubo un error al subir la imagen.");
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
    playerStats.forEach(s => {
      if (s.attendance === 'attending') score += 2;
      score += (s.goals || 0) * 3;
      score += (s.assists || 0) * 2;
      score -= (s.yellowCards || 0) * 1;
      score -= (s.redCards || 0) * 3;
    });

    return (score / playerStats.length).toFixed(1);
  };

  const getPlayerStatsBySeason = (playerId: string) => {
    const playerStats = stats.filter(s => s.playerId === playerId);
    const statsBySeason: Record<string, { matches: number, goals: number, assists: number, yellowCards: number, redCards: number }> = {};
    
    playerStats.forEach(s => {
      if (!statsBySeason[s.seasonId]) {
        statsBySeason[s.seasonId] = { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
      }
      if (s.attendance === 'attending') {
        statsBySeason[s.seasonId].matches += 1;
      }
      statsBySeason[s.seasonId].goals += s.goals || 0;
      statsBySeason[s.seasonId].assists += s.assists || 0;
      statsBySeason[s.seasonId].yellowCards += s.yellowCards || 0;
      statsBySeason[s.seasonId].redCards += s.redCards || 0;
    });

    return statsBySeason;
  };

  const filteredPlayers = players.filter(p => 
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const photoUrl = uploadedPhotoUrl || formData.get('photoUrl') as string;
    const playerData: any = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      number: parseInt(formData.get('number') as string),
      position: formData.get('position') as Position,
      birthDate: formData.get('birthDate') as string,
      isInjured: formData.get('isInjured') === 'on',
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
                <Select name="position" defaultValue={editingPlayer?.position || 'Defensa'}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecciona posición" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Portero" label="Portero">Portero</SelectItem>
                    <SelectItem value="Defensa" label="Defensa">Defensa</SelectItem>
                    <SelectItem value="Medio" label="Medio">Medio</SelectItem>
                    <SelectItem value="Delantero" label="Delantero">Delantero</SelectItem>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredPlayers.map((player, i) => {
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
                    className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden rounded-2xl cursor-pointer"
                    onClick={() => setViewingPlayer(player)}
                  >
                    <CardContent className="p-0">
                      <div className="p-6 flex items-center gap-4">
                        <div className="relative">
                          <Avatar className="h-16 w-16 border-2 border-emerald-50">
                            <AvatarImage src={player.photoUrl} className="object-cover" />
                            <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold text-xl">
                              {player.firstName[0]}{player.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[10px] font-bold h-6 w-6 rounded-full flex items-center justify-center border-2 border-white">
                            {player.number}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg truncate">{player.firstName} {player.lastName}</h3>
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
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDeletePlayer(player.id); }} className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                            <Trash2 size={14} />
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
      ) : (
        <div className="flex gap-6 h-[600px]">
          {/* Table View */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-y-auto flex-1 p-4">
              {['Portero', 'Defensa', 'Medio', 'Delantero'].map((pos) => {
                const posPlayers = filteredPlayers.filter(p => p.position === pos);
                if (posPlayers.length === 0) return null;
                const Icon = positionIcons[pos as Position];
                
                return (
                  <div key={pos} className="mb-6 last:mb-0">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2 px-2">
                      <Icon size={14} />
                      {pos}s
                    </h3>
                    <div className="space-y-2">
                      {posPlayers.map(player => (
                        <div 
                          key={player.id}
                          onClick={() => setViewingPlayer(player)}
                          className={cn(
                            "flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors border border-transparent",
                            viewingPlayer?.id === player.id 
                              ? "bg-emerald-50 border-emerald-200" 
                              : "hover:bg-gray-50 border-gray-100"
                          )}
                        >
                          <div className="w-8 flex justify-center">
                            <span className="text-sm font-bold text-gray-400">{player.number}</span>
                          </div>
                          <Avatar className="h-10 w-10 border border-gray-200">
                            <AvatarImage src={player.photoUrl} className="object-cover" />
                            <AvatarFallback className="bg-gray-100 text-gray-600 text-xs font-bold">
                              {player.firstName[0]}{player.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm truncate">
                              {player.firstName} {player.lastName}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">{calculateAge(player.birthDate)} años</span>
                              {player.isInjured && (
                                <span className="text-[10px] font-bold text-red-500 uppercase">Lesionado</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-emerald-600">{calculateRating(player.id)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side Panel for Stats */}
          {viewingPlayer && (
            <div className="w-80 bg-white rounded-2xl shadow-sm overflow-y-auto border-l border-gray-100">
              {(() => {
                const statsBySeason = getPlayerStatsBySeason(viewingPlayer.id);
                const totalStats = Object.values(statsBySeason).reduce((acc, curr) => ({
                  matches: acc.matches + curr.matches,
                  goals: acc.goals + curr.goals,
                  assists: acc.assists + curr.assists,
                  yellowCards: acc.yellowCards + curr.yellowCards,
                  redCards: acc.redCards + curr.redCards,
                }), { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 });

                return (
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-emerald-50">
                          <AvatarImage src={viewingPlayer.photoUrl} className="object-cover" />
                          <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold text-xl">
                            {viewingPlayer.firstName[0]}{viewingPlayer.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-bold text-lg leading-tight">{viewingPlayer.firstName}</h3>
                          <h3 className="font-bold text-lg leading-tight">{viewingPlayer.lastName}</h3>
                          <Badge variant="secondary" className={cn("mt-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", positionColors[viewingPlayer.position])}>
                            {viewingPlayer.position}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingPlayer(viewingPlayer)} className="h-8 w-8 text-gray-400 hover:text-emerald-600">
                          <Edit2 size={14} />
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
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">PJ: <strong className="text-gray-900">{s.matches}</strong></span>
                                    <span className="text-emerald-600">G: <strong className="text-emerald-700">{s.goals}</strong></span>
                                    <span className="text-blue-600">A: <strong className="text-blue-700">{s.assists}</strong></span>
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
              }), { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 });

              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-2xl flex items-center gap-3">
                      <Avatar className="h-12 w-12 border-2 border-emerald-50">
                        <AvatarImage src={viewingPlayer.photoUrl} className="object-cover" />
                        <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold">
                          {viewingPlayer.firstName[0]}{viewingPlayer.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        {viewingPlayer.firstName} {viewingPlayer.lastName}
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
                      <div className="grid grid-cols-5 gap-4 text-center">
                        <div className="bg-gray-50 p-3 rounded-xl">
                          <p className="text-xs text-gray-500 uppercase font-bold">Partidos</p>
                          <p className="text-2xl font-black text-gray-900">{totalStats.matches}</p>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-xl">
                          <p className="text-xs text-emerald-600 uppercase font-bold">Goles</p>
                          <p className="text-2xl font-black text-emerald-700">{totalStats.goals}</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-xl">
                          <p className="text-xs text-blue-600 uppercase font-bold">Asist.</p>
                          <p className="text-2xl font-black text-blue-700">{totalStats.assists}</p>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded-xl">
                          <p className="text-xs text-yellow-600 uppercase font-bold">T. Ama</p>
                          <p className="text-2xl font-black text-yellow-700">{totalStats.yellowCards}</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-xl">
                          <p className="text-xs text-red-600 uppercase font-bold">T. Roja</p>
                          <p className="text-2xl font-black text-red-700">{totalStats.redCards}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold mb-3">Histórico por Temporada</h3>
                      {Object.keys(statsBySeason).length > 0 ? (
                        <div className="space-y-3">
                          {Object.entries(statsBySeason).map(([seasonId, s]) => {
                            const season = seasons.find(se => se.id === seasonId);
                            return (
                              <div key={seasonId} className="flex items-center justify-between p-3 border rounded-xl">
                                <span className="font-bold">{season?.name || 'Temporada Desconocida'}</span>
                                <div className="flex gap-4 text-sm">
                                  <span className="text-gray-500">PJ: <strong className="text-gray-900">{s.matches}</strong></span>
                                  <span className="text-emerald-600">G: <strong className="text-emerald-700">{s.goals}</strong></span>
                                  <span className="text-blue-600">A: <strong className="text-blue-700">{s.assists}</strong></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No hay estadísticas registradas para este jugador.</p>
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
