import React from 'react';
import { 
  Plus, 
  Trash2, 
  ShieldAlert,
  Upload,
  Loader2,
  Shield,
  Check,
  Edit2,
  X,
  History,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Season, Opponent, Match, Team } from '../types';
import { uploadImage } from '../lib/imageUpload';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface OpponentManagerProps {
  seasons: Season[];
  opponents: Opponent[];
  matches: Match[];
  team?: Team;
  onAddOpponent: (name: string, shieldUrl?: string, seasonIds?: string[]) => void;
  onUpdateOpponent: (id: string, name: string, shieldUrl?: string, seasonIds?: string[]) => void;
  onDeleteOpponent: (id: string) => void;
}

export default function OpponentManager({ 
  seasons, 
  opponents, 
  matches,
  team,
  onAddOpponent,
  onUpdateOpponent,
  onDeleteOpponent
}: OpponentManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [selectedOpponent, setSelectedOpponent] = React.useState<Opponent | null>(null);
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
      setIsDialogOpen(true);
    } else if (!isDialogOpen) {
      setOpponentName('');
      setOpponentShieldUrl('');
      setSelectedOpponentSeasonIds([]);
    }
  }, [editingOpponent, isDialogOpen]);

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

  const toggleOpponentSeason = (seasonId: string) => {
    setSelectedOpponentSeasonIds(prev => 
      prev.includes(seasonId) 
        ? prev.filter(id => id !== seasonId) 
        : [...prev, seasonId]
    );
  };

  const handleSave = () => {
    if (opponentName) {
      if (editingOpponent) {
        onUpdateOpponent(editingOpponent.id, opponentName, opponentShieldUrl, selectedOpponentSeasonIds);
      } else {
        onAddOpponent(opponentName, opponentShieldUrl, selectedOpponentSeasonIds);
      }
      setIsDialogOpen(false);
      setEditingOpponent(null);
    } else {
      toast.error("Introduce un nombre para el rival");
    }
  };

  const getOpponentHistory = (opponentId: string) => {
    return matches
      .filter(m => m.opponentId === opponentId && m.status === 'completed')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const calculateStats = (opponentId: string) => {
    const history = getOpponentHistory(opponentId);
    return history.reduce((acc, m) => {
      const teamScore = m.scoreTeam || 0;
      const opponentScore = m.scoreOpponent || 0;
      
      acc.total++;
      acc.goalsFor += teamScore;
      acc.goalsAgainst += opponentScore;
      
      if (teamScore > opponentScore) acc.wins++;
      else if (teamScore < opponentScore) acc.losses++;
      else acc.draws++;
      
      return acc;
    }, { total: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });
  };

  const opponentHistory = selectedOpponent ? getOpponentHistory(selectedOpponent.id) : [];
  const stats = selectedOpponent ? calculateStats(selectedOpponent.id) : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Rivales</h2>
          <p className="text-gray-500">Gestiona los equipos contra los que compites.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingOpponent(null);
          }}>
            <DialogTrigger render={<Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold shadow-lg shadow-emerald-100" />}>
              <Plus size={18} className="mr-2" />
              Nuevo Rival
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>{editingOpponent ? 'Editar Rival' : 'Nuevo Rival'}</DialogTitle>
                <DialogDescription>
                  {editingOpponent ? 'Modifica la información del equipo rival.' : 'Añade la información del nuevo equipo rival.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Nombre del equipo</Label>
                  <Input 
                    placeholder="Ej: Real Madrid" 
                    value={opponentName}
                    onChange={(e) => setOpponentName(e.target.value)}
                    className="rounded-xl bg-white border-gray-200 shadow-sm h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Escudo (Opcional)</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="URL del escudo..." 
                      value={opponentShieldUrl}
                      onChange={(e) => setOpponentShieldUrl(e.target.value)}
                      className="rounded-xl flex-1 bg-white border-gray-200 shadow-sm h-11"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="rounded-xl px-3 h-11 bg-white border-gray-200 shadow-sm hover:bg-gray-50"
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
                  onClick={handleSave}
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
            </DialogContent>
          </Dialog>

          {/* Dialog de Historial */}
          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <DialogHeader>
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100">
                    {selectedOpponent?.shieldUrl ? (
                      <img src={selectedOpponent.shieldUrl} alt={selectedOpponent.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                    ) : (
                      <Shield size={32} className="text-gray-300" />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">{selectedOpponent?.name}</DialogTitle>
                    <DialogDescription>Historial de enfrentamientos</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {stats && stats.total > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-emerald-50 p-4 rounded-2xl text-center border border-emerald-100">
                    <div className="flex items-center justify-center gap-2 text-emerald-600 mb-1">
                      <TrendingUp size={16} />
                      <span className="text-[10px] font-bold uppercase">Victorias</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-700">{stats.wins}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl text-center border border-gray-100">
                    <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
                      <Minus size={16} />
                      <span className="text-[10px] font-bold uppercase">Empates</span>
                    </div>
                    <div className="text-2xl font-black text-gray-700">{stats.draws}</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-2xl text-center border border-red-100">
                    <div className="flex items-center justify-center gap-2 text-red-600 mb-1">
                      <TrendingDown size={16} />
                      <span className="text-[10px] font-bold uppercase">Derrotas</span>
                    </div>
                    <div className="text-2xl font-black text-red-700">{stats.losses}</div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase ml-1">Partidos Jugados</h4>
                {opponentHistory.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <History size={32} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm italic">No hay partidos registrados contra este equipo.</p>
                  </div>
                ) : (
                  opponentHistory.map(match => {
                    const isWin = (match.scoreTeam || 0) > (match.scoreOpponent || 0);
                    const isLoss = (match.scoreTeam || 0) < (match.scoreOpponent || 0);
                    const isDraw = (match.scoreTeam || 0) === (match.scoreOpponent || 0);
                    
                    return (
                      <div key={match.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">
                            {format(new Date(match.date), "d 'de' MMMM, yyyy", { locale: es })}
                          </span>
                          <span className="text-xs font-medium text-gray-500">
                            {seasons.find(s => s.id === match.seasonId)?.name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-bold text-gray-700 truncate max-w-[80px]">{team?.name || 'Local'}</span>
                            </div>
                            <div className={cn(
                              "w-12 h-10 rounded-xl flex items-center justify-center text-lg font-black",
                              isWin ? "bg-emerald-100 text-emerald-700" : 
                              isLoss ? "bg-red-100 text-red-700" : 
                              "bg-gray-100 text-gray-700"
                            )}>
                              {match.scoreTeam} - {match.scoreOpponent}
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="text-xs font-bold text-gray-700 truncate max-w-[80px]">{selectedOpponent?.name}</span>
                            </div>
                          </div>
                          
                          <div className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-black uppercase",
                            isWin ? "bg-emerald-600 text-white" : 
                            isLoss ? "bg-red-600 text-white" : 
                            "bg-gray-500 text-white"
                          )}>
                            {isWin ? 'V' : isLoss ? 'D' : 'E'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Grid de Rivales */}
      {opponents.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
              <ShieldAlert size={32} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">No hay rivales</h3>
            <p className="text-gray-500 max-w-sm mb-6">
              Aún no has añadido ningún equipo rival. Añade el primero para empezar a registrar partidos.
            </p>
            <Button 
              onClick={() => setIsDialogOpen(true)}
              variant="outline"
              className="rounded-xl border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
            >
              <Plus size={18} className="mr-2" />
              Añadir Primer Rival
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {opponents.map(o => (
            <Card 
              key={o.id} 
              onClick={() => {
                setSelectedOpponent(o);
                setIsHistoryOpen(true);
              }}
              className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl group overflow-hidden bg-white cursor-pointer"
            >
              <CardContent className="p-4 flex flex-col items-center text-center relative">
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingOpponent(o);
                    }} 
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteOpponent(o.id);
                    }} 
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100 mb-3 mt-2">
                  {o.shieldUrl ? (
                    <img src={o.shieldUrl} alt={o.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                  ) : (
                    <Shield size={32} className="text-gray-300" />
                  )}
                </div>
                
                <h3 className="font-bold text-gray-800 text-sm line-clamp-2 w-full">{o.name}</h3>
                
                <div className="flex flex-wrap justify-center gap-1 mt-2 w-full">
                  {o.seasonIds?.slice(0, 2).map(sid => {
                    const season = seasons.find(s => s.id === sid);
                    return season ? (
                      <span key={sid} className="text-[9px] font-bold uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md truncate max-w-full">
                        {season.name}
                      </span>
                    ) : null;
                  })}
                  {(o.seasonIds?.length || 0) > 2 && (
                    <span className="text-[9px] font-bold uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">
                      +{(o.seasonIds?.length || 0) - 2}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
