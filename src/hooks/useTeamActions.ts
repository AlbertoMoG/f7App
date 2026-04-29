import { collection, doc, addDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { toast } from 'sonner';
import { db } from '../firebase';
import type { Team } from '../types';

export function useTeamActions(user: User | null) {
  const saveTeam = async (t: Omit<Team, 'id' | 'ownerId'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'team'), { ...t, ownerId: user.uid });
      toast.success('Equipo configurado correctamente');
    } catch {
      toast.error('Error al guardar el equipo');
      throw new Error('saveTeam failed');
    }
  };

  const updateTeam = async (t: Team) => {
    const { id, ...teamData } = t;
    try {
      await updateDoc(doc(db, 'team', t.id), teamData);
      toast.success('Ajustes del equipo actualizados');
    } catch {
      toast.error('Error al actualizar el equipo');
      throw new Error('updateTeam failed');
    }
  };

  return { saveTeam, updateTeam };
}
