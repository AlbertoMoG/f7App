import React from 'react';
import { Player, Injury, Season, PlayerSeason } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, Calendar, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InjuredPlayersProps {
  players: Player[];
  injuries: Injury[];
  seasons: Season[];
  playerSeasons: PlayerSeason[];
}

export default function InjuredPlayers({ players, injuries, seasons, playerSeasons }: InjuredPlayersProps) {
  // Get players who have at least one injury
  const injuredPlayers = players.filter(p => injuries.some(i => i.playerId === p.id));

  if (injuredPlayers.length === 0) {
    return (
      <div className="py-20 text-center bg-white rounded-2xl shadow-sm border border-gray-100">
        <Activity className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-1">Sin Lesionados</h3>
        <p className="text-gray-500">No hay registro de lesiones en el equipo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {injuredPlayers.map(player => {
          const playerInjuries = injuries
            .filter(i => i.playerId === player.id)
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
          
          const activeInjury = playerInjuries.find(i => !i.endDate);
          const pastInjuries = playerInjuries.filter(i => i.endDate);

          // Get player seasons
          const pSeasons = playerSeasons
            .filter(ps => ps.playerId === player.id)
            .map(ps => seasons.find(s => s.id === ps.seasonId))
            .filter(Boolean) as Season[];

          return (
            <Card key={player.id} className={cn("border-none shadow-sm overflow-hidden rounded-2xl", activeInjury ? "ring-2 ring-red-500/20" : "")}>
              <CardContent className="p-0">
                <div className="p-6 flex items-start gap-4 border-b border-gray-50">
                  <Avatar className="h-16 w-16 border-2 border-gray-50 rounded-xl">
                    <AvatarImage src={player.photoUrl} className="object-cover rounded-xl" />
                    <AvatarFallback className="bg-gray-50 text-gray-600 font-bold text-xl rounded-xl">
                      {player.firstName[0]}{player.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">
                      {player.alias || `${player.firstName} ${player.lastName}`}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                        {player.position}
                      </Badge>
                      {activeInjury ? (
                        <Badge variant="destructive" className="rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border-none">
                          Baja Médica
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border-none">
                          Recuperado
                        </Badge>
                      )}
                    </div>
                    {pSeasons.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {pSeasons.map(s => (
                          <span key={s.id} className="text-[9px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-6 bg-gray-50/50">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity size={14} />
                    Historial de Lesiones
                  </h4>
                  <div className="space-y-4">
                    {activeInjury && (
                      <div className="relative pl-4 border-l-2 border-red-500">
                        <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-red-500 ring-4 ring-red-50" />
                        <p className="text-sm font-bold text-red-700">Lesión Actual</p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Calendar size={12} />
                          Desde: {format(new Date(activeInjury.startDate), "d 'de' MMMM, yyyy", { locale: es })}
                        </p>
                        {activeInjury.cause && (
                          <div className="mt-2 bg-white p-2 rounded-lg border border-red-100 text-xs text-gray-600 flex items-start gap-2">
                            <Info size={14} className="text-red-400 shrink-0 mt-0.5" />
                            <p>{activeInjury.cause}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {pastInjuries.map((injury, idx) => (
                      <div key={injury.id} className="relative pl-4 border-l-2 border-gray-200">
                        <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-gray-300 ring-4 ring-white" />
                        <p className="text-sm font-bold text-gray-700">Lesión Pasada</p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Calendar size={12} />
                          {format(new Date(injury.startDate), "d MMM yyyy", { locale: es })} - {injury.endDate ? format(new Date(injury.endDate), "d MMM yyyy", { locale: es }) : 'N/A'}
                        </p>
                        {injury.cause && (
                          <div className="mt-2 bg-white p-2 rounded-lg border border-gray-100 text-xs text-gray-600 flex items-start gap-2">
                            <Info size={14} className="text-gray-400 shrink-0 mt-0.5" />
                            <p>{injury.cause}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
