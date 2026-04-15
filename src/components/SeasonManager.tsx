import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Calendar,
  Edit2,
  Users,
  ShieldAlert,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Season, Player, Opponent, PlayerSeason } from '../types';
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
  playerSeasons: PlayerSeason[];
  opponents: Opponent[];
  onAddSeason: (name: string, division: string, playerIds: string[], opponentIds: string[]) => void;
  onUpdateSeason: (id: string, name: string, division: string, playerIds: string[], opponentIds: string[]) => void;
  onDeleteSeason: (id: string) => void;
}

export default function SeasonManager({ 
  seasons, 
  players,
  playerSeasons,
  opponents,
  onDeleteSeason
}: SeasonManagerProps) {
  const navigate = useNavigate();
  
  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Temporadas</h2>
          <p className="text-gray-500">Gestiona las temporadas y asocia jugadores a ellas.</p>
        </div>
        <Button 
          onClick={() => navigate('/seasons/new')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold shadow-lg shadow-emerald-100 group"
        >
          <Plus size={18} className="mr-2 group-hover:hidden" />
          <Check size={18} className="mr-2 hidden group-hover:block" />
          Nueva Temporada
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {/* Lista de Temporadas */}
        <Card className="border-none shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="text-emerald-600" size={20} />
              Temporadas Existentes
            </CardTitle>
            <CardDescription>Visualiza y gestiona todas las temporadas de competición.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {seasons.map(s => {
                const seasonPlayerIds = playerSeasons.filter(ps => ps.seasonId === s.id).map(ps => ps.playerId);
                const seasonPlayers = players.filter(p => seasonPlayerIds.includes(p.id));
                const seasonOpponents = opponents.filter(o => o.seasonIds?.includes(s.id));
                return (
                  <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-emerald-50 transition-colors">
                        <Calendar size={20} className="text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 block text-lg leading-tight">{s.name}</span>
                          {s.division && (
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">
                              {s.division}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs font-medium text-gray-500 flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-gray-100">
                            <Users size={12} className="text-emerald-500" />
                            {seasonPlayers.length}
                          </span>
                          <span className="text-xs font-medium text-gray-500 flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-gray-100">
                            <ShieldAlert size={12} className="text-emerald-500" />
                            {seasonOpponents.length}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/seasons/${s.id}/edit`)} className="text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 h-9 w-9 rounded-lg">
                        <Edit2 size={18} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDeleteSeason(s.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 h-9 w-9 rounded-lg">
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {seasons.length === 0 && (
                <div className="col-span-full text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <Calendar className="mx-auto text-gray-300 mb-2" size={40} />
                  <p className="text-gray-400 italic font-medium">No hay temporadas creadas.</p>
                  <Button 
                    variant="link" 
                    onClick={() => navigate('/seasons/new')}
                    className="text-emerald-600 font-bold mt-2"
                  >
                    Crear la primera temporada
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
