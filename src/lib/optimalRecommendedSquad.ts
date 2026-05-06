import type { Injury, Player, PlayerStat } from '../types';
import type { PlayerRating } from '../types/aiAnalysis';
import { posOrder } from '../types/aiAnalysis';
import { getSynergyKey, type SynergyData } from './synergyCalculator';

/** Debe coincidir con los nombres de formación del simulador (sin contar portero). */
export type LineupFormationId = '2-3-1' | '3-2-1' | '2-2-2' | '3-3';

export const LINEUP_FORMATION_OPTIONS: readonly LineupFormationId[] = [
  '2-3-1',
  '3-2-1',
  '2-2-2',
  '3-3',
];

const FORMATION_LINE_MINIMUMS: Record<LineupFormationId, { def: number; mid: number; fwd: number }> = {
  '2-3-1': { def: 2, mid: 3, fwd: 1 },
  '3-2-1': { def: 3, mid: 2, fwd: 1 },
  '2-2-2': { def: 2, mid: 2, fwd: 2 },
  '3-3': { def: 3, mid: 0, fwd: 3 },
};

export const OUTFIELD_SLOT_MIN = 10;
export const OUTFIELD_SLOT_MAX = 12;

export const OUTFIELD_SLOT_OPTIONS = [10, 11, 12] as const;
export type OutfieldSlotCount = (typeof OUTFIELD_SLOT_OPTIONS)[number];

const SYNERGY_SCORE_PER_LETHAL = 2.2;
const MAX_SYNERGY_BONUS = 8;

export interface BuildOptimalSquadParams {
  players: Player[];
  playerSeasons: Array<{ playerId: string; seasonId: string }>;
  seasonId: string;
  /** Si se indica, filtra disponibilidad según estadísticas del partido. */
  matchId?: string;
  stats: PlayerStat[];
  injuries: Injury[];
  allPlayerRatings: PlayerRating[];
  teamAvgBaremo: number;
  synergyMap: Map<string, SynergyData>;
  formation: LineupFormationId;
  /** Jugadores de campo en convocatoria (excluye porteros). Entre 10 y 12. */
  outfieldSlots: number;
  /** Goles esperados propios / rival (ya modulados) para sesgar rol defensivo u ofensivo. */
  predGF: number;
  predGC: number;
}

function clampOutfieldSlots(n: number): number {
  return Math.min(OUTFIELD_SLOT_MAX, Math.max(OUTFIELD_SLOT_MIN, Math.round(n)));
}

function countOutfield(players: Player[]): number {
  return players.filter((p) => p.position !== 'Portero').length;
}

export function squadMeanBaremo(
  squad: Player[],
  allPlayerRatings: PlayerRating[],
  teamAvgBaremo: number
): number {
  if (squad.length === 0) return 0;
  return (
    squad.reduce(
      (a, p) => a + (allPlayerRatings.find((r) => r.id === p.id)?.rating ?? teamAvgBaremo),
      0
    ) / squad.length
  );
}

/** Elige 10, 11 o 12 jugadores de campo que maximicen el baremo medio de toda la convocatoria (incluye portero). */
export function pickOutfieldSlotsForHighestSquadBaremo(
  params: Omit<BuildOptimalSquadParams, 'outfieldSlots'>
): number {
  let bestN: OutfieldSlotCount = OUTFIELD_SLOT_MIN;
  let bestAvg = -1;
  for (const n of OUTFIELD_SLOT_OPTIONS) {
    const { squad } = buildOptimalRecommendedSquad({ ...params, outfieldSlots: n });
    const avg = squadMeanBaremo(squad, params.allPlayerRatings, params.teamAvgBaremo);
    if (avg > bestAvg + 1e-9) {
      bestAvg = avg;
      bestN = n;
    } else if (Math.abs(avg - bestAvg) <= 1e-9 && n > bestN) {
      bestN = n;
    }
  }
  return bestN;
}

