import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase';
import type { Team } from '../types';

export function useOpponentActions(team: Team | null) {
  const addOpponent = async (name: string, shieldUrl?: string, seasonIds: string[] = []) => {
    if (!team) return;
    try {
      await addDoc(collection(db, 'opponents'), {
        teamId: team.id, name,
        shieldUrl: shieldUrl || null,
        seasonIds: seasonIds.length > 0 ? seasonIds : [],
      });
      toast.success('Rival añadido');
    } catch {
      toast.error('Error al añadir rival');
      throw new Error('addOpponent failed');
    }
  };

  const updateOpponent = async (id: string, name: string, shieldUrl?: string, seasonIds: string[] = []) => {
    try {
      await updateDoc(doc(db, 'opponents', id), {
        name,
        shieldUrl: shieldUrl || null,
        seasonIds: seasonIds.length > 0 ? seasonIds : [],
      });
      toast.success('Rival actualizado');
    } catch {
      toast.error('Error al actualizar rival');
      throw new Error('updateOpponent failed');
    }
  };

  const deleteOpponent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'opponents', id));
      toast.success('Rival eliminado');
    } catch {
      toast.error('Error al eliminar rival');
      throw new Error('deleteOpponent failed');
    }
  };

  return { addOpponent, updateOpponent, deleteOpponent };
}
