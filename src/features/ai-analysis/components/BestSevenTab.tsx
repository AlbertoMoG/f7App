import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Info, Star } from 'lucide-react';
import type { Player } from '../../../types';
import type { PlayerRating } from '../../../types/aiAnalysis';

export interface BestSevenTabProps {
  players: Player[];
  allPlayerRatings: PlayerRating[];
  seasonLabel: string;
  isAllSeasons: boolean;
}

function baremoTone(nota: number): string {
  if (nota >= 75) return 'text-emerald-700';
  if (nota >= 60) return 'text-blue-700';
  if (nota >= 45) return 'text-amber-700';
  return 'text-gray-600';
}

export const BestSevenTab = React.memo(function BestSevenTab({
  players,
  allPlayerRatings,
  seasonLabel,
  isAllSeasons,
}: BestSevenTabProps) {
  const navigate = useNavigate();

  const rows = React.useMemo(() => {
    const sorted = [...allPlayerRatings].sort((a, b) => b.rating - a.rating).slice(0, 7);
    return sorted
      .map((r, index) => {
        const player = players.find((p) => p.id === r.id);
        if (!player) return null;
        return { player, rating: r.rating, rank: index + 1 };
      })
      .filter((x): x is { player: Player; rating: number; rank: number } => x != null);
  }, [allPlayerRatings, players]);

  return (
    <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Star className="text-amber-500 shrink-0 fill-amber-400" size={22} />
              Mejor 7
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="p-1 bg-transparent hover:bg-gray-100 rounded-full transition-colors cursor-help">
                      <Info size={14} className="text-gray-300 hover:text-gray-400" />
                    </span>
                  }
                />
                <TooltipContent className="max-w-[280px] p-4 bg-[#141414] text-white border border-white/10 rounded-2xl text-xs leading-relaxed">
                  Los siete jugadores con mayor baremo del filtro actual (mismo criterio que el motor de predicción y
                  convocatoria ideal). Ideal como referencia visual rápida del núcleo fuerte del equipo en fútbol 7.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>
              Núcleo por baremo actual
              {isAllSeasons ? ' · todas las temporadas' : ` · ${seasonLabel}`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">No hay jugadores con baremo en el filtro seleccionado.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-5 sm:gap-6 md:gap-8 pt-2 pb-4">
            {rows.map(({ player, rating, rank }) => (
              <button
                key={player.id}
                type="button"
                onClick={() => navigate(`/players/${player.id}`)}
                className="group flex flex-col items-center w-[108px] sm:w-[120px] text-center rounded-2xl p-2 -m-2 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="relative mb-2">
                  <span className="absolute -top-1 -left-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white shadow-md ring-2 ring-white">
                    {rank}
                  </span>
                  <Avatar className="h-[88px] w-[88px] sm:h-24 sm:w-24 rounded-2xl border-2 border-white shadow-md ring-2 ring-gray-100 group-hover:ring-emerald-200 transition-[box-shadow]">
                    <AvatarImage
                      src={player.photoUrl}
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <AvatarFallback className="rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800 text-lg font-black">
                      {player.firstName[0]}
                      {player.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <p className="text-sm font-bold text-gray-900 truncate w-full px-0.5">
                  {player.alias?.trim() || player.firstName}
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    'mt-1 text-[9px] h-4 px-1.5 font-bold border-none',
                    player.position === 'Portero'
                      ? 'bg-amber-100 text-amber-600'
                      : player.position === 'Defensa'
                        ? 'bg-blue-100 text-blue-600'
                        : player.position === 'Medio'
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-red-100 text-red-600'
                  )}
                >
                  {player.position}
                </Badge>
                <p className={cn('mt-1.5 text-lg font-black tabular-nums', baremoTone(rating))}>
                  {rating.toFixed(1)}
                </p>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">baremo</p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
