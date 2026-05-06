import { Player, Position } from '../types';

export type ConfidenceLevel = 'Alta' | 'Media' | 'Baja';

export interface MatchProbabilities {
  win: number;
  draw: number;
  loss: number;
}

export interface MatchPrediction {
  team: number;
  opponent: number;
  confidence: ConfidenceLevel;
  reasons: string[];
  probabilities: MatchProbabilities;
  recommendedSquad: Player[];
  recommendedProbabilities: MatchProbabilities;
  /** λ de goles del modelo antes de Poisson (sesgo rival / convocatoria en el builder). */
  modelPredGF: number;
  modelPredGC: number;
  /** Cupo de jugadores de campo en la convocatoria ideal (10–12), elegido por mayor baremo medio con 2-3-1. */
  recommendedOutfieldSlots: number;
}

export type ReasonType = 'positive' | 'negative' | 'neutral';

export interface SquadReason {
  type: ReasonType;
  text: string;
}

export type SquadGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface PlayerContribution {
  player: Player;
  rating: number;
  tags: string[];
}

export interface SquadImprovement {
  player: Player;
  scoreIncrease: number;
  reasons: SquadReason[];
}

export interface SquadAnalysisResult {
  score: number;
  grade: SquadGrade;
  reasons: SquadReason[];
  attendingCount: number;
  avgBaremo: number;
  playerContributions: PlayerContribution[];
  improvements: SquadImprovement[];
}

export interface PlayerRating {
  id: string;
  rating: number;
}

export const posOrder: Record<Position, number> = {
  Portero: 1,
  Defensa: 2,
  Medio: 3,
  Delantero: 4
};
