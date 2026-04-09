import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Player, Opponent, Match, PlayerStat, Lineup } from '../types';

export const cleanupDatabase = async () => {
  let updatesCount = 0;
  let deletesCount = 0;

  // 1. Fetch all current valid IDs
  const [seasonsSnap, playersSnap, opponentsSnap, matchesSnap, statsSnap, lineupsSnap] = await Promise.all([
    getDocs(collection(db, 'seasons')),
    getDocs(collection(db, 'players')),
    getDocs(collection(db, 'opponents')),
    getDocs(collection(db, 'matches')),
    getDocs(collection(db, 'playerStats')),
    getDocs(collection(db, 'lineups'))
  ]);

  const validSeasonIds = new Set(seasonsSnap.docs.map(d => d.id));
  const validPlayerIds = new Set(playersSnap.docs.map(d => d.id));
  const validOpponentIds = new Set(opponentsSnap.docs.map(d => d.id));
  const validMatchIds = new Set(matchesSnap.docs.map(d => d.id));

  const operations: { type: 'update' | 'delete', ref: any, data?: any }[] = [];

  // 2. Clean Players (orphaned seasonIds)
  playersSnap.docs.forEach(d => {
    const data = d.data() as Player;
    if (data.seasonIds) {
      const validIds = data.seasonIds.filter(id => validSeasonIds.has(id));
      if (validIds.length !== data.seasonIds.length) {
        operations.push({ type: 'update', ref: d.ref, data: { seasonIds: validIds } });
        updatesCount++;
      }
    }
  });

  // 3. Clean Opponents (orphaned seasonIds)
  opponentsSnap.docs.forEach(d => {
    const data = d.data() as Opponent;
    if (data.seasonIds) {
      const validIds = data.seasonIds.filter(id => validSeasonIds.has(id));
      if (validIds.length !== data.seasonIds.length) {
        operations.push({ type: 'update', ref: d.ref, data: { seasonIds: validIds } });
        updatesCount++;
      }
    }
  });

  // 4. Clean Matches (orphaned seasonId or opponentId)
  matchesSnap.docs.forEach(d => {
    const data = d.data() as Match;
    if (!validSeasonIds.has(data.seasonId) || !validOpponentIds.has(data.opponentId)) {
      operations.push({ type: 'delete', ref: d.ref });
      deletesCount++;
      validMatchIds.delete(d.id);
    }
  });

  // 5. Clean PlayerStats (orphaned playerId, matchId, or seasonId)
  statsSnap.docs.forEach(d => {
    const data = d.data() as PlayerStat;
    if (!validPlayerIds.has(data.playerId) || !validMatchIds.has(data.matchId) || !validSeasonIds.has(data.seasonId)) {
      operations.push({ type: 'delete', ref: d.ref });
      deletesCount++;
    }
  });

  // 6. Clean Lineups
  lineupsSnap.docs.forEach(d => {
    const data = d.data() as Lineup;
    let needsUpdate = false;
    let shouldDelete = false;

    if (data.matchId && !validMatchIds.has(data.matchId)) {
      shouldDelete = true;
    }

    if (shouldDelete) {
      operations.push({ type: 'delete', ref: d.ref });
      deletesCount++;
    } else {
      const newBench = data.benchPlayerIds?.filter(id => validPlayerIds.has(id)) || [];
      if (data.benchPlayerIds && newBench.length !== data.benchPlayerIds.length) {
        needsUpdate = true;
      }

      const newSlots = data.slots.map(slot => {
        if (slot.playerId && !validPlayerIds.has(slot.playerId)) {
          needsUpdate = true;
          return { ...slot, playerId: null };
        }
        return slot;
      });

      if (needsUpdate) {
        operations.push({ type: 'update', ref: d.ref, data: { benchPlayerIds: newBench, slots: newSlots } });
        updatesCount++;
      }
    }
  });

  // Execute in chunks of 500 (Firestore batch limit)
  const chunkSize = 500;
  for (let i = 0; i < operations.length; i += chunkSize) {
    const chunk = operations.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(op => {
      if (op.type === 'update') {
        batch.update(op.ref, op.data);
      } else {
        batch.delete(op.ref);
      }
    });
    await batch.commit();
  }
  
  return { updatesCount, deletesCount };
};
