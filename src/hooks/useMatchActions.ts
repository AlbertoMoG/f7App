import { collection, doc, query, where, getDocs, writeBatch, addDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase';
import type { Match, PlayerStat, Team } from '../types';
import { isLeagueMatchCandidate } from '../lib/leagueStandingsAggregate';
import { findConflictingLeagueLeg } from '../lib/leagueMatchLegValidation';

export function useMatchActions(team: Team | null, matches: Match[]) {
  const addMatch = async (m: Omit<Match, 'id' | 'teamId'>) => {
    if (!team) return;
    if (
      isLeagueMatchCandidate(m.type, m.round) &&
      (m.isHome === true || m.isHome === false) &&
      findConflictingLeagueLeg(matches, {
        seasonId: m.seasonId,
        opponentId: m.opponentId,
        isHome: m.isHome,
      })
    ) {
      toast.error(
        'Ya existe un partido de liga con el mismo rival y la misma condición (local o visitante). Cambia uno de los dos o elimina el duplicado.'
      );
      throw new Error('duplicate league leg');
    }
    try {
      await addDoc(collection(db, 'matches'), { ...m, teamId: team.id });
      toast.success('Partido programado');
    } catch {
      toast.error('Error al programar partido');
      throw new Error('addMatch failed');
    }
  };

  const updateMatch = async (m: Match) => {
    if (
      isLeagueMatchCandidate(m.type, m.round) &&
      (m.isHome === true || m.isHome === false) &&
      findConflictingLeagueLeg(matches, {
        seasonId: m.seasonId,
        opponentId: m.opponentId,
        isHome: m.isHome,
        excludeMatchId: m.id,
      })
    ) {
      toast.error(
        'Ya existe otro partido de liga con el mismo rival y la misma condición (local o visitante).'
      );
      throw new Error('duplicate league leg');
    }
    const { id, ...matchData } = m;
    try {
      await updateDoc(doc(db, 'matches', m.id), matchData);
      toast.success('Partido actualizado');
    } catch {
      toast.error('Error al actualizar partido');
      throw new Error('updateMatch failed');
    }
  };

  const deleteMatch = async (id: string) => {
    if (!team) return;
    const statsSnap = await getDocs(
      query(collection(db, 'playerStats'), where('teamId', '==', team.id), where('matchId', '==', id))
    );
    const batch = writeBatch(db);
    statsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'matches', id));
    try {
      await batch.commit();
      toast.success('Partido y sus estadísticas eliminados correctamente');
    } catch (error) {
      console.error('Error deleting match and stats:', error);
      toast.error('Error al eliminar el partido y sus datos');
      throw new Error('deleteMatch failed');
    }
  };

  const updateStats = async (newStats: PlayerStat[]) => {
    if (!team) return;
    try {
      for (const stat of newStats) {
        if (stat.id) {
          const { id, ...statData } = stat;
          await updateDoc(doc(db, 'playerStats', stat.id), statData);
        } else {
          const { id, ...rest } = stat;
          await addDoc(collection(db, 'playerStats'), { ...rest, teamId: team.id });
        }
      }
      toast.success('Estadísticas actualizadas');
    } catch {
      toast.error('Error al actualizar estadísticas');
      throw new Error('updateStats failed');
    }
  };

  const updateAttendance = async (playerId: string, matchId: string, attendance: string) => {
    if (!team) return;
    const snap = await getDocs(
      query(
        collection(db, 'playerStats'),
        where('teamId', '==', team.id),
        where('playerId', '==', playerId),
        where('matchId', '==', matchId),
      )
    );
    try {
      if (!snap.empty) {
        const existing = snap.docs[0].data();
        const wasDoubtful = existing.wasDoubtful || attendance === 'doubtful';
        await updateDoc(snap.docs[0].ref, { attendance, wasDoubtful });
      } else {
        const match = matches.find(m => m.id === matchId);
        await addDoc(collection(db, 'playerStats'), {
          teamId: team.id,
          playerId,
          matchId,
          seasonId: match?.seasonId ?? '',
          attendance,
          wasDoubtful: attendance === 'doubtful',
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
        });
      }
      toast.success('Asistencia actualizada');
    } catch {
      toast.error('Error al actualizar asistencia');
      throw new Error('updateAttendance failed');
    }
  };

  return { addMatch, updateMatch, deleteMatch, updateStats, updateAttendance };
}
