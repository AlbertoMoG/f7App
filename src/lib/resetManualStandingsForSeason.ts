import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { StandingsEntry, Team } from '../types';
import { standingsEntryHasManualAdjustment } from './leagueStandingsAudit';

const ZERO_STANDING_FIELDS = {
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  points: 0,
} as const;

/**
 * Opción A: deja deltas manuales de `standings` en cero para la temporada;
 * la clasificación muestra solo el cálculo automático desde resultados.
 */
export async function resetManualStandingsDeltaForSeason(
  team: Team | null,
  seasonId: string,
  standings: StandingsEntry[]
): Promise<{ updatedRowCount: number }> {
  if (!team || !seasonId) return { updatedRowCount: 0 };
  const rows = standings.filter(
    (s) =>
      s.teamId === team.id &&
      s.seasonId === seasonId &&
      standingsEntryHasManualAdjustment(s)
  );
  if (rows.length === 0) return { updatedRowCount: 0 };

  const chunkSize = 400;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const s of rows.slice(i, i + chunkSize)) {
      batch.update(doc(db, 'standings', s.id), { ...ZERO_STANDING_FIELDS });
    }
    await batch.commit();
  }
  return { updatedRowCount: rows.length };
}
