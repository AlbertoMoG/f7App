import React from 'react';
import {
  ClipboardCheck,
  Brain,
  Info,
  History,
  Swords,
  LayoutGrid,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Player, Match, PlayerStat, Opponent, Season, Field, PlayerSeason, Injury, StandingsEntry, Team, LeagueFixture } from '../types';
import { cn } from '@/lib/utils';

// New Architecture Imports
import { usePlayerRatings } from '../features/ai-analysis/hooks/usePlayerRatings';
import { usePredictions } from '../features/ai-analysis/hooks/usePredictions';
import { useSquadAnalysis } from '../features/ai-analysis/hooks/useSquadAnalysis';
import { PredictionCard } from '../features/ai-analysis/components/PredictionCard';
import { SquadsTab } from '../features/ai-analysis/components/SquadsTab';
import { AIVsFootballTab } from '../features/ai-analysis/components/AIVsFootballTab';
import { RivalsAnalysisTab } from '../features/ai-analysis/components/RivalsAnalysisTab';
import { useRivalThreatAnalysis } from '../features/ai-analysis/hooks/useRivalThreatAnalysis';
import { RecommendedSquadModal } from '../features/ai-analysis/components/RecommendedSquadModal';
import { IdealSquadTab } from '../features/ai-analysis/components/IdealSquadTab';
import { BestSevenTab } from '../features/ai-analysis/components/BestSevenTab';
import { SquadDetailModal } from '../features/ai-analysis/components/SquadDetailModal';
import { buildSynergyMap } from '../lib/synergyCalculator';

interface AIAnalysisProps {
  team: Team | null;
  players: Player[];
  playerSeasons: PlayerSeason[];
  matches: Match[];
  stats: PlayerStat[];
  opponents: Opponent[];
  seasons: Season[];
  fields: Field[];
  injuries: Injury[];
  globalSeasonId: string;
  standings?: StandingsEntry[];
  leagueFixtures?: LeagueFixture[];
  onNavigateToMatch?: (matchId: string) => void;
}

