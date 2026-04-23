import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  ShieldAlert, 
  Check, 
  ArrowLeft,
  Save,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Player, Opponent, Season, PlayerSeason } from '../types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SeasonFormProps {
  teamId: string;
  seasons: Season[];
  players: Player[];
  playerSeasons: PlayerSeason[];
  opponents: Opponent[];
  onAddSeason: (name: string, division: string, startYear: number, playerIds: string[], opponentIds: string[]) => void;
  onUpdateSeason: (id: string, name: string, division: string, startYear: number, playerIds: string[], opponentIds: string[]) => void;
}

export default function SeasonForm({ 
  teamId,
  seasons, 
  players, 
  playerSeasons,
  opponents, 
  onAddSeason, 
  onUpdateSeason 
}: SeasonFormProps) {
  const navigate = useNavigate();
  const { seasonId } = useParams();
  const isEditing = !!seasonId;

  const [name, setName] = React.useState('');
  const [division, setDivision] = React.useState('');
  const [startYear, setStartYear] = React.useState<number>(new Date().getFullYear());
  const [selectedPlayerIds, setSelectedPlayerIds] = React.useState<string[]>([]);
  const [selectedOpponentIds, setSelectedOpponentIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (isEditing && seasonId) {
      const season = seasons.find(s => s.id === seasonId);
      if (season) {
        setName(season.name);
        setDivision(season.division || '');
        setStartYear(season.startYear || new Date().getFullYear());
        const seasonPlayerIds = playerSeasons.filter(ps => ps.seasonId === season.id).map(ps => ps.playerId);
        setSelectedPlayerIds(seasonPlayerIds);
        setSelectedOpponentIds(opponents.filter(o => o.seasonIds?.includes(season.id)).map(o => o.id));
      }
    }
  }, [isEditing, seasonId, seasons, players, playerSeasons, opponents]);

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

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("El nombre de la temporada es obligatorio");
      return;
    }

    if (!startYear || startYear < 1900 || startYear > 2100) {
      toast.error("El año de inicio debe ser válido");
      return;
    }

    if (isEditing && seasonId) {
      onUpdateSeason(seasonId, name, division, startYear, selectedPlayerIds, selectedOpponentIds);
    } else {
      onAddSeason(name, division, startYear, selectedPlayerIds, selectedOpponentIds);
    }
    
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-20">
      <div className="max-w-screen-xl mx-auto px-4 pt-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-5">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="rounded-2xl bg-white shadow-sm hover:bg-gray-50 w-12 h-12"
            >
              <ArrowLeft size={24} />
            </Button>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-gray-900">
                {isEditing ? 'Editar Temporada' : 'Nueva Temporada'}
              </h1>
              <p className="text-gray-500 font-medium mt-1">
                {isEditing ? 'Modifica los datos y asociaciones de la temporada.' : 'Configura un nuevo periodo de competición.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="rounded-2xl h-12 px-6 font-bold border-gray-200 bg-white hover:bg-gray-50 transition-all"
            >
              <X size={20} className="mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-12 px-8 font-bold shadow-xl shadow-emerald-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Save size={20} className="mr-2" />
              {isEditing ? 'Guardar Cambios' : 'Crear Temporada'}
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-10">
          {/* Información General */}
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <div className="bg-emerald-600 p-8 text-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Calendar size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black">Información General</h2>
                  <p className="text-emerald-100 text-sm font-medium">Define los detalles básicos de la competición</p>
                </div>
              </div>
            </div>
            <CardContent className="p-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3 md:col-span-2">
                  <Label className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Nombre de la Temporada</Label>
                  <Input 
                    placeholder="Ej: Liga 2025/26" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-2xl bg-gray-50 border-transparent h-16 text-xl px-6 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-bold"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Año de Comienzo</Label>
                  <Input 
                    type="number"
                    placeholder="Ej: 2025" 
                    value={startYear}
                    onChange={(e) => setStartYear(parseInt(e.target.value))}
                    className="rounded-2xl bg-gray-50 border-transparent h-16 text-xl px-6 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-bold"
                  />
                </div>
                <div className="space-y-3 md:col-span-3">
                  <Label className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-1">División / Categoría</Label>
                  <Input 
                    placeholder="Ej: 1ª División, Liga Regional..." 
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    className="rounded-2xl bg-gray-50 border-transparent h-16 text-xl px-6 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Jugadores */}
            <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
              <div className="bg-white border-b border-gray-50 p-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-2xl">
                    <Users size={24} className="text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">Jugadores</h2>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                      {selectedPlayerIds.length} seleccionados
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={selectAllPlayers}
                  className="h-10 text-[11px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl px-5"
                >
                  {selectedPlayerIds.length === players.length ? 'Desmarcar todos' : 'Marcar todos'}
                </Button>
              </div>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 gap-3 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                  {players.map(player => (
                    <div 
                      key={player.id} 
                      onClick={() => togglePlayer(player.id)}
                      className={cn(
                        "flex items-center gap-5 p-5 rounded-[1.5rem] border-2 transition-all cursor-pointer group",
                        selectedPlayerIds.includes(player.id) 
                          ? "bg-emerald-50 border-emerald-200 shadow-md" 
                          : "bg-white border-gray-50 hover:border-gray-200 hover:bg-gray-50/50"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all",
                        selectedPlayerIds.includes(player.id) 
                          ? "bg-emerald-600 border-emerald-600 scale-110 shadow-lg shadow-emerald-200" 
                          : "border-gray-200 bg-white group-hover:border-emerald-300"
                      )}>
                        {selectedPlayerIds.includes(player.id) && <Check size={16} className="text-white stroke-[4]" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-base font-black text-gray-800">
                          {player.alias || `${player.firstName} ${player.lastName}`}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            #{player.number}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {player.position}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Rivales */}
            <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
              <div className="bg-white border-b border-gray-50 p-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-2xl">
                    <ShieldAlert size={24} className="text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">Rivales</h2>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                      {selectedOpponentIds.length} seleccionados
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={selectAllOpponents}
                  className="h-10 text-[11px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl px-5"
                >
                  {selectedOpponentIds.length === opponents.length ? 'Desmarcar todos' : 'Marcar todos'}
                </Button>
              </div>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 gap-3 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                  {opponents.map(opponent => (
                    <div 
                      key={opponent.id} 
                      onClick={() => toggleOpponent(opponent.id)}
                      className={cn(
                        "flex items-center gap-5 p-5 rounded-[1.5rem] border-2 transition-all cursor-pointer group",
                        selectedOpponentIds.includes(opponent.id) 
                          ? "bg-emerald-50 border-emerald-200 shadow-md" 
                          : "bg-white border-gray-50 hover:border-gray-200 hover:bg-gray-50/50"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all",
                        selectedOpponentIds.includes(opponent.id) 
                          ? "bg-emerald-600 border-emerald-600 scale-110 shadow-lg shadow-emerald-200" 
                          : "border-gray-200 bg-white group-hover:border-emerald-300"
                      )}>
                        {selectedOpponentIds.includes(opponent.id) && <Check size={16} className="text-white stroke-[4]" />}
                      </div>
                      <span className="text-base font-black text-gray-800">
                        {opponent.name}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
