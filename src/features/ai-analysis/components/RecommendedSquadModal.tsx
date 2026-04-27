import React from 'react';
import { Match, Opponent, Player } from '../../../types';
import { MatchPrediction } from '../../../types/aiAnalysis';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Trophy, Navigation, Shield, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecommendedSquadModalProps {
  matchId: string | null;
  onClose: () => void;
  matches: Match[];
  opponents: Opponent[];
  predictions: Map<string, MatchPrediction>;
  teamShieldUrl?: string;
  teamName?: string;
}

export const RecommendedSquadModal = React.memo(function RecommendedSquadModal({
  matchId,
  onClose,
  matches,
  opponents,
  predictions,
  teamShieldUrl,
  teamName
}: RecommendedSquadModalProps) {
  const match = React.useMemo(() => matches.find(m => m.id === matchId), [matches, matchId]);
  const opponent = React.useMemo(() => opponents.find(o => o.id === match?.opponentId), [opponents, match]);
  const prediction = React.useMemo(() => matchId ? predictions.get(matchId) : null, [predictions, matchId]);

  if (!match || !prediction) return null;

  return (
    <Dialog open={!!matchId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shrink-0 relative">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            {teamShieldUrl ? (
                <img src={teamShieldUrl} alt="" className="w-32 h-32 object-contain grayscale brightness-200" referrerPolicy="no-referrer" />
            ) : (
                <Shield size={120} />
            )}
          </div>
          <DialogHeader className="relative z-10 text-left">
            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Sparkles className="text-emerald-200 fill-emerald-200" size={24} />
              Mejor Equipo {teamName ? `de ${teamName}` : ''}
            </DialogTitle>
            <DialogDescription className="text-emerald-50 text-sm mt-1">
              vs {opponent?.name || 'Rival'} • Convocatoria sugerida por IA
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-xs font-black uppercase text-gray-400 tracking-widest">
                    <Trophy size={14} />
                    <span>Impacto en Probabilidad</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="text-[9px] font-black uppercase text-emerald-600 mb-1">Victoria Predicha</p>
                        <p className="text-2xl font-black text-emerald-700 tabular-nums">{prediction.probabilities.win.toFixed(0)}%</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <p className="text-[9px] font-black uppercase text-blue-600 mb-1">Resultado Base</p>
                        <p className="text-2xl font-black text-blue-700 tabular-nums">{prediction.team} - {prediction.opponent}</p>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50">
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                        <span className="font-black text-emerald-600 uppercase mr-1">Justificación:</span>
                        Alineación optimizada maximizando el Baremo Medio y las sinergias históricas. Se priorizan jugadores disponibles con mejores métricas de rendimiento reciente.
                    </p>
                </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Alineación Estratégica</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {prediction.recommendedSquad.map((player, idx) => (
                  <div key={player.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <span className="text-xs font-black text-gray-200 w-4">{idx + 1}</span>
                    <Avatar className="h-10 w-10 rounded-lg shrink-0 border border-gray-50">
                      <AvatarImage src={player.photoUrl} className="object-cover" referrerPolicy="no-referrer" />
                      <AvatarFallback className="bg-gray-100 text-gray-500 text-xs font-bold">
                        {player.firstName[0]}{player.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {player.alias || player.firstName}
                      </p>
                      <Badge variant="outline" className={cn(
                        "text-[9px] h-4 px-1.5 font-bold border-none",
                        player.position === 'Portero' ? "bg-amber-100 text-amber-500" :
                        player.position === 'Defensa' ? "bg-blue-100 text-blue-500" :
                        player.position === 'Medio' ? "bg-emerald-100 text-emerald-500" :
                        "bg-red-100 text-red-500"
                      )}>
                        {player.position}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11"
            onClick={onClose}
          >
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
