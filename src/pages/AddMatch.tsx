import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Season, Opponent, MatchType, Match, Field } from '../types';
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
  fields: Field[];
  matches?: Match[];
  onAddMatch?: (match: Omit<Match, 'id'>) => Promise<any>;
  onUpdateMatch?: (match: Match) => Promise<any>;
}

export default function AddMatch({ seasons, opponents, fields, matches, onAddMatch, onUpdateMatch }: AddMatchProps) {
  const navigate = useNavigate();
  const { matchId } = useParams();
  const isEditing = !!matchId;
  const matchToEdit = isEditing && matches ? matches.find(m => m.id === matchId) : null;

  const [seasonId, setSeasonId] = useState<string>('');
  const [opponentId, setOpponentId] = useState<string>('');
  const [type, setType] = useState<MatchType>('friendly');
  const [isHome, setIsHome] = useState<string>('true');
  const [round, setRound] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [fieldId, setFieldId] = useState<string>('');
  const [status, setStatus] = useState<string>('scheduled');
  const [scoreTeam, setScoreTeam] = useState<number | ''>('');
  const [scoreOpponent, setScoreOpponent] = useState<number | ''>('');

  // Precargar datos iniciales
  useEffect(() => {
    if (isEditing && matchToEdit) {
      setSeasonId(matchToEdit.seasonId);
      setOpponentId(matchToEdit.opponentId);
      setType(matchToEdit.type || 'friendly');
      setIsHome(matchToEdit.isHome !== false ? 'true' : 'false');
      setRound(matchToEdit.round || '');
      
      // Convertir ISO string a formato local YYYY-MM-DDTHH:mm
      if (matchToEdit.date) {
        const d = new Date(matchToEdit.date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setDate(`${year}-${month}-${day}T${hours}:${minutes}`);
      } else {
        setDate('');
      }

      setLocation(matchToEdit.location || '');
      setFieldId(matchToEdit.fieldId || '');
      setStatus(matchToEdit.status || 'scheduled');
      setScoreTeam(matchToEdit.scoreTeam ?? '');
      setScoreOpponent(matchToEdit.scoreOpponent ?? '');
    }
  }, [isEditing, matchToEdit]);

  const filteredOpponents = React.useMemo(() => {
    if (!seasonId) return [];
    return opponents.filter(o => !o.seasonIds || o.seasonIds.length === 0 || o.seasonIds.includes(seasonId));
  }, [opponents, seasonId]);

  useEffect(() => {
    if (seasonId && opponentId) {
      const isOpponentValid = filteredOpponents.some(o => o.id === opponentId);
      if (!isOpponentValid) {
        setOpponentId('');
      }
    }
  }, [seasonId, filteredOpponents, opponentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seasonId || !opponentId || !date) return;

    try {
      if (isEditing && matchToEdit && onUpdateMatch) {
        const updatedMatch: Match = {
          ...matchToEdit,
          seasonId,
          opponentId,
          date: new Date(date).toISOString(),
          status: status as 'scheduled' | 'completed',
          type,
          isHome: isHome === 'true',
          location: location || null,
          fieldId: fieldId || null,
          round: round || null,
          scoreTeam: scoreTeam !== '' ? Number(scoreTeam) : null,
          scoreOpponent: scoreOpponent !== '' ? Number(scoreOpponent) : null,
        };
        
        // Remove any remaining undefined fields to be absolutely safe with Firestore
        Object.keys(updatedMatch).forEach(key => {
          if ((updatedMatch as any)[key] === undefined) {
            delete (updatedMatch as any)[key];
          }
        });

        await onUpdateMatch(updatedMatch);
        toast.success('Partido actualizado correctamente');
      } else if (onAddMatch) {
        const matchData: Omit<Match, 'id' | 'teamId'> = {
          seasonId,
          opponentId,
          date: new Date(date).toISOString(),
          status: 'scheduled',
          type,
          isHome: isHome === 'true',
          location,
          fieldId: fieldId || null,
        };
        
        if (round) {
          matchData.round = round;
        }

        await onAddMatch(matchData as any);
        toast.success('Partido creado correctamente');
      }
      navigate('/matches');
    } catch (error) {
      console.error("Error saving match:", error);
      toast.error('Error al guardar el partido');
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
      <div className="max-w-5xl mx-auto px-2 py-4">
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
                  <CardTitle className="text-2xl font-black">{isEditing ? 'Editar Partido' : 'Programar Partido'}</CardTitle>
                  <CardDescription className="text-emerald-100">
                    {isEditing ? 'Modifica los datos del encuentro.' : 'Añade un nuevo encuentro al calendario de tu equipo.'}
                  </CardDescription>
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
                            <div className="flex flex-col">
                              <span className="font-bold">{s.name}</span>
                              {s.division && <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{s.division}</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 2. SELECTOR DE RIVAL */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Rival</Label>
                    <Select value={opponentId} onValueChange={setOpponentId} required disabled={!seasonId}>
                      <SelectTrigger>
                        <SelectValue>
                          {opponentId 
                            ? opponents.find(o => o.id === opponentId)?.name 
                            : <span className="text-gray-400">Selecciona rival</span>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {filteredOpponents.map((o) => (
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
                    <Select value={type} onValueChange={(v: MatchType) => setType(v)} required disabled={!seasonId}>
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
                    <Select value={isHome} onValueChange={setIsHome} required disabled={!seasonId}>
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
                        disabled={!seasonId}
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
                      disabled={!seasonId}
                      className="h-12 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Campo / Lugar de juego</Label>
                    <Select value={fieldId} onValueChange={setFieldId} disabled={!seasonId}>
                      <SelectTrigger>
                        <SelectValue>
                          {fieldId 
                            ? fields.find(f => f.id === fieldId)?.name 
                            : <span className="text-gray-400">Selecciona campo</span>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Otro / No especificado</SelectItem>
                        {fields.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {fieldId === 'none' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Lugar personalizado</Label>
                      <Input 
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Ej: Polideportivo Municipal"
                        disabled={!seasonId}
                        className="h-12 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>
                  )}

                  {isEditing && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Estado</Label>
                      <Select value={status} onValueChange={setStatus} required>
                        <SelectTrigger>
                          <SelectValue>
                            {status === 'scheduled' ? 'Pendiente' : status === 'completed' ? 'Finalizado' : <span className="text-gray-400">Selecciona estado</span>}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Pendiente</SelectItem>
                          <SelectItem value="completed">Finalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {isEditing && status === 'completed' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Goles a favor</Label>
                        <Input 
                          type="number"
                          min="0"
                          value={scoreTeam}
                          onChange={(e) => setScoreTeam(e.target.value !== '' ? parseInt(e.target.value) : '')}
                          className="h-12 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Goles en contra</Label>
                        <Input 
                          type="number"
                          min="0"
                          value={scoreOpponent}
                          onChange={(e) => setScoreOpponent(e.target.value !== '' ? parseInt(e.target.value) : '')}
                          className="h-12 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500" 
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-6">
                  <Button 
                    type="submit" 
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-100 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <Save className="mr-2" size={20} />
                    {isEditing ? 'Guardar Cambios' : 'Crear Partido'}
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