import {
  collection, doc, query, where, getDocs, writeBatch,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase';
import type { Team } from '../types';

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

export function useSeasonActions(team: Team | null) {
  const addSeason = async (
    name: string, division: string = '', startYear: number,
    playerIds: string[] = [], opponentIds: string[] = [],
  ) => {
    if (!team) return;
    const batch = writeBatch(db);
    const seasonRef = doc(collection(db, 'seasons'));
    batch.set(seasonRef, { name, division, startYear, teamId: team.id });
    playerIds.forEach(playerId => {
      batch.set(doc(collection(db, 'playerSeasons')), { teamId: team.id, playerId, seasonId: seasonRef.id });
    });
    opponentIds.forEach(opponentId => {
      batch.update(doc(db, 'opponents', opponentId), { seasonIds: arrayUnion(seasonRef.id) });
    });
    try {
      await batch.commit();
      toast.success('Temporada creada y asociaciones guardadas');
    } catch (error) {
      console.error('Error creating season:', error);
      toast.error('Error al crear temporada');
      throw new Error('addSeason failed');
    }
  };

  const updateSeason = async (
    id: string, name: string, division: string, startYear: number,
    playerIds: string[], opponentIds: string[],
  ) => {
    if (!team) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'seasons', id), { name, division, startYear });

    const psSnap = await getDocs(
      query(collection(db, 'playerSeasons'), where('teamId', '==', team.id), where('seasonId', '==', id))
    );
    const existingPlayerIds = psSnap.docs.map(d => d.data().playerId);
    psSnap.docs.forEach(d => {
      if (!playerIds.includes(d.data().playerId)) batch.delete(d.ref);
    });
    playerIds.forEach(playerId => {
      if (!existingPlayerIds.includes(playerId)) {
        batch.set(doc(collection(db, 'playerSeasons')), { teamId: team.id, playerId, seasonId: id });
      }
    });

    const oppsSnap = await getDocs(
      query(collection(db, 'opponents'), where('teamId', '==', team.id), where('seasonIds', 'array-contains', id))
    );
    oppsSnap.docs.forEach(d => {
      if (!opponentIds.includes(d.id)) batch.update(d.ref, { seasonIds: arrayRemove(id) });
    });
    opponentIds.forEach(opponentId => {
      batch.update(doc(db, 'opponents', opponentId), { seasonIds: arrayUnion(id) });
    });

    try {
      await batch.commit();
      toast.success('Temporada actualizada correctamente');
    } catch (error) {
      console.error('Error updating season:', error);
      toast.error('Error al actualizar temporada');
      throw new Error('updateSeason failed');
    }
  };

  const deleteSeason = async (id: string) => {
    if (!team) return;
    const batch = writeBatch(db);

    const psSnap = await getDocs(
      query(collection(db, 'playerSeasons'), where('teamId', '==', team.id), where('seasonId', '==', id))
    );
    psSnap.docs.forEach(d => batch.delete(d.ref));

    const oppsSnap = await getDocs(
      query(collection(db, 'opponents'), where('teamId', '==', team.id), where('seasonIds', 'array-contains', id))
    );
    oppsSnap.docs.forEach(d => batch.update(d.ref, { seasonIds: arrayRemove(id) }));

    const matchesSnap = await getDocs(
      query(collection(db, 'matches'), where('teamId', '==', team.id), where('seasonId', '==', id))
    );
    const matchIds = matchesSnap.docs.map(d => d.id);
    matchesSnap.docs.forEach(d => batch.delete(d.ref));

    const statsSnap = await getDocs(
      query(collection(db, 'playerStats'), where('teamId', '==', team.id), where('seasonId', '==', id))
    );
    statsSnap.docs.forEach(d => batch.delete(d.ref));

    if (matchIds.length > 0) {
      for (const chunk of chunkArray(matchIds, 10)) {
        const lineupsSnap = await getDocs(
          query(collection(db, 'lineups'), where('teamId', '==', team.id), where('matchId', 'in', chunk))
        );
        lineupsSnap.docs.forEach(d => batch.delete(d.ref));
      }
    }

    batch.delete(doc(db, 'seasons', id));

    try {
      await batch.commit();
      toast.success('Temporada y todos sus datos asociados eliminados');
    } catch (error) {
      console.error('Error deleting season:', error);
      toast.error('Error al eliminar temporada');
      throw new Error('deleteSeason failed');
    }
  };

  return { addSeason, updateSeason, deleteSeason };
}
