import React from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar,
  ShieldAlert,
  Upload,
  Loader2,
  Shield,
  Users,
  Check,
  Edit2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Season, Opponent, Player } from '../types';
import { uploadImage } from '../lib/imageUpload';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface SeasonManagerProps {
  seasons: Season[];
  opponents: Opponent[];
  players: Player[];
  onAddSeason: (name: string, playerIds: string[]) => void;
  onAddOpponent: (name: string, shieldUrl?: string, seasonIds?: string[]) => void;
  onUpdateOpponent: (id: string, name: string, shieldUrl?: string, seasonIds?: string[]) => void;
  onDeleteSeason: (id: string) => void;
  onDeleteOpponent: (id: string) => void;
}

export default function SeasonManager({ 
  seasons, 
  opponents, 
  players,
  onAddSeason, 
  onAddOpponent,
  onUpdateOpponent,
  onDeleteSeason,
  onDeleteOpponent
}: SeasonManagerProps) {
  const [newSeason, setNewSeason] = React.useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = React.useState<string[]>([]);
  
  const [editingOpponent, setEditingOpponent] = React.useState<Opponent | null>(null);
  const [opponentName, setOpponentName] = React.useState('');
  const [opponentShieldUrl, setOpponentShieldUrl] = React.useState('');
  const [selectedOpponentSeasonIds, setSelectedOpponentSeasonIds] = React.useState<string[]>([]);
  
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingOpponent) {
      setOpponentName(editingOpponent.name);
      setOpponentShieldUrl(editingOpponent.shieldUrl || '');
      setSelectedOpponentSeasonIds(editingOpponent.seasonIds || []);
    } else {
      setOpponentName('');
      setOpponentShieldUrl('');
      setSelectedOpponentSeasonIds([]);
    }
  }, [editingOpponent]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const url = await uploadImage(file, 'opponents');
      setOpponentShieldUrl(url);
    } catch (error) {
      console.error("Error uploading opponent shield:", error);
      toast.error("Hubo un error al subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId) 
        : [...prev, playerId]
    );
  };

  const toggleOpponentSeason = (seasonId: string) => {
    setSelectedOpponentSeasonIds(prev => 
      prev.includes(seasonId) 
        ? prev.filter(id => id !== seasonId) 
        : [...prev, seasonId]
    );
  };

  const selectAllPlayers = () => {
    if (selectedPlayerIds.length === players.length) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds(players.map(p => p.id));
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
        <p className="text-gray-500">Gestiona temporadas y equipos rivales.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Seasons */}
        <Card className="border-none shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="text-emerald-600" size={20} />
              Temporadas
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
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

              <Button 
                onClick={() => {
                  if (newSeason) {
                    onAddSeason(newSeason, selectedPlayerIds);
                    setNewSeason('');
                    setSelectedPlayerIds([]);
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

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Temporadas Existentes</Label>
              {seasons.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Calendar size={16} className="text-emerald-600" />
                    </div>
                    <span className="font-bold text-gray-700">{s.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onDeleteSeason(s.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              {seasons.length === 0 && (
                <div className="text-center py-8 text-gray-400 italic text-sm">
                  No hay temporadas creadas.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Opponents */}
        <Card className="border-none shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="text-emerald-600" size={20} />
              Rivales
            </CardTitle>
            <CardDescription>Equipos contra los que compites.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-bold text-gray-400 uppercase ml-1">
                  {editingOpponent ? 'Editar Rival' : 'Nuevo Rival'}
                </Label>
                {editingOpponent && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setEditingOpponent(null)}
                    className="h-6 text-[10px] font-bold uppercase text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <X size={12} className="mr-1" />
                    Cancelar
                  </Button>
                )}
              </div>
              
              <Input 
                placeholder="Nombre del equipo..." 
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                className="rounded-xl bg-white border-none shadow-sm h-11"
              />
              
              <div className="flex gap-2">
                <Input 
                  placeholder="URL del escudo (opcional)..." 
                  value={opponentShieldUrl}
                  onChange={(e) => setOpponentShieldUrl(e.target.value)}
                  className="rounded-xl flex-1 bg-white border-none shadow-sm h-11"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  className="rounded-xl px-3 h-11 bg-white border-none shadow-sm hover:bg-gray-50"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 size={18} className="animate-spin text-emerald-600" /> : <Upload size={18} className="text-gray-400" />}
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                />
              </div>

              <div className="space-y-2 mt-2">
                <Label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Asociar a Temporadas</Label>
                <div className="flex flex-wrap gap-2">
                  {seasons.map(s => (
                    <button
                      key={s.id}
                      onClick={() => toggleOpponentSeason(s.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border",
                        selectedOpponentSeasonIds.includes(s.id)
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                          : "bg-white border-gray-200 text-gray-500 hover:border-emerald-200"
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
                  {seasons.length === 0 && (
                    <p className="text-[10px] text-gray-400 italic">Crea una temporada primero</p>
                  )}
                </div>
              </div>

              <Button 
                onClick={() => {
                  if (opponentName) {
                    if (editingOpponent) {
                      onUpdateOpponent(editingOpponent.id, opponentName, opponentShieldUrl, selectedOpponentSeasonIds);
                      setEditingOpponent(null);
                    } else {
                      onAddOpponent(opponentName, opponentShieldUrl, selectedOpponentSeasonIds);
                      setOpponentName('');
                      setOpponentShieldUrl('');
                      setSelectedOpponentSeasonIds([]);
                    }
                  } else {
                    toast.error("Introduce un nombre para el rival");
                  }
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold shadow-lg shadow-emerald-100 mt-2"
              >
                {editingOpponent ? (
                  <>
                    <Check size={18} className="mr-2" />
                    Guardar Cambios
                  </>
                ) : (
                  <>
                    <Plus size={18} className="mr-2" />
                    Añadir Rival
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Rivales Registrados</Label>
              {opponents.map(o => (
                <div key={o.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-3 min-w-0">
                    {o.shieldUrl ? (
                      <img src={o.shieldUrl} alt={o.name} className="w-10 h-10 rounded-xl object-cover border bg-white shadow-sm" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <Shield size={18} className="text-gray-300" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="font-bold text-gray-700 truncate block">{o.name}</span>
                      <div className="flex gap-1 mt-0.5">
                        {(o.seasonIds || []).map(sid => {
                          const s = seasons.find(se => se.id === sid);
                          return s ? (
                            <span key={sid} className="text-[8px] font-black bg-gray-200 text-gray-500 px-1 rounded uppercase">
                              {s.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => setEditingOpponent(o)} className="text-gray-400 hover:text-emerald-600">
                      <Edit2 size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDeleteOpponent(o.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
              {opponents.length === 0 && (
                <div className="text-center py-8 text-gray-400 italic text-sm">
                  No hay rivales registrados.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
