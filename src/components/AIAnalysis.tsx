import React from 'react';
import {
  Trophy,
  Calendar,
  Database,
  Clock,
  Shield,
  Lightbulb,
  Home,
  Navigation,
  Sparkles,
  Info,
  Target,
  ChevronRight,
  Brain,
  ClipboardCheck,
  Users,
  ShieldCheck,
  ShieldAlert,
  Minus,
  TrendingUp,
  Plus,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { motion } from 'motion/react';
import { Player, Match, PlayerStat, Opponent, Season, Field, PlayerSeason, Injury, StandingsEntry } from '../types';
import { cn } from '@/lib/utils';
import { calculatePlayerRating } from '../lib/ratingSystem';

interface AIAnalysisProps {
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
  onNavigateToMatch?: (matchId: string) => void;
}

export default function AIAnalysis({ 
  players, 
  playerSeasons, 
  matches, 
  stats, 
  opponents, 
  seasons, 
  fields, 
  injuries, 
  globalSeasonId,
  standings = [],
  onNavigateToMatch
}: AIAnalysisProps) {
  const [recommendedMatchId, setRecommendedMatchId] = React.useState<string | null>(null);
  const [activeAITab, setActiveAITab] = React.useState<'predictions' | 'squads'>('predictions');
  const [analyzedLimit, setAnalyzedLimit] = React.useState(5);
  const [squadViewMode, setSquadViewMode] = React.useState<'table' | 'cards'>('table');

  const filteredMatches = React.useMemo(() => matches.filter(m => {
    return globalSeasonId === 'all' || m.seasonId === globalSeasonId;
  }), [matches, globalSeasonId]);

  const filteredStats = React.useMemo(() => stats.filter(s => {
    const match = matches.find(m => m.id === s.matchId);
    return globalSeasonId === 'all' || match?.seasonId === globalSeasonId;
  }), [stats, matches, globalSeasonId]);

  const filteredPlayers = React.useMemo(() => {
    if (globalSeasonId === 'all') return players;
    const seasonPlayerIds = playerSeasons.filter(ps => ps.seasonId === globalSeasonId).map(ps => ps.playerId);
    return players.filter(p => seasonPlayerIds.includes(p.id));
  }, [players, playerSeasons, globalSeasonId]);

  const scheduledMatches = React.useMemo(() => {
    return filteredMatches.filter(m => m.status === 'scheduled')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredMatches]);

  const completedMatches = React.useMemo(() => {
    return filteredMatches.filter(m => m.status === 'completed')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredMatches]);

  const allPlayerRatings = React.useMemo(() => {
    return filteredPlayers.map(p => {
      const breakdown = calculatePlayerRating(matches, injuries, stats, p, globalSeasonId, seasons);
      return { 
        ...p, 
        rating: breakdown.notaFinal,
        breakdown
      };
    }).sort((a, b) => b.rating - a.rating);
  }, [filteredPlayers, matches, injuries, stats, globalSeasonId, seasons]);

  const predictions = React.useMemo(() => {
    // Usamos 'matches' y 'stats' directamente para ignorar el filtro de temporada en la predicción histórica
    if (matches.length === 0 || allPlayerRatings.length === 0) 
      return new Map<string, { 
        team: number, 
        opponent: number, 
        confidence: 'Alta' | 'Media' | 'Baja', 
        reasons: string[],
        probabilities: { win: number, draw: number, loss: number },
        recommendedSquad: Player[],
        recommendedProbabilities: { win: number, draw: number, loss: number }
      }>();
    
    const teamAvgBaremo = allPlayerRatings.reduce((a, b) => a + b.rating, 0) / allPlayerRatings.length;
    const allMatchesWithScores = matches
      .filter(m => m.scoreTeam != null && m.scoreOpponent != null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // De más reciente a más antiguo

    const globalAvgGF = allMatchesWithScores.reduce((acc, m) => acc + (m.scoreTeam || 0), 0) / (allMatchesWithScores.length || 1);
    const globalAvgGC = allMatchesWithScores.reduce((acc, m) => acc + (m.scoreOpponent || 0), 0) / (allMatchesWithScores.length || 1);
    
    // --- 0. AI Learning & Calibration (Feedback Loop) ---
    // Analizamos los últimos 5 resultados para ajustar el sesgo (Bias) del modelo
    const calibrationMatches = allMatchesWithScores.slice(0, 5);
    let biasGF = 0;
    let biasGC = 0;
    
    if (calibrationMatches.length > 0) {
      calibrationMatches.forEach(m => {
        // Estimación simplificada de lo que el modelo "esperaba"
        const historicalInPos = allMatchesWithScores.filter(am => am.opponentId === m.opponentId);
        const expectedGF = historicalInPos.length > 0
          ? historicalInPos.reduce((a, b) => a + (b.scoreTeam || 0), 0) / historicalInPos.length
          : globalAvgGF;
        const expectedGC = historicalInPos.length > 0
          ? historicalInPos.reduce((a, b) => a + (b.scoreOpponent || 0), 0) / historicalInPos.length
          : globalAvgGC;
          
        biasGF += (m.scoreTeam || 0) - expectedGF;
        biasGC += (m.scoreOpponent || 0) - expectedGC;
      });
      biasGF = (biasGF / calibrationMatches.length) * 0.4; // Ajuste moderado (40% de agresividad)
      biasGC = (biasGC / calibrationMatches.length) * 0.4;
    }
    
    // --- 1. Clasificación (Stats en Liga) ---
    const getStandingsStats = (seasonId: string, opponentId: string) => {
      const isMyTeam = opponentId === 'my-team';
      const manualEntry = standings.find(s => s.seasonId === seasonId && s.opponentId === opponentId);
      
      const relevantMatches = matches.filter(m => 
        m.seasonId === seasonId && 
        (isMyTeam ? true : m.opponentId === opponentId) &&
        m.status === 'completed' && 
        m.type === 'league'
      );
      
      let autoGF = 0;
      let autoGC = 0;
      let autoP = 0;
      let autoPts = 0;
      relevantMatches.forEach(m => {
        if (m.scoreTeam != null && m.scoreOpponent != null) {
          autoP++;
          const tScore = isMyTeam ? m.scoreTeam : m.scoreOpponent;
          const oScore = isMyTeam ? m.scoreOpponent : m.scoreTeam;
          autoGF += tScore;
          autoGC += oScore;
          if (tScore > oScore) autoPts += 3;
          else if (tScore === oScore) autoPts += 1;
        }
      });

      return {
        played: (manualEntry?.played || 0) + autoP,
        goalsFor: (manualEntry?.goalsFor || 0) + autoGF,
        goalsAgainst: (manualEntry?.goalsAgainst || 0) + autoGC,
        points: (manualEntry?.points || 0) + autoPts
      };
    };

    // --- 1. Racha del Equipo (Últimos 5 partidos) ---
    const last5Matches = allMatchesWithScores.slice(0, 5);
    const momentumGF = last5Matches.reduce((acc, m) => acc + (m.scoreTeam || 0), 0) / (last5Matches.length || 1);
    const momentumGC = last5Matches.reduce((acc, m) => acc + (m.scoreOpponent || 0), 0) / (last5Matches.length || 1);
    const momentumModifierGF = last5Matches.length > 0 ? (momentumGF / (globalAvgGF || 1)) : 1.0;
    const momentumModifierGC = last5Matches.length > 0 ? (momentumGC / (globalAvgGC || 1)) : 1.0;

    // --- 2. Identificación de Jugadores Clave y Win-Rates ---
    const keyPlayerIds = allPlayerRatings.slice(0, 3).map(p => p.id);
    
    // Win rate individual por jugador
    const playerWinRates = new Map<string, number>();
    players.forEach(p => {
      const pMatches = allMatchesWithScores.filter(m => 
        stats.some(s => s.matchId === m.id && s.playerId === p.id && s.attendance === 'attending')
      );
      if (pMatches.length >= 3) {
        const wins = pMatches.filter(m => (m.scoreTeam || 0) > (m.scoreOpponent || 0)).length;
        playerWinRates.set(p.id, wins / pMatches.length);
      }
    });

    // Análisis de Clean Sheets Recientes
    const recentCleanSheets = last5Matches.filter(m => (m.scoreOpponent || 0) === 0).length;

    // --- Análisis de Forma Individual (Jugadores en Racha) ---
    const recent3Matches = allMatchesWithScores.slice(0, 3);
    const inFormPlayers = new Set<string>();
    recent3Matches.forEach(m => {
      const matchStats = stats.filter(s => s.matchId === m.id && s.attendance === 'attending');
      matchStats.forEach(s => {
        if ((s.goals || 0) > 0 || (s.assists || 0) > 0) {
          inFormPlayers.add(s.playerId);
        }
      });
    });

    const poisson = (lambda: number, k: number) => {
      const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
      return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
    };

    const getMostProbableScore = (lambdaGF: number, lambdaGC: number) => {
      let maxProb = 0;
      let score = { team: 0, opponent: 0 };
      for (let i = 0; i <= 6; i++) {
        for (let j = 0; j <= 6; j++) {
          const prob = poisson(lambdaGF, i) * poisson(lambdaGC, j);
          if (prob > maxProb) {
            maxProb = prob;
            score = { team: i, opponent: j };
          }
        }
      }
      return score;
    };

    const calculateAge = (birthDate: string) => {
      if (!birthDate) return 25;
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    };

    const predictionMap = new Map<string, { 
      team: number, 
      opponent: number, 
      confidence: 'Alta' | 'Media' | 'Baja',
      reasons: string[],
      probabilities: { win: number, draw: number, loss: number },
      recommendedSquad: Player[],
      recommendedProbabilities: { win: number, draw: number, loss: number }
    }>();
    
    scheduledMatches.forEach(match => {
      const reasons: string[] = [];
      // 3. Historial Directo (Todas las temporadas)
      const vsOppMatches = allMatchesWithScores.filter(m => m.opponentId === match.opponentId);
      
      // 4. Calidad de la Convocatoria Actual
      const matchStats = stats.filter(s => s.matchId === match.id);
      const attendingIds = matchStats.filter(s => s.attendance === 'attending').map(s => s.playerId);
      const confirmedMissingIds = matchStats.filter(s => s.attendance === 'notAttending').map(s => s.playerId);
      
      const currentAttendingPlayers = players.filter(p => attendingIds.includes(p.id));
      const currentAttendingRatings = allPlayerRatings
        .filter(p => attendingIds.includes(p.id))
        .map(p => p.rating);
      
      const currentSquadSize = currentAttendingRatings.length;
      if (currentSquadSize < 5) return; // Mínimo 5 para predecir

      const currentAvgBaremo = currentSquadSize > 0 
        ? currentAttendingRatings.reduce((a, b) => a + b, 0) / currentSquadSize 
        : teamAvgBaremo;

      if (currentSquadSize > 0) {
        const diff = ((currentAvgBaremo / (teamAvgBaremo || 1)) - 1) * 100;
        if (diff > 5) reasons.push(`Nivel técnico superior (+${diff.toFixed(0)}% del nivel medio)`);
        else if (diff < -5) reasons.push(`Nivel técnico inferior (${diff.toFixed(0)}%)`);
        else reasons.push('Nivel técnico equilibrado');
      }

      // --- 4.1 Win Rate de la Convocatoria ---
      const attendingWinRates = currentAttendingPlayers
        .map(p => playerWinRates.get(p.id))
        .filter((wr): wr is number => wr !== undefined);
      
      if (attendingWinRates.length > 0) {
        const avgWR = attendingWinRates.reduce((a, b) => a + b, 0) / attendingWinRates.length;
        if (avgWR > 0.6) reasons.push('Plantilla con alto ratio de victoria histórico');
        else if (avgWR < 0.4) reasons.push('Ratio de victorias discreto en los convocados');
      }

      // --- 4.2 Equilibrio Táctico ---
      const hasGoalkeeper = currentAttendingPlayers.some(p => p.position === 'Portero');
      const defendersCount = currentAttendingPlayers.filter(p => p.position === 'Defensa').length;
      const attackersCount = currentAttendingPlayers.filter(p => p.position === 'Delantero').length;

      let tacticalModifierGC = 1.0;
      let tacticalModifierGF = 1.0;

      if (!hasGoalkeeper) {
        reasons.push('Aviso: Sin portero especialista (Sube riesgo de gol)');
        tacticalModifierGC *= 1.35;
      } else {
        reasons.push('Portería cubierta por especialista');
      }

      if (defendersCount < 2 && currentSquadSize >= 7) {
        reasons.push('Pocos defensas naturales confirmados');
        tacticalModifierGC *= 1.2;
      } else if (defendersCount >= 3) {
        reasons.push('Sólida base defensiva en la convocatoria');
        tacticalModifierGC *= 0.9;
      }

      if (attackersCount >= 3) {
        reasons.push('Alta presencia de delanteros confirmada');
        tacticalModifierGF *= 1.15;
      }

      // --- 4.3 Sinergia y Química entre Jugadores (Dúos Letales) ---
      let synergiesFound = 0;
      let topSynergyName = "";
      for (let i = 0; i < currentAttendingPlayers.length; i++) {
        for (let j = i + 0; j < currentAttendingPlayers.length; j++) {
          if (i === j) continue;
          const p1 = currentAttendingPlayers[i];
          const p2 = currentAttendingPlayers[j];
          
          const matchesTogether = allMatchesWithScores.filter(m => 
            stats.some(s => s.matchId === m.id && s.playerId === p1.id && s.attendance === 'attending') &&
            stats.some(s => s.matchId === m.id && s.playerId === p2.id && s.attendance === 'attending')
          );
          
          if (matchesTogether.length >= 3) {
            const winsTogether = matchesTogether.filter(m => (m.scoreTeam || 0) > (m.scoreOpponent || 0)).length;
            if (winsTogether / matchesTogether.length >= 0.70) {
              synergiesFound++;
              if (synergiesFound === 1) topSynergyName = `${p1.firstName} & ${p2.firstName}`;
            }
          }
        }
      }

      // To avoid double counting A-B and B-A we divide by 2
      synergiesFound = Math.floor(synergiesFound / 2);

      if (synergiesFound > 0) {
        reasons.push(`Química letal: ${synergiesFound} dúo(s) ganador(es) en campo (ej. ${topSynergyName})`);
        tacticalModifierGF *= (1 + (0.05 * synergiesFound));
        tacticalModifierGC *= (1 - (0.05 * synergiesFound));
      }

      // --- 4.4 Forma Individual Reciente (Jugadores en Racha) ---
      const attendingInForm = currentAttendingPlayers.filter(p => inFormPlayers.has(p.id));
      if (attendingInForm.length >= 2) {
        reasons.push(`${attendingInForm.length} jugadores en excelente racha individual reciente`);
        tacticalModifierGF *= (1 + (0.08 * attendingInForm.length));
      } else if (attendingInForm.length === 1) {
        reasons.push(`${attendingInForm[0].firstName} llega en racha goleadora/asistente`);
        tacticalModifierGF *= 1.08;
      }

      let predGF = (globalAvgGF + momentumGF) / 2;
      let predGC = (globalAvgGC + momentumGC) / 2;
      let confidence: 'Alta' | 'Media' | 'Baja' = 'Baja';

      if (vsOppMatches.length > 0) {
        reasons.push(`Basado en ${vsOppMatches.length} enfrentamiento(s) previo(s)`);
        let totalAdjustedGF = 0;
        let totalAdjustedGC = 0;
        let totalWeight = 0;

        vsOppMatches.forEach(prevMatch => {
          const prevSquadStats = stats.filter(s => s.matchId === prevMatch.id && s.attendance === 'attending');
          const prevSquadSize = prevSquadStats.length;
          
          const prevAvgBaremo = prevSquadSize > 0 
            ? prevSquadStats.reduce((acc, s) => {
                const pRating = allPlayerRatings.find(p => p.id === s.playerId)?.rating || teamAvgBaremo;
                return acc + pRating;
              }, 0) / prevSquadSize
            : teamAvgBaremo;

          const attendanceEffect = (prevSquadSize < 9 && currentSquadSize >= 9) ? 1.25 : 1.0;
          const qualityRatio = currentAvgBaremo / (prevAvgBaremo || teamAvgBaremo);
          
          const matchAgeDays = (new Date().getTime() - new Date(prevMatch.date).getTime()) / (1000 * 60 * 60 * 24);
          const recencyWeight = Math.max(0.1, 1 - (matchAgeDays / 730)); // 2 años de ventana

          totalAdjustedGF += (prevMatch.scoreTeam || 0) * qualityRatio * attendanceEffect * recencyWeight;
          totalAdjustedGC += (prevMatch.scoreOpponent || 0) * (1/qualityRatio) * (1/attendanceEffect) * recencyWeight;
          totalWeight += recencyWeight;
        });

        predGF = totalAdjustedGF / (totalWeight || 1);
        predGC = totalAdjustedGC / (totalWeight || 1);
        confidence = vsOppMatches.length >= 3 ? 'Alta' : 'Media';
      } else {
        reasons.push('Sin historial previo directo; analizando racha y nivel general');
        const squadRatio = currentAvgBaremo / (teamAvgBaremo || 1);
        predGF = globalAvgGF * squadRatio * ((momentumModifierGF + 1) / 2);
        predGC = globalAvgGC * (1/squadRatio) * ((momentumModifierGC + 1) / 2);
      }

      // --- 4.1 Edad Media y Equilibrio ---
      if (currentSquadSize > 0) {
        const ages = currentAttendingPlayers.map(p => calculateAge(p.birthDate));
        const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;
        
        let ageModifier = 1.0;
        if (avgAge < 22) {
          ageModifier = 0.9;
          reasons.push(`Plantilla muy joven (${avgAge.toFixed(1)} años): Vigor pero falta de experiencia`);
        } else if (avgAge >= 22 && avgAge < 26) {
          ageModifier = 1.05;
          reasons.push(`Media de edad ideal (${avgAge.toFixed(1)} años): Gran capacidad física`);
        } else if (avgAge >= 26 && avgAge < 32) {
          ageModifier = 1.1;
          reasons.push(`Punto de madurez deportivo (${avgAge.toFixed(1)} años)`);
        } else {
          ageModifier = 0.95;
          reasons.push(`Alta veteranía (${avgAge.toFixed(1)} años): Control pero riesgo físico`);
        }

        const youngCount = ages.filter(a => a < 25).length;
        const veteranCount = ages.filter(a => a >= 30).length;
        if (youngCount >= 3 && veteranCount >= 3) {
          ageModifier *= 1.05;
          reasons.push('Excelente equilibrio entre juventud y veteranía');
        }

        predGF *= ageModifier;
        predGC *= (2 - ageModifier);
      }

      // --- 5. Bajas Clave (Penalización Directa) ---
      const missingKeyPlayersCount = keyPlayerIds.filter(id => confirmedMissingIds.includes(id)).length;
      if (missingKeyPlayersCount > 0) {
        reasons.push(`Baja de ${missingKeyPlayersCount} jugador(es) clave`);
        const attackPenalty = 1 - (missingKeyPlayersCount * 0.15);
        const defensePenalty = 1 + (missingKeyPlayersCount * 0.10);
        predGF *= attackPenalty;
        predGC *= defensePenalty;
      }

      // --- 6. Horario y Condiciones ---
      const matchHour = new Date(match.date).getHours();
      const sameHourMatches = allMatchesWithScores.filter(m => new Date(m.date).getHours() === matchHour);
      if (sameHourMatches.length >= 3) {
        const hourAvgGF = sameHourMatches.reduce((acc, m) => acc + (m.scoreTeam || 0), 0) / sameHourMatches.length;
        const hourAvgGC = sameHourMatches.reduce((acc, m) => acc + (m.scoreOpponent || 0), 0) / sameHourMatches.length;
        const hourModifierGF = hourAvgGF / (globalAvgGF || 1);
        if (hourModifierGF > 1.1) reasons.push('Historial positivo en esta franja horaria');
        else if (hourModifierGF < 0.9) reasons.push('Historial complicado en este horario');
        predGF *= (1 + (hourModifierGF - 1) * 0.3);
        predGC *= (1 + ((hourAvgGC / (globalAvgGC || 1)) - 1) * 0.3);
      }

      // --- 7. Efecto Banquillo / Fatiga de Calendario ---
      if (currentSquadSize > 10) {
        reasons.push(`Amplia rotación disponible (${currentSquadSize} jugadores)`);
        predGF *= 1.10;
        predGC *= 0.90;
      } else if (currentSquadSize > 0 && currentSquadSize < 8) {
        reasons.push(`Convocatoria escasa (${currentSquadSize} jugadores): Riesgo de fatiga`);
        predGF *= 0.75;
        predGC *= 1.30;
      }

      const matchDate = new Date(match.date);
      const lastMatch = allMatchesWithScores.find(m => new Date(m.date).getTime() < matchDate.getTime());
      if (lastMatch) {
         const daysSinceLastMatch = (matchDate.getTime() - new Date(lastMatch.date).getTime()) / (1000 * 60 * 60 * 24);
         if (daysSinceLastMatch <= 4) {
             reasons.push('Aviso de fatiga: Calendario denso (partido reciente hace < 4 días)');
             predGC *= 1.15; 
             predGF *= 0.90; 
         } else if (daysSinceLastMatch >= 10) {
             reasons.push('Equipo totalmente descansado (> 10 días sin jugar)');
             predGF *= 1.05;
         }
      }

      // --- 8. Factor Clasificación y Goles ---
      const myStats = getStandingsStats(match.seasonId, 'my-team');
      const oppStats = getStandingsStats(match.seasonId, match.opponentId);
      
      const ptsDiff = myStats.points - oppStats.points;
      if (ptsDiff > 10) reasons.push('Superioridad clara en la tabla de clasificación');
      else if (ptsDiff < -10) reasons.push('Rival en posición superior en la tabla');
      
      // Ajuste basado en la media de goles de la temporada (Global)
      const myAvgGF = myStats.played > 0 ? myStats.goalsFor / myStats.played : globalAvgGF;
      const myAvgGC = myStats.played > 0 ? myStats.goalsAgainst / myStats.played : globalAvgGC;
      const oppAvgGF = oppStats.played > 0 ? oppStats.goalsFor / oppStats.played : globalAvgGC;
      const oppAvgGC = oppStats.played > 0 ? oppStats.goalsAgainst / oppStats.played : globalAvgGF;

      // El factor clasificación ajusta la tendencia
      const standingsModifier = 1 + (ptsDiff / 100); 
      const clampedModifier = Math.min(Math.max(standingsModifier, 0.7), 1.3);
      
      // Combinamos: (Historial + Momentum + Calidad Plantilla) con (Medias Temporada Global)
      // Damos un peso del 30% a las medias globales de la liga
      predGF = (predGF * 0.7) + (((myAvgGF + oppAvgGC) / 2) * 0.3);
      predGC = (predGC * 0.7) + (((oppAvgGF + myAvgGC) / 2) * 0.3);

      predGF *= (clampedModifier * (tacticalModifierGF || 1));
      predGC *= ((2 - clampedModifier) * (tacticalModifierGC || 1));

      // --- 9. Clean Sheets Recent (Defensa) ---
      if (recentCleanSheets >= 2) {
        reasons.push(`Gran racha defensiva (${recentCleanSheets} porterías a cero recientemente)`);
        predGC *= 0.85;
      }

      // --- 9.5 AI Learning Correction ---
      // Aplicamos el bias calculado al inicio del memo
      if (Math.abs(biasGF) > 0.1 || Math.abs(biasGC) > 0.1) {
        predGF = Math.max(0.1, predGF + biasGF);
        predGC = Math.max(0.1, predGC + biasGC);
        reasons.push('Módulo de Aprendizaje: Ajuste aplicado por calibración histórica');
      }

      // --- 10. Aplicar Poisson para el Resultado Final y Probabilidades ---
      const mostProbableScore = getMostProbableScore(predGF, predGC);
      
      let winProb = 0;
      let drawProb = 0;
      let lossProb = 0;

      for (let i = 0; i <= 8; i++) {
        for (let j = 0; j <= 8; j++) {
          const prob = poisson(predGF, i) * poisson(predGC, j);
          if (i > j) winProb += prob;
          else if (i === j) drawProb += prob;
          else lossProb += prob;
        }
      }
      
      // Calculate Recommended Squad (Top 10 players for this opponent)
      const eligiblePlayers = players.filter(p => {
        const isAtSeason = playerSeasons.some(ps => ps.playerId === p.id && ps.seasonId === match.seasonId);
        const isInjured = injuries.some(i => i.playerId === p.id && !i.endDate);
        return isAtSeason && !isInjured && p.isActive !== false;
      });

      const scoredPlayers = eligiblePlayers.map(p => {
        // Use pre-calculated rating and breakdown
        const ratingData = allPlayerRatings.find(pr => pr.id === p.id);
        let compScore = ratingData?.rating || 0;
        
        // Goals bonus
        const pStats = stats.filter(s => s.playerId === p.id && s.attendance === 'attending');
        const totalGoals = pStats.reduce((acc, s) => acc + (s.goals || 0), 0);
        compScore += totalGoals * 5;

        // Regularity bonus (Attendance rate)
        if (ratingData?.breakdown) {
          const rate = ratingData.breakdown.partidosComputables > 0 
            ? (ratingData.breakdown.partidosAsistidos / ratingData.breakdown.partidosComputables) 
            : 0;
          compScore += rate * 50;
        }
        
        if (inFormPlayers.has(p.id)) compScore += 10;
        
        const pVsOppMatches = vsOppMatches.filter(m => 
          stats.some(s => s.matchId === m.id && s.playerId === p.id && s.attendance === 'attending')
        );
        if (pVsOppMatches.length > 0) {
          const pVsOppWins = pVsOppMatches.filter(m => (m.scoreTeam || 0) > (m.scoreOpponent || 0)).length;
          compScore += (pVsOppWins / pVsOppMatches.length) * 15;
        }
        
        return { player: p, compScore, position: p.position };
      }).sort((a, b) => b.compScore - a.compScore);

      let recommendedSquad: Player[] = [];
      const distribution = {
        'Portero': 1,
        'Defensa': 3,
        'Medio': 4,
        'Delantero': 2
      };

      const selectedIds = new Set<string>();

      // First pass: Select top players for each position according to distribution
      Object.entries(distribution).forEach(([pos, count]) => {
        const topInPos = scoredPlayers
          .filter(sp => sp.position === pos)
          .slice(0, count);
        
        topInPos.forEach(sp => {
          recommendedSquad.push(sp.player);
          selectedIds.add(sp.player.id);
        });
      });

      // Second pass: If squad < 10, fill with remaining best players regardless of position
      if (recommendedSquad.length < 10) {
        const remaining = scoredPlayers
          .filter(sp => !selectedIds.has(sp.player.id))
          .slice(0, 10 - recommendedSquad.length);
        
        remaining.forEach(sp => {
          recommendedSquad.push(sp.player);
          selectedIds.add(sp.player.id);
        });
      }

      // Sort final squad by position priority for better UI display
      const posOrder: Record<string, number> = { 'Portero': 1, 'Defensa': 2, 'Medio': 3, 'Delantero': 4 };
      recommendedSquad.sort((a, b) => (posOrder[a.position] || 99) - (posOrder[b.position] || 99));

      if (recommendedSquad.length === 0 && scoredPlayers.length > 0) {
        recommendedSquad = scoredPlayers.slice(0, 10).map(sp => sp.player);
      }

      // Calculate Ideal Win Rate with Recommended Squad
      const recSquadRatings = allPlayerRatings
        .filter(pr => recommendedSquad.some(rsp => rsp.id === pr.id))
        .map(pr => pr.rating);
      const recSquadAvgBaremo = recSquadRatings.length > 0
        ? recSquadRatings.reduce((a, b) => a + b, 0) / recSquadRatings.length
        : teamAvgBaremo;

      const idealGF = predGF * (recSquadAvgBaremo / (currentAvgBaremo || 1));
      const idealGC = predGC * (currentAvgBaremo / (recSquadAvgBaremo || 1));

      let idealWinProb = 0;
      let idealDrawProb = 0;
      let idealLossProb = 0;

      for (let i = 0; i <= 8; i++) {
        for (let j = 0; j <= 8; j++) {
          const prob = poisson(idealGF, i) * poisson(idealGC, j);
          if (i > j) idealWinProb += prob;
          else if (i === j) idealDrawProb += prob;
          else idealLossProb += prob;
        }
      }

      predictionMap.set(match.id, {
        team: mostProbableScore.team,
        opponent: mostProbableScore.opponent,
        confidence,
        reasons,
        probabilities: { 
          win: Math.round(winProb * 100), 
          draw: Math.round(drawProb * 100), 
          loss: Math.round(lossProb * 100) 
        },
        recommendedSquad,
        recommendedProbabilities: {
          win: Math.round(idealWinProb * 100),
          draw: Math.round(idealDrawProb * 100),
          loss: Math.round(idealLossProb * 100)
        }
      });
    });
    
    return predictionMap;
  }, [matches, stats, allPlayerRatings, scheduledMatches, standings]);



  const squadAnalysis = React.useMemo(() => {
    const teamAvgBaremo = allPlayerRatings.reduce((a, b) => a + b.rating, 0) / (allPlayerRatings.length || 1);
    const allMatchesWithScores = matches
      .filter(m => m.scoreTeam != null && m.scoreOpponent != null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const result = new Map<string, {
      score: number,
      grade: string,
      reasons: { type: 'positive' | 'negative' | 'neutral', text: string }[],
      attendingCount: number,
      playerContributions: { player: Player, rating: number, tags: string[] }[],
      improvements: { player: Player, scoreIncrease: number, reasons: { type: 'positive' | 'negative' | 'neutral', text: string }[] }[]
    }>();

    const attendingCountMap = new Map<string, number>();
    stats.forEach(s => {
      if (s.attendance === 'attending') {
        attendingCountMap.set(s.matchId, (attendingCountMap.get(s.matchId) || 0) + 1);
      }
    });

    const matchesToAnalyze = [...filteredMatches]
      .filter(m => (attendingCountMap.get(m.id) || 0) >= 5)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, analyzedLimit);

    const evaluateSquad = (squadPlayers: Player[], matchContext: Match | null = null, baseEvalMode: boolean = false) => {
      const matchDate = matchContext ? new Date(matchContext.date) : new Date();
      // Baremo histórico hasta antes del partido
      const historicalMatches = matchContext ? matches.filter(m => new Date(m.date) < matchDate) : matches;

      const squadSize = squadPlayers.length;
      let totalScore = 50;
      const reasons: { type: 'positive' | 'negative' | 'neutral', text: string }[] = [];

      if (squadSize === 0) return { score: 0, grade: 'F', reasons };

      const ratings = squadPlayers.map(p => {
        if (matchContext) {
           const breakdown = calculatePlayerRating(historicalMatches, injuries, stats, p, globalSeasonId, seasons);
           return breakdown.notaFinal || 0;
        } else {
           const ratingData = allPlayerRatings.find(r => r.id === p.id);
           return ratingData?.rating || 0;
        }
      });
      const currentAvgBaremo = ratings.reduce((a, b) => a + b, 0) / squadSize;
      
      const squadRatio = currentAvgBaremo / (teamAvgBaremo || 1);
      const diff = (squadRatio - 1) * 100;
      totalScore += diff * 1.5;

      if (diff > 5) reasons.push({ type: 'positive', text: `Nivel técnico superior (+${diff.toFixed(0)}% de la media)` });
      else if (diff < -5) reasons.push({ type: 'negative', text: `Nivel técnico inferior (${diff.toFixed(0)}%)` });

      const hasGoalkeeper = squadPlayers.some(p => p.position === 'Portero');
      const defendersCount = squadPlayers.filter(p => p.position === 'Defensa').length;
      const attackersCount = squadPlayers.filter(p => p.position === 'Delantero').length;

      if (!hasGoalkeeper) {
        totalScore -= 15;
        reasons.push({ type: 'negative', text: 'Sin portero especialista' });
      } else {
        totalScore += 5;
        reasons.push({ type: 'positive', text: 'Portería cubierta' });
      }

      if (defendersCount < 2 && squadSize >= 7) {
        totalScore -= 10;
        reasons.push({ type: 'negative', text: 'Pocos defensas en la convocatoria' });
      } else if (defendersCount >= 3) {
        totalScore += 5;
        reasons.push({ type: 'positive', text: 'Sólida base defensiva' });
      }

      if (attackersCount >= 3) {
        totalScore += 5;
        reasons.push({ type: 'positive', text: 'Alta presencia ofensiva' });
      }

      const calculateAge = (birthDate: string) => {
        if (!birthDate) return 25;
        const birth = new Date(birthDate);
        let age = matchDate.getFullYear() - birth.getFullYear();
        if (matchDate.getMonth() < birth.getMonth() || (matchDate.getMonth() === birth.getMonth() && matchDate.getDate() < birth.getDate())) {
          age--;
        }
        return age;
      };

      const ages = squadPlayers.map(p => calculateAge(p.birthDate!));
      const avgAge = ages.reduce((a, b) => a + b, 0) / (ages.length || 1);
      
      if (avgAge < 22) {
        totalScore -= 2;
        reasons.push({ type: 'neutral', text: `Plantilla muy joven (${avgAge.toFixed(1)} años)` });
      } else if (avgAge >= 22 && avgAge < 26) {
        totalScore += 5;
        reasons.push({ type: 'positive', text: `Media de edad ideal (${avgAge.toFixed(1)} años)` });
      } else if (avgAge >= 26 && avgAge < 32) {
        totalScore += 8;
        reasons.push({ type: 'positive', text: `Punto de madurez deportivo (${avgAge.toFixed(1)} años)` });
      } else {
        totalScore -= 5;
        reasons.push({ type: 'negative', text: `Alta veteranía media (${avgAge.toFixed(1)} años)` });
      }

      const youngCount = ages.filter(a => a < 25).length;
      const veteranCount = ages.filter(a => a >= 30).length;
      if (youngCount >= 2 && veteranCount >= 2) {
        totalScore += 5;
        reasons.push({ type: 'positive', text: 'Equilibrio juventud/veteranía' });
      }

      let synergiesFound = 0;
      for (let i = 0; i < squadPlayers.length; i++) {
        for (let j = i + 1; j < squadPlayers.length; j++) {
          const p1 = squadPlayers[i];
          const p2 = squadPlayers[j];
          const matchesTogether = historicalMatches.filter(m => 
            stats.some(s => s.matchId === m.id && s.playerId === p1.id && s.attendance === 'attending') &&
            stats.some(s => s.matchId === m.id && s.playerId === p2.id && s.attendance === 'attending')
          );
          if (matchesTogether.length >= 3) {
            const winsTogether = matchesTogether.filter(m => (m.scoreTeam || 0) > (m.scoreOpponent || 0)).length;
            if (winsTogether / matchesTogether.length >= 0.70) synergiesFound++;
          }
        }
      }
      if (synergiesFound > 0) {
        totalScore += synergiesFound * 3;
        reasons.push({ type: 'positive', text: `Química letal: ${synergiesFound} dúos probados históricamente` });
      }

      if (squadSize >= 14) {
        totalScore -= 15;
        reasons.push({ type: 'negative', text: `Exceso de convocatoria (${squadSize} jug.), difícil dar minutos` });
      } else if (squadSize >= 11 && squadSize <= 13) {
        totalScore += 10;
        reasons.push({ type: 'positive', text: `Convocatoria ideal (${squadSize} jug.), rotaciones completas` });
      } else if (squadSize === 10) {
        reasons.push({ type: 'neutral', text: `Convocatoria buena (10 jug.), rotaciones suficientes` });
      } else if (squadSize === 9) {
        totalScore -= 15;
        reasons.push({ type: 'negative', text: `Buena profundidad (9 jug., 2 cambios)` });
      } else if (squadSize === 8) {
        totalScore -= 25;
        reasons.push({ type: 'negative', text: `Profundidad justa (8 jug., 1 cambio)` });
      } else if (squadSize === 7) {
        if (avgAge >= 30) {
           totalScore -= (15 + 10);
           reasons.push({ type: 'negative', text: `Al límite (7 jug.) y muy veteranos (${avgAge.toFixed(1)} años), fatiga crítica` });
        } else if (avgAge <= 24) {
           totalScore -= (15 - 5);
           reasons.push({ type: 'negative', text: `Al límite (7 jug.), amortiguado por ser plantilla jóven (${avgAge.toFixed(1)} años)` });
        } else {
           totalScore -= 15;
           reasons.push({ type: 'negative', text: `Plantilla al límite (7 jug., sin cambios), alto riesgo físico` });
        }
      } else if (squadSize < 7) {
        if (avgAge >= 30) {
           totalScore -= (35 + 15);
           reasons.push({ type: 'negative', text: `Inferioridad (${squadSize} jug.) agravada fuertemente por veteranía (${avgAge.toFixed(1)} años)` });
        } else if (avgAge <= 24) {
           totalScore -= (35 - 5);
           reasons.push({ type: 'negative', text: `Inferioridad (${squadSize} jug.) mitigada levemente por juventud` });
        } else {
           totalScore -= 35;
           reasons.push({ type: 'negative', text: `Plantilla en inferioridad manifiesta (${squadSize} jug.)` });
        }
      }

      totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

      let grade = 'C';
      if (totalScore >= 85) grade = 'S';
      else if (totalScore >= 75) grade = 'A';
      else if (totalScore >= 60) grade = 'B';
      else if (totalScore >= 45) grade = 'C';
      else grade = 'D';

      return { score: totalScore, grade, reasons };
    };

    matchesToAnalyze.forEach(match => {
      const matchStats = stats.filter(s => s.matchId === match.id);
      const attendingIds = matchStats.filter(s => s.attendance === 'attending').map(s => s.playerId);
      const currentAttendingPlayers = players.filter(p => attendingIds.includes(p.id));
      const currentSquadSize = currentAttendingPlayers.length;

      if (currentSquadSize < 5) return;

      const baseEval = evaluateSquad(currentAttendingPlayers, match, true);

      // Usar baremo histórico para las contribuciones
      const matchDate = new Date(match.date);
      const historicalMatches = matches.filter(m => new Date(m.date) < matchDate);

      const playerContributions = currentAttendingPlayers.map(p => {
        const ratingData = calculatePlayerRating(historicalMatches, injuries, stats, p, globalSeasonId, seasons);
        const pRating = ratingData.notaFinal || 0;
        const tags: string[] = [p.position];

        if (p.position === 'Portero') tags.push('Solidez en portería');
        else if (pRating > teamAvgBaremo + 2) tags.push('Estrella técnica');
        else if (pRating > teamAvgBaremo) tags.push('Aporta calidad media');
        
        return { player: p, rating: pRating, tags };
      }).sort((a, b) => b.rating - a.rating);

      const eligiblePlayers = players.filter(p => 
        p.isActive !== false &&
        playerSeasons.some(ps => ps.seasonId === match.seasonId && ps.playerId === p.id) &&
        !injuries.some(i => i.playerId === p.id && !i.endDate)
      );

      const missingPlayers = eligiblePlayers.filter(p => !attendingIds.includes(p.id));
      
      const improvements = missingPlayers.map(p => {
        const simEval = evaluateSquad([...currentAttendingPlayers, p], match);
        const newReasons = simEval.reasons.filter(r => !baseEval.reasons.some(br => br.text === r.text));
        
        if (simEval.score > baseEval.score && newReasons.length === 0) {
            newReasons.push({ type: 'positive', text: `Eleva la media táctica o técnica` });
        }

        return {
           player: p,
           scoreIncrease: simEval.score - baseEval.score,
           reasons: newReasons
        };
      }).filter(s => s.scoreIncrease > 0)
        .sort((a, b) => b.scoreIncrease - a.scoreIncrease)
        .slice(0, 3);

      result.set(match.id, {
        score: baseEval.score,
        grade: baseEval.grade,
        reasons: baseEval.reasons,
        attendingCount: currentSquadSize,
        playerContributions,
        improvements
      });
    });

    return result;
  }, [filteredMatches, allPlayerRatings, stats, players, matches, playerSeasons, injuries, globalSeasonId, analyzedLimit]);

  const [selectedSquadMatchId, setSelectedSquadMatchId] = React.useState<string | null>(null);



  const renderSquadsTab = () => {
    const analyzedMatches = filteredMatches
      .filter(m => squadAnalysis.has(m.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const hasMoreToAnalyze = filteredMatches.filter(m => {
      const attendingCount = stats.filter(s => s.matchId === m.id && s.attendance === 'attending').length;
      return attendingCount >= 5;
    }).length > analyzedLimit;

    const gradeColors = {
      'S': 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
      'S_DARK': 'bg-fuchsia-600 text-white border-fuchsia-700',
      'A': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'A_DARK': 'bg-emerald-600 text-white border-emerald-700',
      'B': 'bg-blue-100 text-blue-700 border-blue-200',
      'B_DARK': 'bg-blue-600 text-white border-blue-700',
      'C': 'bg-amber-100 text-amber-700 border-amber-200',
      'C_DARK': 'bg-amber-500 text-white border-amber-600',
      'D': 'bg-red-100 text-red-700 border-red-200',
      'D_DARK': 'bg-red-600 text-white border-red-700'
    };

    return (
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="text-emerald-600" size={20} />
                Historial de Convocatorias
              </CardTitle>
              <CardDescription>Análisis del nivel de la plantilla reunida por partido.</CardDescription>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={() => setSquadViewMode('table')}
                 className={cn(
                   "h-8 px-3 rounded-lg text-xs font-bold transition-all",
                   squadViewMode === 'table' ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
                 )}
               >
                 Tabla
               </Button>
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={() => setSquadViewMode('cards')}
                 className={cn(
                   "h-8 px-3 rounded-lg text-xs font-bold transition-all",
                   squadViewMode === 'cards' ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
                 )}
               >
                 Tarjetas
               </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {squadViewMode === 'table' ? (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <th className="px-4 py-2">Jornada</th>
                    <th className="px-4 py-2">Rival</th>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2 text-center">Jugadores</th>
                    <th className="px-4 py-2 text-center">Grado</th>
                    <th className="px-4 py-2 text-center">Puntuación</th>
                    <th className="px-4 py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {analyzedMatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400 italic text-sm bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                        No hay convocatorias analizadas con suficientes datos.
                      </td>
                    </tr>
                  ) : (
                    analyzedMatches.map(match => {
                      const analysis = squadAnalysis.get(match.id);
                      if (!analysis) return null;
                      const opponent = opponents.find(o => o.id === match.opponentId);

                      return (
                        <tr 
                          key={match.id} 
                          className="group hover:bg-gray-50 transition-colors bg-white border border-gray-100 rounded-2xl cursor-pointer"
                          onClick={() => setSelectedSquadMatchId(match.id)}
                        >
                          <td className="px-4 py-3 rounded-l-2xl border-y border-l border-gray-100">
                            <span className="text-xs font-black text-emerald-600 uppercase">
                              J{match.round || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 border-y border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                                {opponent?.shieldUrl ? (
                                  <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                                ) : (
                                  <Shield size={16} className="text-gray-300" />
                                )}
                              </div>
                              <span className="font-bold text-gray-900 truncate max-w-[150px] block">
                                {opponent?.name || 'Rival'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 border-y border-gray-100">
                            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                              {format(new Date(match.date), 'dd MMM yyyy', { locale: es })}
                            </span>
                          </td>
                          <td className="px-4 py-3 border-y border-gray-100 text-center">
                            <span className="text-xs font-black text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                              {analysis.attendingCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 border-y border-gray-100 text-center">
                            <div className={cn(
                              "inline-flex px-2 py-0.5 text-xs font-black rounded-lg border",
                              gradeColors[analysis.grade as keyof typeof gradeColors]
                            )}>
                               {analysis.grade}
                            </div>
                          </td>
                          <td className="px-4 py-3 border-y border-gray-100 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={cn(
                                "text-xs font-bold",
                                analysis.score >= 75 ? "text-emerald-600" : analysis.score >= 50 ? "text-amber-500" : "text-red-500"
                              )}>
                                {analysis.score}
                              </span>
                              <div className="w-12 bg-gray-100 h-1 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full transition-all",
                                    analysis.score >= 75 ? "bg-emerald-500" : analysis.score >= 50 ? "bg-amber-500" : "bg-red-500"
                                  )} 
                                  style={{ width: `${analysis.score}%` }} 
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 rounded-r-2xl border-y border-r border-gray-100 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {onNavigateToMatch && (
                                <Tooltip>
                                  <TooltipTrigger render={<div />}>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="h-8 w-8 p-0 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 focus:outline-none"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigateToMatch(match.id);
                                      }}
                                    >
                                      <ExternalLink size={16} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-[#141414] text-white text-[10px] py-1 px-2 rounded-lg border-none">
                                    Ir a detalles del partido
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 focus:outline-none pointer-events-none"
                              >
                                <Info size={16} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {analyzedMatches.length === 0 ? (
                  <p className="col-span-full text-center py-12 text-gray-400 italic text-sm">No hay convocatorias analizadas.</p>
               ) : (
                 analyzedMatches.map(match => {
                    const analysis = squadAnalysis.get(match.id);
                    if (!analysis) return null;
                    const opponent = opponents.find(o => o.id === match.opponentId);

                    return (
                      <div 
                        key={match.id} 
                        className="flex flex-col p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer relative group"
                        onClick={() => setSelectedSquadMatchId(match.id)}
                      >
                         <div className="absolute top-3 right-3 flex items-center gap-2">
                           {onNavigateToMatch && (
                             <Tooltip>
                               <TooltipTrigger render={<div />}>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-7 w-7 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 focus:outline-none"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     onNavigateToMatch(match.id);
                                   }}
                                 >
                                   <ExternalLink size={14} />
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent className="bg-[#141414] text-white text-[10px] py-1 px-2 rounded-lg border-none" side="left">
                                 Ir a detalles del partido
                               </TooltipContent>
                             </Tooltip>
                           )}
                           <Badge className="bg-gray-50 text-gray-400 border-gray-100 text-[9px] font-black h-5 uppercase px-1.5 focus:outline-none pointer-events-none">
                             J{match.round}
                           </Badge>
                           <div className={cn(
                             "w-7 h-7 flex items-center justify-center font-black rounded-lg border text-sm shadow-sm",
                             gradeColors[`${analysis.grade}_DARK` as keyof typeof gradeColors]
                           )}>
                             {analysis.grade}
                           </div>
                         </div>

                         <div className="flex items-center gap-3 mb-4">
                           <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                             {opponent?.shieldUrl ? (
                               <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                             ) : (
                               <Shield size={24} className="text-gray-300" />
                             )}
                           </div>
                           <div className="min-w-0 flex-1">
                             <p className="font-bold text-gray-900 truncate pr-16">{opponent?.name || 'Rival'}</p>
                             <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                               <Calendar size={10} /> {format(new Date(match.date), 'dd MMM yyyy', { locale: es })}
                             </p>
                           </div>
                         </div>

                         <div className="mt-auto space-y-3">
                            <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-wider">
                               <span className="text-gray-400 flex items-center gap-1"><Users size={12}/>{analysis.attendingCount} Jug.</span>
                               <span className={cn(
                                 analysis.score >= 75 ? "text-emerald-600" : analysis.score >= 50 ? "text-amber-500" : "text-red-500"
                               )}>Score {analysis.score}/100</span>
                            </div>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                               <div 
                                 className={cn(
                                   "h-full transition-all",
                                   analysis.score >= 75 ? "bg-emerald-500" : analysis.score >= 50 ? "bg-amber-500" : "bg-red-500"
                                 )} 
                                 style={{ width: `${analysis.score}%` }} 
                               />
                            </div>
                            <div className="flex flex-wrap gap-1">
                               {analysis.reasons.slice(0, 2).map((r, i) => (
                                 <Badge key={i} variant="outline" className={cn(
                                   "text-[8px] h-4 px-1 border-none",
                                   r.type === 'positive' ? "bg-emerald-50 text-emerald-600" :
                                   r.type === 'negative' ? "bg-red-50 text-red-600" :
                                   "bg-amber-50 text-amber-600"
                                 )}>
                                   {r.text.length > 20 ? r.text.slice(0, 20) + '...' : r.text}
                                 </Badge>
                               ))}
                            </div>
                         </div>
                      </div>
                    );
                 })
               )}
            </div>
          )}

          {hasMoreToAnalyze && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                Mostrando {analyzedMatches.length} de {filteredMatches.filter(m => {
                  const attendingCount = stats.filter(s => s.matchId === m.id && s.attendance === 'attending').length;
                  return attendingCount >= 5;
                }).length} partidos
              </p>
              <Button 
                variant="outline" 
                onClick={() => setAnalyzedLimit(prev => prev + 5)}
                className="rounded-xl border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all font-bold gap-2 px-6 h-11"
              >
                <Plus size={16} />
                Cargar 5 jornadas anteriores
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <TooltipProvider>
    <div className="space-y-4">
      <div className="flex bg-white rounded-xl shadow-sm p-1 border border-[#141414]/10 w-fit">
        <Tooltip>
          <TooltipTrigger render={<div />}>
            <Button 
              variant={activeAITab === 'predictions' ? 'default' : 'ghost'} 
              onClick={() => setActiveAITab('predictions')}
              className={cn(
                 "rounded-lg px-4 h-9 font-medium text-sm transition-all",
                 activeAITab === 'predictions' ? 'bg-[#141414] text-white shadow-sm hover:bg-[#141414]/90' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              Predicciones de Partido
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs p-3 bg-[#141414] text-white border-none rounded-xl shadow-xl">
            <p className="text-xs leading-relaxed">
              La IA analiza la racha del equipo, el historial contra el rival, jugadores clave convocados y factores externos para estimar el resultado más probable.
            </p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<div />}>
            <Button 
              variant={activeAITab === 'squads' ? 'default' : 'ghost'} 
              onClick={() => setActiveAITab('squads')}
              className={cn(
                 "rounded-lg px-4 h-9 font-medium text-sm transition-all flex items-center gap-2",
                 activeAITab === 'squads' ? 'bg-[#141414] text-white shadow-sm hover:bg-[#141414]/90' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              <ClipboardCheck size={16} />
              Estudio de Convocatorias
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs p-3 bg-[#141414] text-white border-none rounded-xl shadow-xl">
            <p className="text-xs leading-relaxed">
              Analiza el equilibrio táctico de la plantilla (posiciones, veteranía, química histórica) y su nivel técnico medio frente a la media del club.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {activeAITab === 'squads' ? renderSquadsTab() : (
      <Card className="border-none shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="text-emerald-600" size={20} />
            Próximos Partidos
          </CardTitle>
          <CardDescription>Partidos programados próximamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scheduledMatches.length === 0 ? (
              <p className="col-span-full text-center py-8 text-gray-400 italic text-sm">No hay partidos programados.</p>
            ) : (
              scheduledMatches.slice(0, 6).map(match => {
                const opponent = opponents.find(o => o.id === match.opponentId);
                const season = seasons.find(s => s.id === match.seasonId);
                const pred = predictions.get(match.id);
                
                return (
                  <div key={match.id} className="flex flex-col p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all relative group/card">
                    <div className="absolute -top-2 -right-2 z-10 flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        {onNavigateToMatch && (
                          <Tooltip>
                            <TooltipTrigger render={<div />}>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-6 w-6 rounded-full bg-white shadow-md border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 transition-colors focus:outline-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigateToMatch(match.id);
                                }}
                              >
                                <ExternalLink size={10} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#141414] text-white text-[10px] py-1 px-2 rounded-lg border-none" side="left">
                              Ir a detalles del partido
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {pred && (
                          <div className="bg-emerald-600 text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-lg uppercase tracking-wider flex items-center gap-1 border border-emerald-500">
                            <Database size={10} /> Predicción IA
                          </div>
                        )}
                      </div>
                      <div className={cn(
                        "text-[9px] font-black px-2 py-1 rounded-lg shadow-md uppercase tracking-wider flex items-center gap-1 border",
                        match.isHome ? "bg-blue-600 text-white border-blue-500" : "bg-orange-500 text-white border-orange-400"
                      )}>
                        {match.isHome ? <Home size={10} /> : <Navigation size={10} />}
                        {match.isHome ? 'Local' : 'Visitante'}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-xl shadow-inner flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                        {opponent?.shieldUrl ? (
                          <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                        ) : (
                          <Shield size={32} className="text-gray-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-base text-gray-900 truncate leading-tight">{opponent?.name || 'Rival desconocido'}</p>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase mt-1 truncate">
                          {season?.name || 'Sin temporada'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                            <Calendar size={12} />
                            <span className="text-[9px] font-bold uppercase">Cuándo</span>
                          </div>
                          <p className="text-[11px] font-bold text-gray-700">{format(new Date(match.date), "d 'de' MMM", { locale: es })}</p>
                          <p className="text-[10px] text-gray-500">{format(new Date(match.date), "HH:mm")}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                            <Target size={12} />
                            <span className="text-[9px] font-bold uppercase">Dónde</span>
                          </div>
                          <div className="truncate">
                            {match.fieldId ? (
                              (() => {
                                const field = fields.find(f => f.id === match.fieldId);
                                return field?.name ? (
                                  <span className="text-[11px] font-bold text-gray-700 truncate block">{field.name}</span>
                                ) : (
                                  <span className="text-[11px] text-gray-400">Sin campo</span>
                                );
                              })()
                            ) : (
                              <span className="text-[11px] font-bold text-gray-700 truncate block">{match.location || 'Por definir'}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {pred && (
                        <>
                          <div className={cn(
                            "p-3 rounded-2xl border transition-all space-y-3",
                            pred.team > pred.opponent ? "bg-emerald-50/40 border-emerald-100/50" :
                            pred.team < pred.opponent ? "bg-red-50/40 border-red-100/50" :
                            "bg-gray-50/40 border-gray-200/50"
                          )}>
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-wider mb-0.5",
                                  pred.team > pred.opponent ? "text-emerald-700" :
                                  pred.team < pred.opponent ? "text-red-700" :
                                  "text-gray-600"
                                )}>
                                  Resultado Probable
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm",
                                    pred.confidence === 'Alta' ? "bg-emerald-600 text-white" :
                                    pred.confidence === 'Media' ? "bg-blue-500 text-white" :
                                    "bg-gray-400 text-white"
                                  )}>
                                    {pred.confidence}
                                  </span>
                                  <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded-full border border-black/5 shadow-sm">
                                    <span className={cn(
                                      "text-sm font-black",
                                      pred.team > pred.opponent ? "text-emerald-600" :
                                      pred.team < pred.opponent ? "text-red-600" :
                                      "text-gray-700"
                                    )}>{pred.team}</span>
                                    <span className="text-gray-300 font-bold">-</span>
                                    <span className={cn(
                                      "text-sm font-black",
                                      pred.team < pred.opponent ? "text-red-600" : "text-gray-400"
                                    )}>{pred.opponent}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Victoria Escala</span>
                                <div className="flex items-center gap-1">
                                  <Trophy size={12} className={cn(pred.probabilities.win > 50 ? "text-emerald-500 animate-bounce" : "text-gray-300")} />
                                  <span className="text-xl font-black text-gray-900 leading-none">{pred.probabilities.win}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Barra de Probabilidades */}
                            <div className="space-y-1.5">
                              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden flex shadow-inner border border-white">
                                <div 
                                  className="h-full bg-emerald-500 transition-all duration-1000 relative group/prob" 
                                  style={{ width: `${pred.probabilities.win}%` }}
                                >
                                  {pred.probabilities.win > 15 && <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white truncate px-1">V</span>}
                                </div>
                                <div 
                                  className="h-full bg-gray-400 transition-all duration-1000 relative" 
                                  style={{ width: `${pred.probabilities.draw}%` }}
                                >
                                  {pred.probabilities.draw > 15 && <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white truncate px-1">E</span>}
                                </div>
                                <div 
                                  className="h-full bg-red-500 transition-all duration-1000 relative" 
                                  style={{ width: `${pred.probabilities.loss}%` }}
                                >
                                  {pred.probabilities.loss > 15 && <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white truncate px-1">D</span>}
                                </div>
                              </div>
                              <div className="flex justify-between text-[8px] font-black text-gray-400 uppercase tracking-tighter">
                                <span className="text-emerald-600">Victoria {pred.probabilities.win}%</span>
                                <span className="text-gray-500">Empate {pred.probabilities.draw}%</span>
                                <span className="text-red-500">Derrota {pred.probabilities.loss}%</span>
                              </div>
                            </div>

                            <Button 
                              variant="ghost" 
                              className="w-full mt-2 h-9 rounded-xl bg-white/50 hover:bg-white border border-black/5 flex items-center justify-between px-3 group/btn"
                              onClick={() => setRecommendedMatchId(match.id)}
                            >
                              <div className="flex items-center gap-2">
                                <Sparkles size={14} className="text-amber-500 group-hover/btn:rotate-12 transition-transform" />
                                <span className="text-[11px] font-bold text-gray-700">Mejor Equipo Posible</span>
                              </div>
                              <ChevronRight size={14} className="text-gray-400 group-hover/btn:translate-x-0.5 transition-transform" />
                            </Button>
                          </div>

                          {/* Razonamiento detallado */}
                          <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100 space-y-2">
                            <div className="flex items-center gap-2 mb-1">
                              <Lightbulb size={12} className="text-amber-500" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Puntos Clave del Análisis</span>
                            </div>
                            <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {pred.reasons.map((reason, idx) => {
                                let Icon = "🔹";
                                const lowerReason = reason.toLowerCase();
                                if (lowerReason.includes('aprendizaje') || lowerReason.includes('calibración')) Icon = "🎓";
                                else if (lowerReason.includes('racha')) Icon = "🔥";
                                else if (lowerReason.includes('química') || lowerReason.includes('dúo')) Icon = "🤝";
                                else if (lowerReason.includes('fatiga') || lowerReason.includes('calendario') || lowerReason.includes('descansado')) Icon = "⏱️";
                                else if (lowerReason.includes('edad') || lowerReason.includes('joven') || lowerReason.includes('veteranía')) Icon = "🧠";
                                else if (lowerReason.includes('portero') || lowerReason.includes('defensiva') || lowerReason.includes('defensa') || lowerReason.includes('encajar')) Icon = "🛡️";
                                else if (lowerReason.includes('delanteros') || lowerReason.includes('ofensiva') || lowerReason.includes('goleadora')) Icon = "⚔️";
                                else if (lowerReason.includes('clasificación') || lowerReason.includes('tabla')) Icon = "📊";
                                else if (lowerReason.includes('baja') && !lowerReason.includes('Media') && !lowerReason.includes('Alta')) Icon = "🏥";

                                return (
                                  <li key={idx} className="flex items-start gap-1.5 text-[10px] leading-tight text-gray-600">
                                    <span className="shrink-0 text-[10px] mt-px">{Icon}</span>
                                    <span className="font-medium">{reason}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Modal de Equipo Recomendado */}
      <Dialog open={!!recommendedMatchId} onOpenChange={(open) => !open && setRecommendedMatchId(null)}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-gradient-to-br from-indigo-600 via-emerald-600 to-teal-600 p-6 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Brain size={120} />
            </div>
            <DialogHeader className="relative z-10 text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                  <Sparkles size={20} className="text-amber-300" />
                </div>
                <DialogTitle className="text-2xl font-black italic tracking-tight flex items-center gap-2">
                  AI Scouting Report
                  <Badge className="bg-emerald-400/30 text-[9px] text-white border-white/20 animate-pulse">ML LEARNING</Badge>
                </DialogTitle>
              </div>
              <DialogDescription className="text-emerald-50 text-sm font-medium">
                Selección de 10 jugadores con equilibrio táctico (Dibujo 2-3-1 + suplentes) optimizada para la victoria.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 bg-gray-50 max-h-[70vh] overflow-y-auto">
            {recommendedMatchId && (() => {
              const match = matches.find(m => m.id === recommendedMatchId);
              const pred = predictions.get(recommendedMatchId);
              if (!match || !pred) return null;
              
              const opponent = opponents.find(o => o.id === match.opponentId);

              return (
                <div className="space-y-4 text-left">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="bg-gray-50 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-gray-400 shrink-0 uppercase text-[10px]">
                      vs
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900 leading-tight">{opponent?.name || 'Rival'}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sugerencia AI p/ Temporada</p>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between shadow-sm overflow-hidden relative group/ideal">
                    <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none group-hover/ideal:scale-110 transition-transform">
                      <Trophy size={48} />
                    </div>
                    <div className="flex flex-col relative z-10">
                      <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Victoria Probable Ideal</span>
                      <span className="text-[9px] text-emerald-600 font-medium italic">Con el equipo aquí propuesto</span>
                    </div>
                    <div className="flex items-center gap-2 relative z-10">
                       <Trophy size={16} className="text-emerald-500 animate-bounce" />
                       <span className="text-2xl font-black text-emerald-700">{pred.recommendedProbabilities.win}%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {pred.recommendedSquad.map((player, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={player.id} 
                        className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-emerald-200 transition-colors group/p"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-gray-300 w-4">{idx + 1}</span>
                          <Avatar className="h-8 w-8 rounded-lg shrink-0 border border-gray-50">
                            <AvatarImage src={player.photoUrl} className="object-cover" referrerPolicy="no-referrer" />
                            <AvatarFallback className="bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                              {player.firstName[0]}{player.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs font-bold text-gray-900 leading-tight group-hover/p:text-emerald-600 transition-colors">
                              {player.alias || player.firstName}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-[8px] h-4 px-1 bg-gray-50 border-gray-100 text-gray-400 font-medium">
                                {player.position}
                              </Badge>
                              {(() => {
                                 const pRating = allPlayerRatings.find(r => r.id === player.id);
                                 const goals = stats.filter(s => s.playerId === player.id && s.attendance === 'attending').reduce((acc, s) => acc + (s.goals || 0), 0);
                                 const attendRate = pRating?.breakdown ? (pRating.breakdown.partidosAsistidos / (pRating.breakdown.partidosComputables || 1)) : 0;
                                 
                                 return (
                                   <>
                                     {goals >= 3 && (
                                       <Badge className="text-[7px] h-4 px-1 bg-amber-50 text-amber-700 border-amber-100 font-black">
                                         GOLS
                                       </Badge>
                                     )}
                                     {attendRate >= 0.85 && (
                                       <Badge className="text-[7px] h-4 px-1 bg-blue-50 text-blue-700 border-blue-100 font-black">
                                         REG.
                                       </Badge>
                                     )}
                                   </>
                                 );
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[10px] font-black text-emerald-600">{allPlayerRatings.find(r => r.id === player.id)?.rating || 0}</span>
                          <span className="text-[8px] font-bold text-gray-300 uppercase leading-none mt-0.5">Baremo</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-gray-100/50 p-3 rounded-xl border border-gray-100/50">
                    <Info size={12} className="shrink-0" />
                    <p>Criterio: 1 Portero, dibujo 2-3-1 (7 titulares) + 3 suplentes balanceados. Basado en goles, regularidad y baremo actual.</p>
                  </div>

                  <Button 
                    className="w-full bg-black hover:bg-gray-800 text-white font-bold rounded-xl h-11"
                    onClick={() => setRecommendedMatchId(null)}
                  >
                    Cerrar Informe
                  </Button>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSquadMatchId} onOpenChange={(open) => !open && setSelectedSquadMatchId(null)}>
        <DialogContent className="sm:max-w-[700px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] flex flex-col">
          {selectedSquadMatchId && (() => {
            const match = matches.find(m => m.id === selectedSquadMatchId);
            const opponent = opponents.find(o => o.id === match?.opponentId);
            const analysis = squadAnalysis.get(selectedSquadMatchId);
            if (!analysis) return null;

            const gradeColors = {
              'S': 'bg-fuchsia-600 text-white border-fuchsia-700 shadow-md',
              'A': 'bg-emerald-600 text-white border-emerald-700 shadow-md',
              'B': 'bg-blue-600 text-white border-blue-700 shadow-md',
              'C': 'bg-amber-500 text-white border-amber-600 shadow-md',
              'D': 'bg-red-600 text-white border-red-700 shadow-md'
            };

            return (
              <>
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white shrink-0 relative">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <ClipboardCheck size={120} />
                  </div>
                  <DialogHeader className="relative z-10 text-left">
                    <div className="flex justify-between items-start">
                      <div>
                        <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                          Evaluación de Convocatoria
                        </DialogTitle>
                        <DialogDescription className="text-gray-300 text-sm mt-1">
                          vs {opponent?.name || 'Rival'} • {analysis.attendingCount} Jugadores
                        </DialogDescription>
                      </div>
                      <div className={cn("px-4 py-2 text-2xl font-black rounded-xl border flex flex-col items-center leading-none", gradeColors[analysis.grade as keyof typeof gradeColors])}>
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
                                {pc.tags.map((tag, i) => (
                                  <Badge key={i} variant="outline" className={cn(
                                    "text-[9px] h-4 px-1.5 font-bold border-none",
                                    tag === 'Portero' ? "bg-amber-100 text-amber-700" :
                                    tag === 'Defensa' ? "bg-blue-100 text-blue-700" :
                                    tag === 'Medio' ? "bg-emerald-100 text-emerald-700" :
                                    tag === 'Delantero' ? "bg-red-100 text-red-700" :
                                    tag.includes('Estrella') ? "bg-purple-100 text-purple-700" :
                                    "bg-gray-100 text-gray-600"
                                  )}>
                                    {tag}
                                  </Badge>
                                ))}
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
                    onClick={() => setSelectedSquadMatchId(null)}
                  >
                    Cerrar Informe
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
    </TooltipProvider>
  );
}