/** Una sola pasada: convocatoria óptima y cupo de campo elegido por baremo medio. */
export function buildOptimalRecommendedSquadAutoOutfield(
  params: Omit<BuildOptimalSquadParams, 'outfieldSlots'>
): { squad: Player[]; notes: string[]; outfieldSlots: number } {
  let best: { squad: Player[]; notes: string[]; outfieldSlots: number } = {
    squad: [],
    notes: [],
    outfieldSlots: OUTFIELD_SLOT_MIN,
  };
  let bestAvg = -1;
  for (const n of OUTFIELD_SLOT_OPTIONS) {
    const { squad, notes } = buildOptimalRecommendedSquad({ ...params, outfieldSlots: n });
    const avg = squadMeanBaremo(squad, params.allPlayerRatings, params.teamAvgBaremo);
    if (avg > bestAvg + 1e-9 || (Math.abs(avg - bestAvg) <= 1e-9 && n > best.outfieldSlots)) {
      bestAvg = avg;
      best = { squad, notes, outfieldSlots: n };
    }
  }
  return best;
}

function hasActiveInjury(injuries: Injury[], playerId: string): boolean {
  return injuries.some((inj) => inj.playerId === playerId && !inj.endDate);
}

function attendanceMultiplier(matchId: string | undefined, stats: PlayerStat[], playerId: string): number {
  if (!matchId) return 1;
  const row = stats.find((s) => s.matchId === matchId && s.playerId === playerId);
  if (!row) return 1;
  switch (row.attendance) {
    case 'notAttending':
    case 'justified':
      return 0;
    case 'doubtful':
      return 0.88;
    case 'noResponse':
      return 0.95;
    default:
      return 1;
  }
}

function rivalPressureNormalized(predGF: number, predGC: number): number {
  const t = Math.max(0.15, predGF + predGC);
  return Math.min(1, Math.max(0, predGC / t));
}

function synergyBonus(
  playerId: string,
  selectedIds: string[],
  synergyMap: Map<string, SynergyData>
): number {
  let lethal = 0;
  for (const sid of selectedIds) {
    if (synergyMap.get(getSynergyKey(playerId, sid))?.isLethal) lethal++;
  }
  return Math.min(MAX_SYNERGY_BONUS, lethal * SYNERGY_SCORE_PER_LETHAL);
}

function positionPressureMultiplier(position: Player['position'], pressure: number): number {
  // pressure alto → rival peligroso → refuerzo defensivo/medio en huecos libres.
  if (position === 'Defensa') return 1 + pressure * 0.1;
  if (position === 'Medio') return 1 + 0.04;
  if (position === 'Delantero') return 1 + (1 - pressure) * 0.1;
  return 1;
}

function flexiblePickScore(
  p: Player,
  base: number,
  selectedIds: string[],
  synergyMap: Map<string, SynergyData>,
  pressure: number
): number {
  return base + synergyBonus(p.id, selectedIds, synergyMap) + positionPressureMultiplier(p.position, pressure);
}

