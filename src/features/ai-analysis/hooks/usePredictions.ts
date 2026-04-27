import React from 'react';
import { Player, Match, PlayerStat, Opponent, Season, Field, PlayerSeason, Injury, StandingsEntry } from '../../../types';
import { 
  BIAS_LEARNING_RATE, 
  CALIBRATION_MATCH_COUNT, 
  MIN_PLAYERS_FOR_PREDICTION,
  NO_GOALKEEPER_GC_MODIFIER,
  EXTRA_ATTACKERS_GF_MODIFIER,
  SYNERGY_GF_BONUS,
  KEY_PLAYER_MISSING_GF_PENALTY,
  KEY_PLAYER_MISSING_GC_PENALTY,
  STANDINGS_WEIGHT,
  STANDINGS_MODIFIER_CLAMP,
  FATIGUE_DAYS_THRESHOLD,
  REST_DAYS_THRESHOLD,
  AGE_MODIFIERS,
  posOrder
} from '../../../lib/predictionConstants';
import { calculateAge } from '../../../lib/ageUtils';
import { getStandingsStats } from '../../../lib/standingsUtils';
import { poisson, getMostProbableScore } from '../../../lib/poisson.ts';
import { buildSynergyMap, getSynergyKey } from '../../../lib/synergyCalculator';
import { MatchPrediction, PlayerRating } from '../../../types/aiAnalysis';

interface UsePredictionsProps {
  players: Player[];
  playerSeasons: PlayerSeason[];
  matches: Match[];
  stats: PlayerStat[];
  opponents: Opponent[];
  seasons: Season[];
  fields: Field[];
  injuries: Injury[];
  globalSeasonId: string;
  standings: StandingsEntry[];
  allPlayerRatings: any[]; // de usePlayerRatings
}