export default function AIAnalysis(props: AIAnalysisProps) {
  const [activeAITab, setActiveAITab] = React.useState<
    'predictions' | 'squads' | 'idealSquad' | 'bestSeven' | 'rivals' | 'history'
  >('predictions');
  const [recommendedMatchId, setRecommendedMatchId] = React.useState<string | null>(null);
  const [selectedSquadMatchId, setSelectedSquadMatchId] = React.useState<string | null>(null);

  // Custom Hooks
  const { allPlayerRatings, filteredPlayers } = usePlayerRatings(props);

  const synergyMap = React.useMemo(
    () => buildSynergyMap(props.matches, props.stats),
    [props.matches, props.stats]
  );

  const predictions = usePredictions({ 
    ...props, 
    allPlayerRatings,
    standings: props.standings || []
  });
  
  const { squadAnalysis, analyzedLimit, setAnalyzedLimit } = useSquadAnalysis({
    ...props,
    allPlayerRatings,
    standings: props.standings || [],
  });

  const effectiveSeasonIdForRivals = React.useMemo(() => {
    if (props.globalSeasonId !== 'all') return props.globalSeasonId;
    if (props.seasons.length === 0) return '';
    return [...props.seasons].sort((a, b) => b.startYear - a.startYear)[0].id;
  }, [props.globalSeasonId, props.seasons]);

  const rivalThreatAnalysis = useRivalThreatAnalysis(
    effectiveSeasonIdForRivals,
    props.team,
    props.opponents,
    props.matches,
    props.standings || [],
    props.leagueFixtures || []
  );

  const rivalSeasonLabel = React.useMemo(() => {
    const s = props.seasons.find((x) => x.id === effectiveSeasonIdForRivals);
    return s?.name ?? (effectiveSeasonIdForRivals || '—');
  }, [props.seasons, effectiveSeasonIdForRivals]);

  const bestSevenSeasonLabel = React.useMemo(() => {
    if (props.globalSeasonId === 'all') return '';
    return props.seasons.find((s) => s.id === props.globalSeasonId)?.name ?? props.globalSeasonId;
  }, [props.globalSeasonId, props.seasons]);

  const scheduledMatches = React.useMemo(() => {
    return props.matches.filter(m => {
        const isAtSeason = props.globalSeasonId === 'all' || m.seasonId === props.globalSeasonId;
        return m.status === 'scheduled' && isAtSeason;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [props.matches, props.globalSeasonId]);

  const idealSquadFallbackLambdas = React.useMemo(() => {
    const completed = props.matches.filter(
      (m) => m.status === 'completed' && m.scoreTeam != null && m.scoreOpponent != null
    );
    const leagueMs = completed.filter((m) => m.type === 'league');
    const base = leagueMs.length > 0 ? leagueMs : completed;
    if (base.length === 0) return { gf: 1.5, gc: 1.5 };
    const gf = base.reduce((a, m) => a + (m.scoreTeam ?? 0), 0) / base.length;
    const gc = base.reduce((a, m) => a + (m.scoreOpponent ?? 0), 0) / base.length;
    return { gf: Math.max(0.1, gf), gc: Math.max(0.1, gc) };
  }, [props.matches]);

  const analyzedMatches = React.useMemo(() => {
    return props.matches
      .filter(m => {
        const isAtSeason = props.globalSeasonId === 'all' || m.seasonId === props.globalSeasonId;
        const attendingCount = props.stats.filter(s => s.matchId === m.id && s.attendance === 'attending').length;
        return isAtSeason && attendingCount >= 5;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, analyzedLimit);
  }, [props.matches, props.globalSeasonId, props.stats, analyzedLimit]);

  const hasMoreToAnalyze = React.useMemo(() => {
    const total = props.matches.filter(m => {
      const isAtSeason = props.globalSeasonId === 'all' || m.seasonId === props.globalSeasonId;
      const attendingCount = props.stats.filter(s => s.matchId === m.id && s.attendance === 'attending').length;
      return isAtSeason && attendingCount >= 5;
    }).length;
    return total > analyzedLimit;
  }, [props.matches, props.globalSeasonId, props.stats, analyzedLimit]);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Main Content Areas */}
        <div className="flex flex-wrap bg-gray-50/80 p-1.5 rounded-2xl gap-1 border border-gray-100 mb-2 max-w-full">
            <div 
                onClick={() => setActiveAITab('predictions')}
                className={cn(
                    "flex items-center gap-2 px-6 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-wider cursor-pointer select-none",
                    activeAITab === 'predictions' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-400 hover:text-gray-500"
                )}
            >
                <Brain size={14} />
                Inteligencia Predictiva
                <Tooltip>
                    <TooltipTrigger render={
                        <span 
                            className="p-1 -mr-1.5 bg-transparent hover:bg-gray-100 rounded-full transition-colors cursor-help"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Info size={12} className="text-gray-400" />
                        </span>
                    } />
                    <TooltipContent className="max-w-[300px] p-5 bg-[#141414] text-white border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                    <Brain size={12} />
                                    Motor de Predicción IA
                                </p>
                                <p className="text-[10px] text-gray-400 leading-relaxed">
                                    Analizamos más de 15 variables críticas para proyectar el resultado más probable mediante procesos estocásticos.
                                </p>
                            </div>
                            
                            <div className="space-y-2.5">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-white">1. Potencial de Plantilla</p>
                                    <p className="text-[9px] text-gray-400">Comparamos el Baremo Medio de los convocados actuales contra el histórico del equipo.</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-white">2. Sinergias y Química</p>
                                    <p className="text-[9px] text-gray-400">Detectamos 'conexiones letales' basadas en el rendimiento conjunto histórico de los jugadores en el campo.</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-white">3. Distribución de Poisson</p>
                                    <p className="text-[9px] text-gray-400">Calculamos la probabilidad de cada marcador (0-9 goles) basándonos en la lambda de ataque y defensa proyectada.</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-white">4. Ajuste de Momentum</p>
                                    <p className="text-[9px] text-gray-400">Consideramos la racha de los últimos 3 partidos, fatiga por días de descanso y competitividad en la tabla.</p>
                                </div>
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </div>
            <div 
                onClick={() => setActiveAITab('squads')}
                className={cn(
                    "flex items-center gap-2 px-6 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-wider cursor-pointer select-none",
                    activeAITab === 'squads' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-400 hover:text-gray-500"
                )}
            >
                <ClipboardCheck size={14} />
                Estudio de Convocatorias
            </div>
            <div 
                onClick={() => setActiveAITab('idealSquad')}
                className={cn(
                    "flex items-center gap-2 px-6 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-wider cursor-pointer select-none",
                    activeAITab === 'idealSquad' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-400 hover:text-gray-500"
                )}
            >
                <LayoutGrid size={14} />
                Convocatoria ideal IA
            </div>
            <div 
                onClick={() => setActiveAITab('bestSeven')}
                className={cn(
                    "flex items-center gap-2 px-6 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-wider cursor-pointer select-none",
                    activeAITab === 'bestSeven' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-400 hover:text-gray-500"
                )}
            >
                <Star size={14} className={activeAITab === 'bestSeven' ? 'text-amber-500 fill-amber-400' : ''} />
                Mejor 7
            </div>
            <div 
                onClick={() => setActiveAITab('rivals')}
                className={cn(
                    "flex items-center gap-2 px-6 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-wider cursor-pointer select-none",
                    activeAITab === 'rivals' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-400 hover:text-gray-500"
                )}
            >
                <Swords size={14} />
                Análisis Rivales
            </div>
            <div 
                onClick={() => setActiveAITab('history')}
                className={cn(
                    "flex items-center gap-2 px-6 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-wider cursor-pointer select-none",
                    activeAITab === 'history' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-400 hover:text-gray-500"
                )}
            >
                <History size={14} />
                IA vs Fútbol
            </div>
        </div>

        {activeAITab === 'predictions' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scheduledMatches.map(match => {
              const attendingCount = props.stats.filter(s => s.matchId === match.id && s.attendance === 'attending').length;
              return (
              <PredictionCard
                key={match.id}
                match={match}
                teamShieldUrl={props.team?.shieldUrl}
                teamName={props.team?.name}
                opponent={props.opponents.find(o => o.id === match.opponentId)}
                season={props.seasons.find(s => s.id === match.seasonId)}
                field={props.fields.find(f => f.id === match.fieldId)}
                prediction={predictions.get(match.id)}
                attendingCount={attendingCount}
                onNavigateToMatch={props.onNavigateToMatch}
                onOpenRecommended={setRecommendedMatchId}
              />
            )})}
          </div>
        ) : activeAITab === 'squads' ? (
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="text-emerald-600" size={20} />
                    Historial de Convocatorias
                    <Tooltip>
                      <TooltipTrigger render={
                        <span className="p-1 bg-transparent hover:bg-gray-100 rounded-full transition-colors cursor-help ml-1">
                          <Info size={14} className="text-gray-300 hover:text-gray-400" />
                        </span>
                      } />
                      <TooltipContent className="max-w-[280px] p-5 bg-[#141414] text-white border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400">Estudio de Convocatorias</p>
                            <p className="text-[10px] text-gray-400 leading-relaxed">
                                Evaluamos si el resultado fue consecuencia directa del nivel de la plantilla desplazada o de factores externos.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Leyenda de Grados</p>
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <span className="w-4 h-4 rounded bg-fuchsia-600 text-[10px] font-black flex items-center justify-center text-white shrink-0">S</span>
                                <p className="text-[10px] text-gray-300"><span className="text-white font-bold">Élite:</span> Plantilla estelar (Baremo &gt; 8.5).</p>
                              </div>
                              <div className="flex gap-2">
                                <span className="w-4 h-4 rounded bg-emerald-600 text-[10px] font-black flex items-center justify-center text-white shrink-0">A</span>
                                <p className="text-[10px] text-gray-300"><span className="text-white font-bold">Excelente:</span> Alta competitividad (Baremo &gt; 7.5).</p>
                              </div>
                              <div className="flex gap-2">
                                <span className="w-4 h-4 rounded bg-blue-600 text-[10px] font-black flex items-center justify-center text-white shrink-0">B</span>
                                <p className="text-[10px] text-gray-300"><span className="text-white font-bold">Buena:</span> Plantilla equilibrada (Baremo &gt; 6.0).</p>
                              </div>
                              <div className="flex gap-2">
                                <span className="w-4 h-4 rounded bg-amber-500 text-[10px] font-black flex items-center justify-center text-white shrink-0">C</span>
                                <p className="text-[10px] text-gray-300"><span className="text-white font-bold">Regular:</span> Nivel justo (Baremo &gt; 4.5).</p>
                              </div>
                              <div className="flex gap-2">
                                <span className="w-4 h-4 rounded bg-red-600 text-[10px] font-black flex items-center justify-center text-white shrink-0">D</span>
                                <p className="text-[10px] text-gray-300"><span className="text-white font-bold">Baja:</span> Convocatoria crítica (Baremo &le; 4.5).</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <CardDescription>Análisis del nivel de la plantilla reunida por partido.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SquadsTab
                analyzedMatches={analyzedMatches}
                squadAnalysis={squadAnalysis}
                stats={props.stats}
                opponents={props.opponents}
                analyzedLimit={analyzedLimit}
                onSetLimit={setAnalyzedLimit}
                onSelectMatch={setSelectedSquadMatchId}
                onNavigateToMatch={props.onNavigateToMatch}
                hasMoreToAnalyze={hasMoreToAnalyze}
                filteredMatchesCount={props.matches.filter(m => {
                  const isAtSeason = props.globalSeasonId === 'all' || m.seasonId === props.globalSeasonId;
                  const attendingCount = props.stats.filter(s => s.matchId === m.id && s.attendance === 'attending').length;
                  return isAtSeason && attendingCount >= 5;
                }).length}
              />
            </CardContent>
          </Card>
        ) : activeAITab === 'idealSquad' ? (
          <IdealSquadTab
            scheduledMatches={scheduledMatches}
            stats={props.stats}
            opponents={props.opponents}
            seasons={props.seasons}
            fields={props.fields}
            predictions={predictions}
            onOpenDetail={setRecommendedMatchId}
            onNavigateToMatch={props.onNavigateToMatch}
          />
        ) : activeAITab === 'bestSeven' ? (
          <BestSevenTab
            players={filteredPlayers}
            allPlayerRatings={allPlayerRatings}
            seasonLabel={bestSevenSeasonLabel}
            isAllSeasons={props.globalSeasonId === 'all'}
          />
        ) : activeAITab === 'rivals' ? (
          <RivalsAnalysisTab
            rows={rivalThreatAnalysis.rows}
            managedTeamRow={rivalThreatAnalysis.managedTeamRow}
            seasonLabel={rivalSeasonLabel}
            isAllSeasonsNote={props.globalSeasonId === 'all'}
          />
        ) : (
          <AIVsFootballTab 
            matches={props.matches}
            opponents={props.opponents}
            globalSeasonId={props.globalSeasonId}
          />
        )}

        {/* Modals */}
        <RecommendedSquadModal
          matchId={recommendedMatchId}
          onClose={() => setRecommendedMatchId(null)}
          matches={props.matches}
          opponents={props.opponents}
          predictions={predictions}
          teamShieldUrl={props.team?.shieldUrl}
          teamName={props.team?.name}
          players={props.players}
          playerSeasons={props.playerSeasons}
          stats={props.stats}
          injuries={props.injuries}
          allPlayerRatings={allPlayerRatings}
          synergyMap={synergyMap}
          fallbackModelLambdas={idealSquadFallbackLambdas}
        />

        <SquadDetailModal
          matchId={selectedSquadMatchId}
          onClose={() => setSelectedSquadMatchId(null)}
          matches={props.matches}
          opponents={props.opponents}
          squadAnalysis={squadAnalysis}
          teamShieldUrl={props.team?.shieldUrl}
          teamName={props.team?.name}
        />
      </div>
    </TooltipProvider>
  );
}
