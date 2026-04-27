import { Player, Position } from '../types';
import { 
  SYNERGY_GF_BONUS,
  NO_GOALKEEPER_GC_MODIFIER
} from './predictionConstants';
import { getSynergyKey, SynergyData } from './synergyCalculator';
import { SquadAnalysisResult, SquadReason, PlayerRating } from '../types/aiAnalysis';

/**
 * Calcula el impacto incremental de añadir un jugador a una convocatoria ya evaluada.
 */
export function calculatePlayerDelta(
  player: Player,
  currentSquad: Player[],
  currentScore: number,
  currentAnalysis: SquadAnalysisResult,
  synergyMap: Map<string, SynergyData>,
  allPlayerRatings: PlayerRating[],
  teamAvgBaremo: number
): { scoreIncrease: number; reasons: SquadReason[] } {
  
  const reasons: SquadReason[] = [];
  let delta = 0;

  const currentSize = currentSquad.length;
  const newSize = currentSize + 1;
  const playerRating = allPlayerRatings.find(r => r.id === player.id)?.rating ?? teamAvgBaremo;

  // 1. Impacto en el baremo medio (Peso aproximado)
  const currentAvg = currentAnalysis.avgBaremo;
  const newAvg = (currentAvg * currentSize + playerRating) / newSize;
  const baremoImpact = (newAvg - currentAvg) * 1.5;
  delta += baremoImpact;

  // 2. Impacto en el tamaño de la plantilla (Curva de saturación)
  const getSquadSizeScore = (n: number) => Math.min((n / 12) * 40, 40);
  const sizeDelta = getSquadSizeScore(newSize) - getSquadSizeScore(currentSize);
  delta += sizeDelta;

  // 3. Impacto táctico
  if (player.position === 'Portero' && !currentSquad.some(p => p.position === 'Portero')) {
    delta += 15; // Revertir penalización
    reasons.push({ type: 'positive', text: 'Cubre la portería sin especialista' });
  }

  // 4. Nuevas sinergias
  let newSynergies = 0;
  currentSquad.forEach(p => {
    const key = getSynergyKey(player.id, p.id);
    if (synergyMap.get(key)?.isLethal) {
      newSynergies++;
    }
  });
  if (newSynergies > 0) {
    delta += newSynergies * 3;
    reasons.push({ type: 'positive', text: `Activa ${newSynergies} nueva(s) sinergia(s) letal(es)` });
  }

  if (delta <= 0) return { scoreIncrease: 0, reasons: [] };

  return {
    scoreIncrease: Math.round(delta),
    reasons: reasons.length > 0 ? reasons : [{ type: 'positive', text: 'Eleva la competitividad general' }],
  };
}