export function buildOptimalRecommendedSquad(params: BuildOptimalSquadParams): {
  squad: Player[];
  notes: string[];
} {
  const notes: string[] = [];
  const {
    players,
    playerSeasons,
    seasonId,
    matchId,
    stats,
    injuries,
    allPlayerRatings,
    teamAvgBaremo,
    synergyMap,
    formation,
    predGF,
    predGC,
    outfieldSlots: rawOutfieldSlots,
  } = params;

  const outfieldTarget = clampOutfieldSlots(rawOutfieldSlots);

  const line = FORMATION_LINE_MINIMUMS[formation];
  const pressure = rivalPressureNormalized(predGF, predGC);

  const seasonRosterIds = new Set(playerSeasons.filter((ps) => ps.seasonId === seasonId).map((ps) => ps.playerId));

  type Scored = { player: Player; score: number };
  const scored: Scored[] = [];

  for (const p of players) {
    if (!seasonRosterIds.has(p.id)) continue;
    if (hasActiveInjury(injuries, p.id)) continue;
    const att = attendanceMultiplier(matchId, stats, p.id);
    if (att <= 0) continue;
    const baseRating = allPlayerRatings.find((r) => r.id === p.id)?.rating ?? teamAvgBaremo;
    scored.push({ player: p, score: baseRating * att });
  }

  if (scored.length === 0) {
    return { squad: [], notes: ['No hay jugadores elegibles para esta temporada / partido.'] };
  }

  const byBetter = [...scored].sort((a, b) => b.score - a.score);
  const byPos = (pos: Player['position']) => scored.filter((x) => x.player.position === pos).sort((a, b) => b.score - a.score);

  const picked: Player[] = [];
  const pickedSet = () => picked.map((p) => p.id);

  const takeFromPos = (pos: Player['position'], count: number) => {
    const pool = byPos(pos);
    let taken = 0;
    for (const { player } of pool) {
      if (picked.some((x) => x.id === player.id)) continue;
      picked.push(player);
      taken++;
      if (taken >= count) break;
    }
    return taken;
  };

  let gks = takeFromPos('Portero', 1);
  if (gks === 0) notes.push('No hay porteros disponibles convocados; revisa lesionados y asistencias.');

  let defT = takeFromPos('Defensa', line.def);
  if (defT < line.def) notes.push(`Solo hay ${defT} defensa(s): se cubrirá lo posible.`);

  let midT = takeFromPos('Medio', line.mid);
  if (midT < line.mid) notes.push(`Faltan medios para el esquema ${formation} (${midT}/${line.mid}).`);

  let fwdT = takeFromPos('Delantero', line.fwd);
  if (fwdT < line.fwd) notes.push(`Faltan delanteros para el esquema ${formation} (${fwdT}/${line.fwd}).`);

  const minOutfieldFormation = line.def + line.mid + line.fwd;
  if (outfieldTarget < minOutfieldFormation) {
    notes.push(
      `El sistema ${formation} exige al menos ${minOutfieldFormation} jugadores de campo; se usará ese mínimo.`
    );
  }
  const effectiveOutfieldTarget = Math.max(outfieldTarget, minOutfieldFormation);

  const remaining = byBetter
    .map((x) => x.player)
    .filter((p) => !picked.some((x) => x.id === p.id));

  while (remaining.length > 0) {
    if (countOutfield(picked) >= effectiveOutfieldTarget) break;

    const fieldCandidates = remaining.filter((p) => p.position !== 'Portero');
    if (fieldCandidates.length === 0) break;

    let bestP: Player | null = null;
    let bestS = -Infinity;
    const sel = pickedSet();
    for (const p of fieldCandidates) {
      const base = scored.find((x) => x.player.id === p.id)?.score ?? teamAvgBaremo;
      const fs = flexiblePickScore(p, base, sel, synergyMap, pressure);
      if (fs > bestS) {
        bestS = fs;
        bestP = p;
      }
    }
    if (!bestP) break;
    const idx = remaining.findIndex((x) => x.id === bestP!.id);
    if (idx >= 0) remaining.splice(idx, 1);
    picked.push(bestP);
  }

  if (countOutfield(picked) < effectiveOutfieldTarget) {
    notes.push(
      `Solo hay ${countOutfield(picked)} jugador(es) de campo disponibles (objetivo ${effectiveOutfieldTarget}).`
    );
  }

  if (pressure > 0.55) {
    notes.push('Rival ofensivo en el modelo: refuerzo de perfiles defensivos y medios en los últimos puestos.');
  } else if (pressure < 0.42) {
    notes.push('Partido más abierto en el modelo: prioridad a finalización y medio creativo donde encaje.');
  }

  picked.sort((a, b) => (posOrder[a.position] || 9) - (posOrder[b.position] || 9));

  return { squad: picked, notes };
}

/** Expone mínimos de línea para UI (portero aparte). */
export function getFormationLineMinimums(formation: LineupFormationId) {
  return FORMATION_LINE_MINIMUMS[formation];
}