export function usePredictions({
  players,
  playerSeasons,
  matches,
  stats,
  opponents,
  seasons,
  fields,
  injuries,
  globalSeasonId,
  standings,
  allPlayerRatings
}: UsePredictionsProps) {

  return React.useMemo(() => {
    const predictionMap = new Map<string, MatchPrediction>();
    
    // --- 1. Calibración del Bias del Modelo (Machine Learning Simple) ---
    const allMatchesWithScores = matches.filter(m => m.status === 'completed' && m.scoreTeam != null && m.scoreOpponent != null);
    const sortedCompleted = [...allMatchesWithScores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const calibrationMatches = sortedCompleted.slice(0, CALIBRATION_MATCH_COUNT);
    
    let biasGF = 0;
    let biasGC = 0;
    
    if (calibrationMatches.length > 0) {
      calibrationMatches.forEach(m => {
        let errorGF = 0;
        let errorGC = 0;

        if (m.savedPrediction) {
            // Evaluamos el error directo de la IA vs el Resultado Real
            errorGF = (m.scoreTeam || 0) - m.savedPrediction.team;
            errorGC = (m.scoreOpponent || 0) - m.savedPrediction.opponent;
        } else {
            // Fallback: error respecto a la media
            const myAvgGF = allMatchesWithScores.reduce((acc, match) => acc + (match.scoreTeam || 0), 0) / allMatchesWithScores.length;
            const myAvgGC = allMatchesWithScores.reduce((acc, match) => acc + (match.scoreOpponent || 0), 0) / allMatchesWithScores.length;
            
            errorGF = (m.scoreTeam || 0) - myAvgGF;
            errorGC = (m.scoreOpponent || 0) - myAvgGC;
        }
        
        biasGF += errorGF;
        biasGC += errorGC;
      });
      biasGF = (biasGF / calibrationMatches.length) * BIAS_LEARNING_RATE;
      biasGC = (biasGC / calibrationMatches.length) * BIAS_LEARNING_RATE;
    }

    const synergyMap = buildSynergyMap(matches, stats);

    const scheduledMatches = matches.filter(m => {
        const isAtSeason = globalSeasonId === 'all' || m.seasonId === globalSeasonId;
        return m.status === 'scheduled' && isAtSeason;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const teamAvgBaremo = allPlayerRatings.length > 0 
      ? allPlayerRatings.reduce((acc, p) => acc + p.rating, 0) / allPlayerRatings.length 
      : 70;

    const globalAvgGF = allMatchesWithScores.length > 0 ? allMatchesWithScores.reduce((acc, m) => acc + (m.scoreTeam || 0), 0) / allMatchesWithScores.length : 1.5;
    const globalAvgGC = allMatchesWithScores.length > 0 ? allMatchesWithScores.reduce((acc, m) => acc + (m.scoreOpponent || 0), 0) / allMatchesWithScores.length : 1.5;

    // Momentum (Racha últimos 3 partidos)
    const recentMatches = sortedCompleted.slice(0, 3);
    const momentumGF = recentMatches.length > 0 ? (recentMatches.reduce((acc, m) => acc + (m.scoreTeam || 0), 0) / recentMatches.length) - globalAvgGF : 0;
    const momentumGC = recentMatches.length > 0 ? (recentMatches.reduce((acc, m) => acc + (m.scoreOpponent || 0), 0) / recentMatches.length) - globalAvgGC : 0;

    const keyPlayerIds = allPlayerRatings.sort((a, b) => b.rating - a.rating).slice(0, 5).map(p => p.id);

    scheduledMatches.forEach(match => {
      const attendingStats = stats.filter(s => s.matchId === match.id && s.attendance === 'attending');
      const attendingPlayers = players.filter(p => attendingStats.some(s => s.playerId === p.id));
      const currentSquadSize = attendingPlayers.length;
      
      const currentAvgBaremo = attendingPlayers.length > 0 
        ? attendingPlayers.reduce((acc, p) => acc + (allPlayerRatings.find(pr => pr.id === p.id)?.rating || teamAvgBaremo), 0) / attendingPlayers.length 
        : teamAvgBaremo;

      const vsOppMatches = allMatchesWithScores.filter(m => m.opponentId === match.opponentId);
      const reasons: string[] = [];
      
      let predGF = globalAvgGF;
      let predGC = globalAvgGC;

      // Acumuladores globales para modificadores
      let totalModifierGF = 1.0;
      let totalModifierGC = 1.0;

      // 1. Histórico H2H (Base de la predicción)
      if (vsOppMatches.length > 0) {
        const h2hAvgGF = vsOppMatches.reduce((acc, m) => acc + (m.scoreTeam || 0), 0) / vsOppMatches.length;
        const h2hAvgGC = vsOppMatches.reduce((acc, m) => acc + (m.scoreOpponent || 0), 0) / vsOppMatches.length;
        predGF = (predGF * 0.4) + (h2hAvgGF * 0.6);
        predGC = (predGC * 0.4) + (h2hAvgGC * 0.6);
        reasons.push(`Basado en ${vsOppMatches.length} enfrentamientos previos.`);
      }

      // 2. Fortalezas de Plantilla (Ratio vs Media)
      const strengthRatio = currentAvgBaremo / (teamAvgBaremo || 1);
      totalModifierGF *= strengthRatio;
      totalModifierGC *= (1 / strengthRatio);
      if (strengthRatio > 1.05) reasons.push("Plantilla superior a la media habitual.");
      if (strengthRatio < 0.95) reasons.push("Plantilla por debajo del nivel óptimo.");

      // 3. Balance Táctico
      const hasGoalkeeper = attendingPlayers.some(p => p.position === 'Portero');
      if (!hasGoalkeeper && currentSquadSize > 0) {
          totalModifierGC *= NO_GOALKEEPER_GC_MODIFIER;
          reasons.push("Vulnerabilidad defensiva: Sin portero.");
      }

      const attackers = attendingPlayers.filter(p => p.position === 'Delantero').length;
      if (attackers >= 3) {
          totalModifierGF *= EXTRA_ATTACKERS_GF_MODIFIER;
          reasons.push("Alta densidad de delanteros.");
      }

      // 4. Sinergias Letales
      let synergiesFound = 0;
      for (let i = 0; i < attendingPlayers.length; i++) {
        for (let j = i + 1; j < attendingPlayers.length; j++) {
           if (synergyMap.get(getSynergyKey(attendingPlayers[i].id, attendingPlayers[j].id))?.isLethal) synergiesFound++;
        }
      }
      if (synergiesFound > 0) {
        totalModifierGF *= (1 + (SYNERGY_GF_BONUS * synergiesFound));
        reasons.push(`${synergiesFound} conexión(es) letal(es) entre jugadores.`);
      }

      // 5. Jugadores Clave Ausentes
      const presentKeyPlayers = attendingPlayers.filter(p => keyPlayerIds.includes(p.id)).length;
      const missingKeyPlayers = keyPlayerIds.length - presentKeyPlayers;
      if (missingKeyPlayers > 0) {
          totalModifierGF *= (1 - (KEY_PLAYER_MISSING_GF_PENALTY * (missingKeyPlayers/keyPlayerIds.length)));
          totalModifierGC *= (1 + (KEY_PLAYER_MISSING_GC_PENALTY * (missingKeyPlayers/keyPlayerIds.length)));
          reasons.push(`${missingKeyPlayers} jugador(es) estrella ausentes.`);
      }

      // 6. Clasificación (Standings)
      const teamStats = getStandingsStats(match.seasonId, 'my-team', matches, standings);
      const oppStats = getStandingsStats(match.seasonId, match.opponentId, matches, standings);
      
      if (teamStats && oppStats) {
          const pointsDiff = teamStats.points - oppStats.points;
          const standingMod = 1 + (pointsDiff * 0.02);
          const clampedMod = Math.min(Math.max(standingMod, STANDINGS_MODIFIER_CLAMP.MIN), STANDINGS_MODIFIER_CLAMP.MAX);
          totalModifierGF *= clampedMod;
          totalModifierGC *= (1 / clampedMod);
          if (pointsDiff > 5) reasons.push("Ventaja competitiva en la tabla.");
          if (pointsDiff < -5) reasons.push("Desventaja en la clasificación.");
      }

      // 7. Edad Media
      const avgAge = attendingPlayers.length > 0
        ? attendingPlayers.reduce((acc, p) => acc + calculateAge(p.birthDate, new Date(match.date)), 0) / attendingPlayers.length
        : 25;
      
      let ageMod = 1.0;
      if (avgAge < AGE_MODIFIERS.VERY_YOUNG.maxAge) ageMod = AGE_MODIFIERS.VERY_YOUNG.modifier;
      else if (avgAge < AGE_MODIFIERS.PRIME.maxAge) ageMod = AGE_MODIFIERS.PRIME.modifier;
      else if (avgAge < AGE_MODIFIERS.PEAK.maxAge) ageMod = AGE_MODIFIERS.PEAK.modifier;
      else ageMod = AGE_MODIFIERS.VETERAN.modifier;
      totalModifierGF *= ageMod;

      // 8. Momentum (Aplicado como modificador relativo)
      const momentumModGF = 1 + (momentumGF * 0.1);
      const momentumModGC = 1 + (momentumGC * 0.1);
      totalModifierGF *= Math.max(0.8, Math.min(1.2, momentumModGF));
      totalModifierGC *= Math.max(0.8, Math.min(1.2, momentumModGC));

      // ─── CLAMP GLOBAL DE MODIFICADORES ───────────────────────────────────────
      const CLAMP_MAX = 2.0;
      const CLAMP_MIN = 0.35;

      const clampedTotalGF = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, totalModifierGF));
      const clampedTotalGC = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, totalModifierGC));

      // Aplicar modificadores clampados y añadir bias correction aditivamente
      const finalPredGF = Math.max(0.1, predGF * clampedTotalGF + (Math.abs(biasGF) > 0.1 ? biasGF : 0));
      const finalPredGC = Math.max(0.1, predGC * clampedTotalGC + (Math.abs(biasGC) > 0.1 ? biasGC : 0));

      if (Math.abs(biasGF) > 0.1 || Math.abs(biasGC) > 0.1) {
        reasons.push('Módulo de Aprendizaje: Ajuste aplicado por calibración histórica');
      }

      // Alertas de clamp
      if (totalModifierGF > CLAMP_MAX) reasons.push(`IA: Potencial ofensivo ajustado por seguridad (${totalModifierGF.toFixed(2)}x)`);
      if (totalModifierGF < CLAMP_MIN) reasons.push(`IA: Rendimiento mínimo garantizado (${totalModifierGF.toFixed(2)}x)`);

      const score = getMostProbableScore(finalPredGF, finalPredGC);
      
      // Probabilidades
      let winProb = 0, drawProb = 0, lossProb = 0;
      const POISSON_LIMIT = 8;
      for (let i = 0; i <= POISSON_LIMIT; i++) {
        for (let j = 0; j <= POISSON_LIMIT; j++) {
          const prob = poisson(finalPredGF, i) * poisson(finalPredGC, j);
          if (i > j) winProb += prob * 100;
          else if (i === j) drawProb += prob * 100;
          else lossProb += prob * 100;
        }
      }

      // Normalización de probabilidades
      const totalProb = winProb + drawProb + lossProb;
      if (totalProb > 0) {
          winProb = (winProb / totalProb) * 100;
          drawProb = (drawProb / totalProb) * 100;
          lossProb = (lossProb / totalProb) * 100;
      }

      // Mejor equipo posible (Sugerido)
      const recommendedSquad = players.filter(p => 
        playerSeasons.some(ps => ps.playerId === p.id && ps.seasonId === match.seasonId) &&
        !injuries.some(inj => inj.playerId === p.id && !inj.endDate)
      ).sort((a, b) => {
        const ra = allPlayerRatings.find(r => r.id === a.id)?.rating || 0;
        const rb = allPlayerRatings.find(r => r.id === b.id)?.rating || 0;
        return rb - ra;
      }).slice(0, 10)
      .sort((a, b) => (posOrder[a.position] || 9) - (posOrder[b.position] || 9));

      const recSquadAvgBaremo = recommendedSquad.length > 0 
        ? recommendedSquad.reduce((acc, p) => acc + (allPlayerRatings.find(pr => pr.id === p.id)?.rating || teamAvgBaremo), 0) / recommendedSquad.length 
        : currentAvgBaremo;

      const idealGF = finalPredGF * (recSquadAvgBaremo / (currentAvgBaremo || 1));
      const idealGC = finalPredGC * (currentAvgBaremo / (recSquadAvgBaremo || 1));
      
      let recWinProb = 0, recDrawProb = 0, recLossProb = 0;
      for (let i = 0; i <= POISSON_LIMIT; i++) {
        for (let j = 0; j <= POISSON_LIMIT; j++) {
          const prob = poisson(idealGF, i) * poisson(idealGC, j);
          if (i > j) recWinProb += prob * 100;
          else if (i === j) recDrawProb += prob * 100;
          else recLossProb += prob * 100;
        }
      }

      const recTotalProb = recWinProb + recDrawProb + recLossProb;
      if (recTotalProb > 0) {
        recWinProb = (recWinProb / recTotalProb) * 100;
        recDrawProb = (recDrawProb / recTotalProb) * 100;
        recLossProb = (recLossProb / recTotalProb) * 100;
      }

      predictionMap.set(match.id, {
        team: score.team,
        opponent: score.opponent,
        confidence: vsOppMatches.length > 2 ? 'Alta' : vsOppMatches.length > 0 ? 'Media' : 'Baja',
        reasons,
        probabilities: { win: winProb, draw: drawProb, loss: lossProb },
        recommendedSquad,
        recommendedProbabilities: { win: recWinProb, draw: recDrawProb, loss: recLossProb } 
      });
    });

    return predictionMap;
  }, [players, matches, stats, opponents, globalSeasonId, standings, allPlayerRatings, playerSeasons, injuries]);
}
