import React from 'react';
import { Match, Opponent } from '../../../types';
import { SquadAnalysisResult } from '../../../types/aiAnalysis';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Target, Brain, ShieldCheck, ShieldAlert, Minus, Users, TrendingUp, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GRADE_COLORS } from '../../../lib/predictionConstants';

interface SquadDetailModalProps {
  matchId: string | null;
  onClose: () => void;
  matches: Match[];
  opponents: Opponent[];
  squadAnalysis: Map<string, SquadAnalysisResult>;
  teamShieldUrl?: string;
  teamName?: string;
}

export const SquadDetailModal = React.memo(function SquadDetailModal({
  matchId,
  onClose,
  matches,
  opponents,
  squadAnalysis,
  teamShieldUrl,
  teamName
}: SquadDetailModalProps) {
  const match = React.useMemo(() => matches.find(m => m.id === matchId), [matches, matchId]);
  const opponent = React.useMemo(() => opponents.find(o => o.id === match?.opponentId), [opponents, match]);
  const analysis = React.useMemo(() => matchId ? squadAnalysis.get(matchId) : null, [squadAnalysis, matchId]);

  if (!match || !analysis) return null;

  return (
    <Dialog open={!!matchId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white shrink-0 relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              {teamShieldUrl ? (
                <img src={teamShieldUrl} alt="" className="w-32 h-32 object-contain grayscale brightness-200" referrerPolicy="no-referrer" />
              ) : (
                <ClipboardCheck size={120} />
              )}
            </div>
            <DialogHeader className="relative z-10 text-left">
              <div className="flex justify-between items-start">
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                    Evaluación {teamName ? `de ${teamName}` : 'de Convocatoria'}
                  </DialogTitle>
                  <DialogDescription className="text-gray-300 text-sm mt-1">
                    vs {opponent?.name || 'Rival'} • {analysis.attendingCount} Jugadores
                  </DialogDescription>
                  <div className="mt-4 flex gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-gray-500 mb-1">Metodología</span>
                        <Badge variant="outline" className="text-[9px] font-bold border-gray-700 text-gray-400 bg-gray-800/50">
                            Cálculo de Sinergias y Balance Táctico
                        </Badge>
                    </div>
                  </div>
                </div>
                <div className={cn("px-4 py-2 text-2xl font-black rounded-xl border flex flex-col items-center leading-none", GRADE_COLORS[analysis.grade as keyof typeof GRADE_COLORS])}>
                  <span className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Grado</span>
                  {analysis.grade}
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
            <div className="space-y-6">
              
              {/* Resumen de Factores */}
              <section>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Target size={16} className="text-gray-400" />
                  Factores Analizados
                </h3>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                    <Brain size={20} className="text-indigo-500" />
                    <span className="font-bold text-gray-700">Puntuación Total:</span>
                    <span className={cn(
                      "font-black text-lg",
                      analysis.score >= 75 ? "text-emerald-600" : analysis.score >= 50 ? "text-amber-500" : "text-red-500"
                    )}>{analysis.score}/100</span>
                  </div>
                  {analysis.reasons.map((r, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="mt-0.5 shrink-0">
                          {r.type === 'positive' && <ShieldCheck size={16} className="text-emerald-500" />}
                          {r.type === 'negative' && <ShieldAlert size={16} className="text-red-500" />}
                          {r.type === 'neutral' && <Minus size={16} className="text-amber-500" />}
                        </div>
                        <span className="leading-tight text-sm text-gray-700 font-medium">{r.text}</span>
                      </div>
                  ))}
                </div>
              </section>

              {/* Aportación de Jugadores */}
              <section>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users size={16} className="text-gray-400" />
                  Aportación Individual ({analysis.playerContributions.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {analysis.playerContributions.map((pc, idx) => (
                    <div key={pc.player.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                      <span className="text-xs font-black text-gray-300 w-4">{idx + 1}</span>
                      <Avatar className="h-10 w-10 rounded-lg shrink-0 border border-gray-50">
                        <AvatarImage src={pc.player.photoUrl} className="object-cover" referrerPolicy="no-referrer" />
                        <AvatarFallback className="bg-gray-100 text-gray-500 text-xs font-bold">
                          {pc.player.firstName[0]}{pc.player.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {pc.player.alias || pc.player.firstName}
                        </p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <Badge variant="outline" className={cn(
                              "text-[9px] h-4 px-1.5 font-bold border-none",
                              pc.player.position === 'Portero' ? "bg-amber-100 text-amber-700" :
                              pc.player.position === 'Defensa' ? "bg-blue-100 text-blue-700" :
                              pc.player.position === 'Medio' ? "bg-emerald-100 text-emerald-700" :
                              "bg-red-100 text-red-700"
                            )}>
                              {pc.player.position}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                          <span className="text-sm font-black text-gray-900">{pc.rating.toFixed(1)}</span>
                          <span className="text-[8px] font-bold text-gray-400 uppercase">Baremo</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Alternativas / Mejoras */}
              {(analysis.improvements && analysis.improvements.length > 0) && (
                <section>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-500" />
                    Alternativas para Mejorar
                  </h3>
                  <div className="space-y-2">
                    {analysis.improvements.map((imp) => (
                      <div key={imp.player.id} className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 shadow-sm flex items-start gap-4">
                        <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 shrink-0">
                          <Plus size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900">
                            Añadir a <span className="text-emerald-700">{imp.player.alias || imp.player.firstName} {imp.player.lastName}</span>
                          </p>
                          <div className="mt-2 space-y-1">
                            {imp.reasons.map((r, i) => (
                              <div key={i} className="flex gap-2 items-center text-xs text-gray-600">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                {r.text}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm">
                          <span className="text-xs font-bold text-gray-400 uppercase">Sube a</span>
                          <span className="text-lg font-black text-emerald-600">
                            {(analysis.score + imp.scoreIncrease)}<span className="text-xs text-emerald-400">/100</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

            </div>
          </div>
          <div className="p-4 bg-white border-t border-gray-100 shrink-0">
            <Button 
              variant="outline"
              className="w-full font-bold rounded-xl h-11"
              onClick={onClose}
            >
              Cerrar Informe
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
});
