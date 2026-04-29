import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase';
import type { Team } from '../types';

export function useFieldActions(team: Team | null) {
  const addField = async (name: string, location?: string) => {
    if (!team) return;
    try {
      await addDoc(collection(db, 'fields'), { teamId: team.id, name, location: location || null });
      toast.success('Campo añadido');
    } catch {
      toast.error('Error al añadir campo');
      throw new Error('addField failed');
    }
  };

  const updateField = async (id: string, name: string, location?: string) => {
    try {
      await updateDoc(doc(db, 'fields', id), { name, location: location || null });
      toast.success('Campo actualizado');
    } catch {
      toast.error('Error al actualizar campo');
      throw new Error('updateField failed');
    }
  };

  const deleteField = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'fields', id));
      toast.success('Campo eliminado');
    } catch {
      toast.error('Error al eliminar campo');
      throw new Error('deleteField failed');
    }
  };

  return { addField, updateField, deleteField };
}
