import React from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar,
  Check,
  Edit2,
  Users,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Season, Player, Opponent } from '../types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface SeasonManagerProps {
  seasons: Season[];
  players: Player[];
  opponents: Opponent[];
  onAddSeason: (name: string, playerIds: string[], opponentIds: string[]) => void;
  onUpdateSeason: (id: string, name: string, playerIds: string[], opponentIds: string[]) => void;
  onDeleteSeason: (id: string) => void;
}

export default function SeasonManager({ 
  seasons, 
  players,
  opponents,
  onAddSeason, 
  onUpdateSeason,
  onDeleteSeason
}: SeasonManagerProps) {
  const [newSeason, setNewSeason] = React.useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = React.useState<string[]>([]);
  const [selectedOpponentIds, setSelectedOpponentIds] = React.useState<string[]>([]);
  const [editingSeason, setEditingSeason] = React.useState<Season | null>(null);
  const [editSeasonName, setEditSeasonName] = React.useState('');
  const [editSelectedPlayerIds, setEditSelectedPlayerIds] = React.useState<string[]>([]);
  const [editSelectedOpponentIds, setEditSelectedOpponentIds] = React.useState<string[]>([]);
  
  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId) 
        : [...prev, playerId]
    );
  };

  const selectAllPlayers = () => {
    if (selectedPlayerIds.length === players.length) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds(players.map(p => p.id));
    }
  };

  const toggleOpponent = (opponentId: string) => {
    setSelectedOpponentIds(prev => 
      prev.includes(opponentId) 
        ? prev.filter(id => id !== opponentId) 
        : [...prev, opponentId]
    );
  };

  const selectAllOpponents = () => {
    if (selectedOpponentIds.length === opponents.length) {
      setSelectedOpponentIds([]);
    } else {
      setSelectedOpponentIds(opponents.map(o => o.id));
    }
  };

  const toggleEditPlayer = (playerId: string) => {
    setEditSelectedPlayerIds(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId) 
        : [...prev, playerId]
    );
  };

  const selectAllEditPlayers = () => {
    if (editSelectedPlayerIds.length === players.length) {
      setEditSelectedPlayerIds([]);
    } else {
      setEditSelectedPlayerIds(players.map(p => p.id));
    }
  };

  const toggleEditOpponent = (opponentId: string) => {
    setEditSelectedOpponentIds(prev => 
      prev.includes(opponentId) 
        ? prev.filter(id => id !== opponentId) 
        : [...prev, opponentId]
    );
  };

  const selectAllEditOpponents = () => {
    if (editSelectedOpponentIds.length === opponents.length) {
      setEditSelectedOpponentIds([]);
    } else {
      setEditSelectedOpponentIds(opponents.map(o => o.id));
    }
  };

  const handleEditClick = (season: Season) => {
    setEditingSeason(season);
    setEditSeasonName(season.name);
    setEditSelectedPlayerIds(players.filter(p => p.seasonIds?.includes(season.id)).map(p => p.id));
    setEditSelectedOpponentIds(opponents.filter(o => o.seasonIds?.includes(season.id)).map(o => o.id));
  };

  const handleSaveEdit = () => {
    if (editingSeason && editSeasonName) {
      onUpdateSeason(editingSeason.id, editSeasonName, editSelectedPlayerIds, editSelectedOpponentIds);
      setEditingSeason(null);
    } else {
      toast.error("El nombre de la temporada no puede estar vacío");
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Temporadas</h2>
        <p className="text-gray-500">Gestiona las temporadas y asocia jugadores a ellas.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Seasons */}
        <Card className="border-none shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="text-emerald-600" size={20} />
              Nueva Temporada
            </CardTitle>
            <CardDescription>Define los periodos de competición y asocia jugadores.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Nombre de la Temporada</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Ej: 2025/2026" 
                    value={newSeason}
                    onChange={(e) => setNewSeason(e.target.value)}
                    className="rounded-xl bg-white border-none shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <Label className="text-xs font-bold text-gray-400 uppercase">Seleccionar Jugadores</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={selectAllPlayers}
                    className="h-7 text-[10px] font-bold uppercase text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  >
                    {selectedPlayerIds.length === players.length ? 'Desmarcar todos' : 'Marcar todos'}
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                  {players.map(player => (
                    <div 
                      key={player.id} 
                      onClick={() => togglePlayer(player.id)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer",
                        selectedPlayerIds.includes(player.id) 
                          ? "bg-emerald-50 border-emerald-200" 
                          : "bg-white border-transparent hover:border-gray-200"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-md border flex items-center justify-center transition-colors",
                        selectedPlayerIds.includes(player.id) 
                          ? "bg-emerald-600 border-emerald-600" 
                          : "border-gray-300"
                      )}>
                        {selectedPlayerIds.includes(player.id) && <Check size={10} className="text-white" />}
                      </div>
                      <span className="text-xs font-medium truncate">
                        {player.alias || `${player.firstName} ${player.lastName}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <Label className="text-xs font-bold text-gray-400 uppercase">Seleccionar Rivales</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={selectAllOpponents}
                    className="h-7 text-[10px] font-bold uppercase text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  >
                    {selectedOpponentIds.length === opponents.length ? 'Desmarcar todos' : 'Marcar todos'}
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                  {opponents.map(opponent => (
                    <div 
                      key={opponent.id} 
                      onClick={() => toggleOpponent(opponent.id)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer",
                        selectedOpponentIds.includes(opponent.id) 
                          ? "bg-emerald-50 border-emerald-200" 
                          : "bg-white border-transparent hover:border-gray-200"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-md border flex items-center justify-center transition-colors",
                        selectedOpponentIds.includes(opponent.id) 
                          ? "bg-emerald-600 border-emerald-600" 
                          : "border-gray-300"
                      )}>
                        {selectedOpponentIds.includes(opponent.id) && <Check size={10} className="text-white" />}
                      </div>
                      <span className="text-xs font-medium truncate">
                        {opponent.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={() => {
                  if (newSeason) {
                    onAddSeason(newSeason, selectedPlayerIds, selectedOpponentIds);
                    setNewSeason('');
                    setSelectedPlayerIds([]);
                    setSelectedOpponentIds([]);
                  } else {
                    toast.error("Introduce un nombre para la temporada");
                  }
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold shadow-lg shadow-emerald-100"
              >
                <Plus size={18} className="mr-2" />
                Crear Temporada
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Temporadas */}
        <Card className="border-none shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="text-emerald-600" size={20} />
              Temporadas Existentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {seasons.map(s => {
                const seasonPlayers = players.filter(p => p.seasonIds?.includes(s.id));
                const seasonOpponents = opponents.filter(o => o.seasonIds?.includes(s.id));
                return (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Calendar size={16} className="text-emerald-600" />
                      </div>
                      <div>
                        <span className="font-bold text-gray-700 block">{s.name}</span>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                            <Users size={10} />
                            {seasonPlayers.length} jugadores
                          </span>
                          <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                            <ShieldAlert size={10} />
                            {seasonOpponents.length} rivales
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(s)} className="text-gray-400 hover:text-emerald-600 hover:bg-emerald-50">
                        <Edit2 size={16} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDeleteSeason(s.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {seasons.length === 0 && (
                <div className="text-center py-8 text-gray-400 italic text-sm">
                  No hay temporadas creadas.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={!!editingSeason} onOpenChange={(open) => !open && setEditingSeason(null)}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Calendar className="text-emerald-600" size={24} />
              Editar Temporada
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Nombre de la Temporada</Label>
              <Input 
                value={editSeasonName}
                onChange={(e) => setEditSeasonName(e.target.value)}
                className="rounded-xl bg-gray-50 border-none shadow-sm h-12"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <Label className="text-xs font-bold text-gray-400 uppercase">Jugadores Asociados</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={selectAllEditPlayers}
                  className="h-7 text-[10px] font-bold uppercase text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                >
                  {editSelectedPlayerIds.length === players.length ? 'Desmarcar todos' : 'Marcar todos'}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                {players.map(player => (
                  <div 
                    key={player.id} 
                    onClick={() => toggleEditPlayer(player.id)}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer",
                      editSelectedPlayerIds.includes(player.id) 
                        ? "bg-emerald-50 border-emerald-200" 
                        : "bg-white border-gray-100 hover:border-gray-200"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-md border flex items-center justify-center transition-colors",
                      editSelectedPlayerIds.includes(player.id) 
                        ? "bg-emerald-600 border-emerald-600" 
                        : "border-gray-300 bg-white"
                    )}>
                      {editSelectedPlayerIds.includes(player.id) && <Check size={10} className="text-white" />}
                    </div>
                    <span className="text-xs font-medium truncate">
                      {player.alias || `${player.firstName} ${player.lastName}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <Label className="text-xs font-bold text-gray-400 uppercase">Rivales Asociados</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={selectAllEditOpponents}
                  className="h-7 text-[10px] font-bold uppercase text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                >
                  {editSelectedOpponentIds.length === opponents.length ? 'Desmarcar todos' : 'Marcar todos'}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                {opponents.map(opponent => (
                  <div 
                    key={opponent.id} 
                    onClick={() => toggleEditOpponent(opponent.id)}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer",
                      editSelectedOpponentIds.includes(opponent.id) 
                        ? "bg-emerald-50 border-emerald-200" 
                        : "bg-white border-gray-100 hover:border-gray-200"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-md border flex items-center justify-center transition-colors",
                      editSelectedOpponentIds.includes(opponent.id) 
                        ? "bg-emerald-600 border-emerald-600" 
                        : "border-gray-300 bg-white"
                    )}>
                      {editSelectedOpponentIds.includes(opponent.id) && <Check size={10} className="text-white" />}
                    </div>
                    <span className="text-xs font-medium truncate">
                      {opponent.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSeason(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
