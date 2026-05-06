import type { Position } from '@/types';
import type { BaremoRowInput } from '@/lib/baremoPositionStudy';

/** Alineación de referencia F7: 1 portero + 2 def + 3 med + 1 del (2-3-1). */
const IDEAL_ON_FIELD: Record<Position, number> = {
  Portero: 1,
  Defensa: 2,
  Medio: 3,
  Delantero: 1,
};

const POS_ORDER: Position[] = ['Portero', 'Defensa', 'Medio', 'Delantero'];

export type IdealBaremoSevenResult = {
  picked: BaremoRowInput[];
  avgBaremo: number;
  complete: boolean;
  missing: string[];
};

export function pickIdealBaremoSeven(rows: BaremoRowInput[]): IdealBaremoSevenResult {
  const picked: BaremoRowInput[] = [];
  const missing: string[] = [];
  for (const pos of POS_ORDER) {
    const need = IDEAL_ON_FIELD[pos];
    const sorted = rows
      .filter((r) => r.player.position === pos)
      .sort((a, b) => b.notaFinal - a.notaFinal);
    const take = Math.min(need, sorted.length);
    if (take < need) missing.push(`${pos} ${take}/${need}`);
    picked.push(...sorted.slice(0, take));
  }
  const avgBaremo = picked.length > 0 ? picked.reduce((a, r) => a + r.notaFinal, 0) / picked.length : 0;
  return {
    picked,
    avgBaremo,
    complete: missing.length === 0,
    missing,
  };
}
