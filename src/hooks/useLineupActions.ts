import { collection, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase';
import type { Lineup, Team } from '../types';

export function useLineupActions(team: Team | null) {
  const saveLineup = async (l: Omit<Lineup, 'id' | 'teamId'>) => {
    if (!team) return;
    try {
      await addDoc(collection(db, 'lineups'), { ...l, teamId: team.id });
      toast.success('Alineación guardada');
    } catch {
      toast.error('Error al guardar alineación');
      throw new Error('saveLineup failed');
    }
  };

  const deleteLineup = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'lineups', id));
      toast.success('Alineación eliminada');
    } catch {
      toast.error('Error al eliminar alineación');
      throw new Error('deleteLineup failed');
    }
  };

  return { saveLineup, deleteLineup };
}
