import { Player, Match, LeagueFixture, StandingsEntry } from '../types';
import { 
  NO_GOALKEEPER_GC_MODIFIER, 
  EXTRA_ATTACKERS_GF_MODIFIER, 
  SYNERGY_GF_BONUS,
  KEY_PLAYER_MISSING_GF_PENALTY,
  KEY_PLAYER_MISSING_GC_PENALTY,
  AGE_MODIFIERS,
  OPPONENT_LEAGUE_FORM_WINDOW,
} from './predictionConstants';
import { calculateAge } from './ageUtils';
import { getSynergyKey, SynergyData } from './synergyCalculator';
import { SquadAnalysisResult, SquadReason, PlayerRating } from '../types/aiAnalysis';
import { getOpponentLeagueForm } from './opponentForm';

/**
 * Evalúa una convocatoria (squad) para un partido específico.
 */
export function evaluateSquad(
  squadPlayers: Player[],
  match: Match,
  allPlayerRatings: PlayerRating[],
  synergyMap: Map<string, SynergyData>,
  teamAvgBaremo: number,
  allMatchesWithScores: Match[],
  inFormPlayers: Set<string>,
  keyPlayerIds: string[],
  leagueFixtures: LeagueFixture[] = [],
  standings: StandingsEntry[] = []
): SquadAnalysisResult {
  const reasons: SquadReason[] = [];
  const squadSize = squadPlayers.length;
  
  if (squadSize === 0) {
    return {
      score: 0,
      grade: 'D',
      reasons: [{ type: 'negative', text: 'Sin jugadores confirmados' }],
      attendingCount: 0,
      avgBaremo: 0,
      playerContributions: [],
      improvements: []
    };
  }

  // 1. Baremo Medio
  const avgBaremo = squadPlayers.reduce((acc, p) => {
    const r = allPlayerRatings.find(pr => pr.id === p.id)?.rating || teamAvgBaremo;
    return acc + r;
  }, 0) / squadSize;

  if (avgBaremo > teamAvgBaremo + 5) {
    reasons.push({ type: 'positive', text: 'Calidad individual superior a la media' });
  } else if (avgBaremo < teamAvgBaremo - 5) {
    reasons.push({ type: 'negative', text: 'Nivel técnico por debajo de lo habitual' });
  }

  // 2. Factores tácticos
  const hasGoalkeeper = squadPlayers.some(p => p.position === 'Portero');
  const defendersCount = squadPlayers.filter(p => p.position === 'Defensa').length;
  const attackersCount = squadPlayers.filter(p => p.position === 'Delantero').length;

  let tacticalGCMulti = 1.0;
  let tacticalGFMulti = 1.0;

  if (!hasGoalkeeper) {
    reasons.push({ type: 'negative', text: 'Ausencia de portero especialista' });
    tacticalGCMulti *= NO_GOALKEEPER_GC_MODIFIER;
  }
  
  if (defendersCount < 3) {
    reasons.push({ type: 'negative', text: 'Escasez de efectivos defensivos' });
  }

  if (attackersCount >= 3) {
    tacticalGFMulti *= EXTRA_ATTACKERS_GF_MODIFIER;
    reasons.push({ type: 'positive', text: 'Gran despliegue ofensivo' });
  }

  // 3. Edad media
  const avgAge = squadPlayers.reduce((acc, p) => acc + calculateAge(p.birthDate, new Date(match.date)), 0) / squadSize;
  let ageMod = 1.0;
  if (avgAge < AGE_MODIFIERS.VERY_YOUNG.maxAge) {
      ageMod = AGE_MODIFIERS.VERY_YOUNG.modifier;
      reasons.push({ type: 'neutral', text: 'Plantilla muy joven y explosiva' });
  } else if (avgAge < AGE_MODIFIERS.PRIME.maxAge) {
      ageMod = AGE_MODIFIERS.PRIME.modifier;
      reasons.push({ type: 'positive', text: 'Plantilla en su mejor momento físico' });
  } else if (avgAge < AGE_MODIFIERS.PEAK.maxAge) {
      ageMod = AGE_MODIFIERS.PEAK.modifier;
  } else {
      ageMod = AGE_MODIFIERS.VETERAN.modifier;
      reasons.push({ type: 'neutral', text: 'Experiencia y veteranía en el campo' });
  }

  // 4. Sinergias (Uso eficiente del mapa pre-calculado)
  let synergiesCount = 0;
  for (let i = 0; i < squadPlayers.length; i++) {
    for (let j = i + 1; j < squadPlayers.length; j++) {
      const key = getSynergyKey(squadPlayers[i].id, squadPlayers[j].id);
      if (synergyMap.get(key)?.isLethal) synergiesCount++;
    }
  }
  if (synergiesCount > 0) {
    tacticalGFMulti *= (1 + (SYNERGY_GF_BONUS * synergiesCount));
    reasons.push({ type: 'positive', text: `Sociedades: ${synergiesCount} conexiones letales` });
  }

  // 5. Jugadores Clave
  const presentKeyPlayers = squadPlayers.filter(p => keyPlayerIds.includes(p.id)).length;
  if (presentKeyPlayers >= 4) {
      reasons.push({ type: 'positive', text: 'Columna vertebral (estrellas) disponible' });
  } else if (presentKeyPlayers <= 1) {
      reasons.push({ type: 'negative', text: 'Ausencia de referentes clave' });
  }

  const oppForm = getOpponentLeagueForm(
    match.opponentId,
    match.seasonId,
    leagueFixtures,
    OPPONENT_LEAGUE_FORM_WINDOW,
    standings
  );

  // 6. Baremo final (Simplificado para el ejemplo, pero siguiendo la lógica del plan)
  const baseScore = (avgBaremo / 100) * 60 + Math.min((squadSize / 12) * 40, 40);
  let finalScore = baseScore * (tacticalGFMulti / tacticalGCMulti) * ageMod;

  if (oppForm.sampleGames >= 2) {
    const strength = Math.min(1, Math.max(0, (oppForm.sampleGames - 1) / 4));
    if (oppForm.attackTrend > 1.03) {
      reasons.push({
        type: 'negative',
        text: 'Rival con buena racha ofensiva en liga del grupo',
      });
      finalScore *= 1 - 0.04 * strength * (oppForm.attackTrend - 1);
      if (defendersCount < 3) finalScore *= 0.97;
    }
    if (oppForm.defenseTrend > 1.03) {
      reasons.push({
        type: 'positive',
        text: 'Rival encaja más goles en liga del grupo (margen ofensivo)',
      });
      finalScore *= 1 + 0.03 * strength * (oppForm.defenseTrend - 1);
    }
    if (oppForm.defenseTrend < 0.97) {
      reasons.push({
        type: 'neutral',
        text: 'Rival más cerrado atrás últimamente en liga del grupo',
      });
      finalScore *= 1 - 0.02 * strength * (1 - oppForm.defenseTrend);
    }
  }

  finalScore = Math.min(Math.max(finalScore, 0), 100);

  let grade: 'S' | 'A' | 'B' | 'C' | 'D' = 'C';
  if (finalScore >= 85) grade = 'S';
  else if (finalScore >= 75) grade = 'A';
  else if (finalScore >= 60) grade = 'B';
  else if (finalScore >= 45) grade = 'C';
  else grade = 'D';

  return {
    score: Math.round(finalScore),
    grade,
    reasons,
    attendingCount: squadSize,
    avgBaremo,
    playerContributions: squadPlayers.map(p => ({
        player: p,
        rating: allPlayerRatings.find(pr => pr.id === p.id)?.rating || teamAvgBaremo,
        tags: []
    })),
    improvements: [] // Se calcula por separado para optimización incremental
  };
}
