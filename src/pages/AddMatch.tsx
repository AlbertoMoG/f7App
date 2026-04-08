import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Season, Opponent, MatchType, Match } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ArrowLeft, Calendar, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface AddMatchProps {
  seasons: Season[];
  opponents: Opponent[];
  onAddMatch: (match: Omit<Match, 'id'>) => Promise<any>;
}

export default function AddMatch({ seasons, opponents, onAddMatch }: AddMatchProps) {
  const navigate = useNavigate();

  const [seasonId, setSeasonId] = useState<string>('');
  const [opponentId, setOpponentId] = useState<string>('');
  const [type, setType] = useState<MatchType>('friendly');
  const [isHome, setIsHome] = useState<string>('true');
  const [round, setRound] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [location, setLocation] = useState<string>('');

  // Precargar datos iniciales
  useEffect(() => {
    if (seasons.length > 0 && !seasonId) {
      const currentYear = new Date().getFullYear().toString();
      const currentSeason = seasons.find(s => s.name.includes(currentYear))?.id || seasons[0].id;
      setSeasonId(currentSeason);
    }
  }, [seasons, seasonId]);

  useEffect(() => {
    if (opponents.length > 0 && !opponentId) {
      setOpponentId(opponents[0].id);
    }
  }, [opponents, opponentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seasonId || !opponentId || !date) return;

    try {
      const matchData: Omit<Match, 'id'> = {
        seasonId,
        opponentId,
        date,
        status: 'scheduled',
        type,
        isHome: isHome === 'true',
        location,
      };
      
      if (round) {
        matchData.round = round;
      }

      await onAddMatch(matchData);
      navigate('/matches');
    } catch (error) {
      console.error("Error creating match:", error);
      toast.error('Error al crear el partido');
    }
  };

  // Prevenir renderizado hasta que los datos existan para evitar el bug del selector
  if (seasons.length === 0 || opponents.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-20">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/matches')}
          className="mb-6 hover:bg-white rounded-xl"
        >
          <ArrowLeft size={18} className="mr-2" />
          Volver a Partidos
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="bg-emerald-600 p-8 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Calendar size={24} />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black">Programar Partido</CardTitle>
                  <CardDescription className="text-emerald-100">Añade un nuevo encuentro al calendario de tu equipo.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* 1. SELECTOR DE TEMPORADA */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Temporada</Label>
                    <Select value={seasonId} onValueChange={setSeasonId} required>
                      <SelectTrigger>
                        <SelectValue>
                          {seasonId 
                            ? seasons.find(s => s.id === seasonId)?.name 
                            : <span className="text-gray-400">Selecciona temporada</span>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {seasons.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 2. SELECTOR DE RIVAL */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Rival</Label>
                    <Select value={opponentId} onValueChange={setOpponentId} required>
                      <SelectTrigger>
                        <SelectValue>
                          {opponentId 
                            ? opponents.find(o => o.id === opponentId)?.name 
                            : <span className="text-gray-400">Selecciona rival</span>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {opponents.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 3. SELECTOR DE TIPO */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Tipo de Partido</Label>
                    <Select value={type} onValueChange={(v: MatchType) => setType(v)} required>
                      <SelectTrigger>
                        <SelectValue>
                          {type === 'friendly' ? 'Amistoso' : type === 'league' ? 'Liga' : type === 'cup' ? 'Copa' : <span className="text-gray-400">Selecciona tipo</span>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Amistoso</SelectItem>
                        <SelectItem value="league">Liga</SelectItem>
                        <SelectItem value="cup">Copa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 4. SELECTOR DE CONDICIÓN */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Condición</Label>
                    <Select value={isHome} onValueChange={setIsHome} required>
                      <SelectTrigger>
                        <SelectValue>
                          {isHome === 'true' ? 'Local' : isHome === 'false' ? 'Visitante' : <span className="text-gray-400">Selecciona condición</span>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Local</SelectItem>
                        <SelectItem value="false">Visitante</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(type === 'league' || type === 'cup') && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-400 uppercase ml-1">
                        {type === 'league' ? 'Jornada' : 'Ronda'}
                      </Label>
                      <Input 
                        value={round}
                        onChange={(e) => setRound(e.target.value)}
                        placeholder={type === 'league' ? "Ej: Jornada 5" : "Ej: Cuartos de Final"}
                        required 
                        className="h-12 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Fecha y Hora</Label>
                    <Input 
                      type="datetime-local" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required 
                      className="h-12 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Lugar de juego</Label>
                    <Input 
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ej: Polideportivo Municipal"
                      className="h-12 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>
                </div>

                <div className="pt-6">
                  <Button 
                    type="submit" 
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-100 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <Save className="mr-2" size={20} />
                    Crear Partido
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}