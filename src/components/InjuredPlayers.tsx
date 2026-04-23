import React from 'react';
import { Player, Injury, Season, PlayerSeason } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, Calendar, Info, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface InjuredPlayersProps {
  players: Player[];
  injuries: Injury[];
  seasons: Season[];
  playerSeasons: PlayerSeason[];
  globalSeasonId?: string;
}

export default function InjuredPlayers({ players, injuries, seasons, playerSeasons, globalSeasonId = 'all' }: InjuredPlayersProps) {
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'injured' | 'recovered'>('all');

  const filteredInjuries = React.useMemo(() => {
    if (globalSeasonId === 'all') return injuries;
    
    const season = seasons.find(s => s.id === globalSeasonId);
    // If no season found or no startYear, fallback to explicit seasonId filtering
    if (!season || !season.startYear) {
      return injuries.filter(i => i.seasonId === globalSeasonId);
    }

    const startYear = season.startYear;
    // Season bounds: From August 1st of startYear to July 31st of startYear + 1
    const seasonStart = new Date(startYear, 7, 1); 
    const seasonEnd = new Date(startYear + 1, 6, 31);

    return injuries.filter(i => {
      // Direct match by ID is always valid
      if (i.seasonId === globalSeasonId) return true;
      
      // Otherwise check if the injury date falls within the natural timeline of the season
      const injuryDate = new Date(i.startDate);
      return injuryDate >= seasonStart && injuryDate <= seasonEnd;
    });
  }, [injuries, globalSeasonId, seasons]);

  // Separate players into Injured (active) and Recovered (all injuries ended)
  const injuredList = React.useMemo(() => {
    const active = filteredInjuries.filter(i => !i.endDate);
    return active.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [filteredInjuries]);

  const recoveredList = React.useMemo(() => {
    const ended = filteredInjuries.filter(i => i.endDate);
    return ended.sort((a, b) => new Date(b.endDate!).getTime() - new Date(a.endDate!).getTime());
  }, [filteredInjuries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Activity className="text-red-500" />
            Control de Enfermería
          </h2>
          <p className="text-sm text-gray-500">
            {globalSeasonId === 'all' 
              ? 'Historial completo de bajas y recuperaciones.' 
              : `Bajas y recuperaciones de la ${seasons.find(s => s.id === globalSeasonId)?.name}.`}
          </p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
          {(['all', 'recovered', 'injured'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all",
                filterStatus === status 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              {status === 'all' ? 'Todos' : status === 'recovered' ? 'Recuperados' : 'Lesionados'}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(
        "grid grid-cols-1 gap-8",
        filterStatus === 'all' ? "lg:grid-cols-2" : "lg:grid-cols-1 max-w-4xl mx-auto"
      )}>
        {/* RECOVERED (LEFT) */}
        {(filterStatus === 'all' || filterStatus === 'recovered') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Recuperados
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none ml-2">
                  {recoveredList.length}
                </Badge>
              </h3>
            </div>
            
            <div className="space-y-3">
              {recoveredList.length === 0 ? (
                <div className="py-12 text-center bg-emerald-50/30 rounded-3xl border-2 border-dashed border-emerald-100">
                  <p className="text-sm text-emerald-600/60 font-medium italic">No hay registros en este periodo.</p>
                </div>
              ) : (
                recoveredList.map(injury => {
                  const player = players.find(p => p.id === injury.playerId);
                  if (!player) return null;
                  return (
                    <Card key={injury.id} className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden rounded-2xl group">
                      <CardContent className="p-4 flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-gray-50 rounded-xl shrink-0">
                          <AvatarImage src={player.photoUrl} className="object-cover rounded-xl" />
                          <AvatarFallback className="bg-gray-50 text-gray-600 font-bold rounded-xl">
                            {player.firstName[0]}{player.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-gray-900 truncate">
                              {player.alias || `${player.firstName} ${player.lastName}`}
                            </p>
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                              Alta: {injury.endDate ? format(new Date(injury.endDate), "d MMM yyyy", { locale: es }) : '-'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5 italic">
                            "{injury.cause || 'Sin causa especificada'}"
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                             <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase bg-gray-100 text-gray-500 border-none">
                               {player.position}
                             </Badge>
                             <span className="text-[9px] text-gray-400 flex items-center gap-1">
                               <Calendar size={10} />
                               Baja: {format(new Date(injury.startDate), "d MMM", { locale: es })}
                             </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* INJURED (RIGHT) */}
        {(filterStatus === 'all' || filterStatus === 'injured') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Lesionados (Baja)
                <Badge variant="secondary" className="bg-red-50 text-red-600 border-none ml-2">
                  {injuredList.length}
                </Badge>
              </h3>
            </div>

            <div className="space-y-3">
              {injuredList.length === 0 ? (
                <div className="py-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  <p className="text-sm text-gray-400 font-medium italic">Enfermería vacía. ¡La plantilla está al 100%!</p>
                </div>
              ) : (
                injuredList.map(injury => {
                  const player = players.find(p => p.id === injury.playerId);
                  if (!player) return null;
                  return (
                    <Card key={injury.id} className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden rounded-2xl ring-2 ring-red-500/10">
                      <CardContent className="p-4 flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-red-50 rounded-xl shrink-0">
                          <AvatarImage src={player.photoUrl} className="object-cover rounded-xl" />
                          <AvatarFallback className="bg-red-50 text-red-600 font-bold rounded-xl">
                            {player.firstName[0]}{player.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-gray-900 truncate">
                              {player.alias || `${player.firstName} ${player.lastName}`}
                            </p>
                            <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase">
                              Baja: {format(new Date(injury.startDate), "d MMM yyyy", { locale: es })}
                            </span>
                          </div>
                          <div className="mt-2 bg-red-50/50 p-2 rounded-lg text-xs text-red-800 flex items-start gap-2 border border-red-100/50">
                            <Info size={14} className="text-red-400 shrink-0 mt-0.5" />
                            <p className="font-medium italic">"{injury.cause || 'Descripción no disponible'}"</p>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                             <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase bg-gray-100 text-gray-500 border-none">
                               {player.position}
                             </Badge>
                             <span className="text-[9px] text-gray-400 flex items-center gap-1 font-bold">
                               <Clock size={10} />
                               {Math.ceil((new Date().getTime() - new Date(injury.startDate).getTime()) / (1000 * 60 * 60 * 24))} días de baja
                             </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
