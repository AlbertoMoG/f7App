import type { Player, Position } from '@/types';

export type BaremoRowInput = {
  player: Player;
  notaFinal: number;
  compromiso: number;
  desempeno: number;
  fiabilidad: number;
  partidos: number;
  delta: number;
  teamAvg: number;
};

export type PositionBaremoStudy =
  | { position: Position; empty: true }
  | {
      position: Position;
      empty: false;
      count: number;
      avgNotaFinal: number;
      avgCompromiso: number;
      avgDesempeno: number;
      avgFiabilidad: number;
      avgPartidos: number;
      deltaVsTeam: number;
      minBaremo: number;
      maxBaremo: number;
      spreadBaremo: number;
      lowSampleCount: number;
      best: BaremoRowInput;
      worst: BaremoRowInput;
    };

export type PositionBaremoFilledStudy = Extract<PositionBaremoStudy, { empty: false }>;

const POSITION_ORDER: Position[] = ['Portero', 'Defensa', 'Medio', 'Delantero'];

const lowSampleRow = (r: BaremoRowInput) => r.fiabilidad < 0.72 || r.partidos <= 3;

export function buildBaremoPositionStudy(rows: BaremoRowInput[]): PositionBaremoStudy[] {
  const teamAvg = rows[0]?.teamAvg ?? 0;
  return POSITION_ORDER.map((pos) => {
    const group = rows.filter((r) => r.player.position === pos);
    if (group.length === 0) return { position: pos, empty: true };
    const n = group.length;
    const sum = (pick: (r: BaremoRowInput) => number) => group.reduce((a, r) => a + pick(r), 0);
    const sorted = [...group].sort((a, b) => b.notaFinal - a.notaFinal);
    const best = sorted[0]!;
    const worst = sorted[sorted.length - 1]!;
    const minBaremo = worst.notaFinal;
    const maxBaremo = best.notaFinal;
    const avgNotaFinal = sum((r) => r.notaFinal) / n;
    return {
      position: pos,
      empty: false,
      count: n,
      avgNotaFinal,
      avgCompromiso: sum((r) => r.compromiso) / n,
      avgDesempeno: sum((r) => r.desempeno) / n,
      avgFiabilidad: sum((r) => r.fiabilidad) / n,
      avgPartidos: sum((r) => r.partidos) / n,
      deltaVsTeam: avgNotaFinal - teamAvg,
      minBaremo,
      maxBaremo,
      spreadBaremo: maxBaremo - minBaremo,
      lowSampleCount: group.filter(lowSampleRow).length,
      best,
      worst,
    };
  });
}

export function rankPositionLinesByStrength(studies: PositionBaremoStudy[]): Position[] {
  const filled = studies.filter((s): s is Extract<PositionBaremoStudy, { empty: false }> => !s.empty);
  return [...filled].sort((a, b) => b.avgNotaFinal - a.avgNotaFinal).map((s) => s.position);
}
