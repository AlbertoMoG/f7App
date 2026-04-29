import { collection, doc, query, where, getDocs, writeBatch, addDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase';
import type { Player, Injury, Team } from '../types';

export function usePlayerActions(team: Team | null) {
  const addPlayer = async (p: Omit<Player, 'id' | 'teamId'> & { seasonIds?: string[] }) => {
    if (!team) return;
    const { seasonIds, ...playerData } = p;
    const batch = writeBatch(db);
    const playerRef = doc(collection(db, 'players'));
    batch.set(playerRef, { ...playerData, teamId: team.id });
    if (seasonIds && seasonIds.length > 0) {
      seasonIds.forEach(seasonId => {
        const psRef = doc(collection(db, 'playerSeasons'));
        batch.set(psRef, { teamId: team.id, playerId: playerRef.id, seasonId });
      });
    }
    try {
      await batch.commit();
      toast.success('Jugador añadido correctamente');
    } catch {
      toast.error('Error al añadir jugador');
      throw new Error('addPlayer failed');
    }
  };

  const updatePlayer = async (p: Player, seasonIds: string[]) => {
    if (!team) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'players', p.id), { ...p });
    const psSnap = await getDocs(
      query(collection(db, 'playerSeasons'), where('teamId', '==', team.id), where('playerId', '==', p.id))
    );
    const existingSeasonIds = psSnap.docs.map(d => d.data().seasonId);
    psSnap.docs.forEach(d => {
      if (!seasonIds.includes(d.data().seasonId)) batch.delete(d.ref);
    });
    seasonIds.forEach(seasonId => {
      if (!existingSeasonIds.includes(seasonId)) {
        batch.set(doc(collection(db, 'playerSeasons')), { teamId: team.id, playerId: p.id, seasonId });
      }
    });
    try {
      await batch.commit();
      toast.success('Jugador actualizado correctamente');
    } catch {
      toast.error('Error al actualizar jugador');
      throw new Error('updatePlayer failed');
    }
  };

  const deletePlayer = async (id: string) => {
    if (!team) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'players', id));
    const psSnap = await getDocs(
      query(collection(db, 'playerSeasons'), where('teamId', '==', team.id), where('playerId', '==', id))
    );
    psSnap.docs.forEach(d => batch.delete(d.ref));
    try {
      await batch.commit();
      toast.success('Jugador eliminado');
    } catch {
      toast.error('Error al eliminar jugador');
      throw new Error('deletePlayer failed');
    }
  };

  const addInjury = async (injury: Omit<Injury, 'id' | 'teamId'>) => {
    if (!team) return;
    try {
      await addDoc(collection(db, 'injuries'), { ...injury, teamId: team.id });
      toast.success('Lesión registrada');
    } catch {
      toast.error('Error al registrar lesión');
      throw new Error('addInjury failed');
    }
  };

  const updateInjury = async (injury: Injury) => {
    const { id, ...injuryData } = injury;
    try {
      await updateDoc(doc(db, 'injuries', injury.id), injuryData);
      toast.success('Lesión actualizada');
    } catch {
      toast.error('Error al actualizar lesión');
      throw new Error('updateInjury failed');
    }
  };

  return { addPlayer, updatePlayer, deletePlayer, addInjury, updateInjury };
}
