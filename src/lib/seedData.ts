import { collection, addDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Position, Attendance, MatchStatus } from '../types';

export const seedDatabase = async () => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.log('No authenticated user; cannot seed');
      return false;
    }

    let teamId: string;
    const existingTeamSnap = await getDocs(
      query(collection(db, 'team'), where('ownerId', '==', uid), limit(1))
    );
    if (!existingTeamSnap.empty) {
      teamId = existingTeamSnap.docs[0].id;
    } else {
      const teamRef = await addDoc(collection(db, 'team'), {
        name: 'Los Galácticos FC',
        shieldUrl: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=400&h=400&fit=crop',
        ownerId: uid
      });
      teamId = teamRef.id;
    }

    const playersSnapshot = await getDocs(
      query(collection(db, 'players'), where('teamId', '==', teamId), limit(1))
    );
    if (!playersSnapshot.empty) {
      console.log('Database already seeded for this team');
      return false;
    }

    // 2. Seasons
    const season1Ref = await addDoc(collection(db, 'seasons'), { name: 'Temporada 2025/2026', startYear: 2025, teamId });
    const season2Ref = await addDoc(collection(db, 'seasons'), { name: 'Temporada 2024/2025', startYear: 2024, teamId });
    const currentSeasonId = season1Ref.id;

    // 3. Opponents
    const opp1Ref = await addDoc(collection(db, 'opponents'), { name: 'Rayo Vallecano F7', shieldUrl: 'https://images.unsplash.com/photo-1518605368461-1ee7116594ce?w=400&h=400&fit=crop', teamId, seasonIds: [currentSeasonId] });
    const opp2Ref = await addDoc(collection(db, 'opponents'), { name: 'Sporting de Vallecas', shieldUrl: 'https://images.unsplash.com/photo-1551280857-2b9bbe5260fc?w=400&h=400&fit=crop', teamId, seasonIds: [currentSeasonId] });
    const opp3Ref = await addDoc(collection(db, 'opponents'), { name: 'Atlético F7', shieldUrl: 'https://images.unsplash.com/photo-1508344928928-7165b67de128?w=400&h=400&fit=crop', teamId, seasonIds: [currentSeasonId] });

    // 4. Players
    const getBirthDate = (age: number) => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - age);
      return d.toISOString().split('T')[0];
    };

    const playersData = [
      { firstName: 'Iker', lastName: 'Casillas', number: 1, position: 'Portero' as Position, birthDate: getBirthDate(35), photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', teamId, _seasonIds: [currentSeasonId, season2Ref.id] },
      { firstName: 'Sergio', lastName: 'Ramos', number: 4, position: 'Defensa' as Position, birthDate: getBirthDate(34), photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop', teamId, _seasonIds: [currentSeasonId] },
      { firstName: 'Gerard', lastName: 'Piqué', number: 3, position: 'Defensa' as Position, birthDate: getBirthDate(33), photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop', teamId, _seasonIds: [currentSeasonId, season2Ref.id] },
      { firstName: 'Xavi', lastName: 'Hernández', number: 8, position: 'Medio' as Position, birthDate: getBirthDate(36), photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop', teamId, _seasonIds: [currentSeasonId] },
      { firstName: 'Andrés', lastName: 'Iniesta', number: 6, position: 'Medio' as Position, birthDate: getBirthDate(35), photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', teamId, _seasonIds: [currentSeasonId] },
      { firstName: 'Lionel', lastName: 'Messi', number: 10, position: 'Delantero' as Position, birthDate: getBirthDate(33), photoUrl: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop', teamId, _seasonIds: [currentSeasonId, season2Ref.id] },
      { firstName: 'Cristiano', lastName: 'Ronaldo', number: 7, position: 'Delantero' as Position, birthDate: getBirthDate(35), photoUrl: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&h=400&fit=crop', teamId, _seasonIds: [currentSeasonId] },
      { firstName: 'Fernando', lastName: 'Torres', number: 9, position: 'Delantero' as Position, birthDate: getBirthDate(34), photoUrl: 'https://images.unsplash.com/photo-1528892952291-009c663ce843?w=400&h=400&fit=crop', teamId, _seasonIds: [currentSeasonId], isInjured: true },
    ];

    const playerRefs = [];
    for (const p of playersData) {
      const { _seasonIds, ...playerDataToSave } = p;
      const ref = await addDoc(collection(db, 'players'), playerDataToSave);
      playerRefs.push({ id: ref.id, ...p });
      
      // Create PlayerSeason records
      for (const seasonId of _seasonIds) {
        await addDoc(collection(db, 'playerSeasons'), {
          teamId,
          playerId: ref.id,
          seasonId
        });
      }
    }

    // 5. Matches
    const match1Ref = await addDoc(collection(db, 'matches'), {
      teamId,
      seasonId: currentSeasonId,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      opponentId: opp1Ref.id,
      scoreTeam: 3,
      scoreOpponent: 1,
      status: 'completed' as MatchStatus,
      type: 'league',
      round: 'Jornada 1'
    });

    const match2Ref = await addDoc(collection(db, 'matches'), {
      teamId,
      seasonId: currentSeasonId,
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
      opponentId: opp2Ref.id,
      scoreTeam: 2,
      scoreOpponent: 2,
      status: 'completed' as MatchStatus,
      type: 'cup',
      round: 'Octavos de Final'
    });

    await addDoc(collection(db, 'matches'), {
      teamId,
      seasonId: currentSeasonId,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // in 2 days
      opponentId: opp3Ref.id,
      status: 'scheduled' as MatchStatus,
      type: 'friendly'
    });

    // 6. Stats for Match 1
    for (const p of playerRefs) {
      const isAttending = Math.random() > 0.2;
      if (isAttending) {
        await addDoc(collection(db, 'playerStats'), {
          teamId,
          playerId: p.id,
          matchId: match1Ref.id,
          seasonId: currentSeasonId,
          attendance: 'attending' as Attendance,
          goals: p.position === 'Delantero' ? Math.floor(Math.random() * 3) : 0,
          assists: p.position === 'Medio' ? Math.floor(Math.random() * 2) : 0,
          yellowCards: Math.random() > 0.8 ? 1 : 0,
          redCards: 0
        });
      } else {
        await addDoc(collection(db, 'playerStats'), {
          teamId,
          playerId: p.id,
          matchId: match1Ref.id,
          seasonId: currentSeasonId,
          attendance: 'notAttending' as Attendance,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0
        });
      }
    }

    // 7. Stats for Match 2
    for (const p of playerRefs) {
      const isAttending = Math.random() > 0.2;
      if (isAttending) {
        await addDoc(collection(db, 'playerStats'), {
          teamId,
          playerId: p.id,
          matchId: match2Ref.id,
          seasonId: currentSeasonId,
          attendance: 'attending' as Attendance,
          goals: p.position === 'Delantero' ? Math.floor(Math.random() * 2) : (p.position === 'Medio' ? 1 : 0),
          assists: p.position === 'Medio' ? Math.floor(Math.random() * 2) : 0,
          yellowCards: Math.random() > 0.9 ? 1 : 0,
          redCards: 0
        });
      }
    }

    return true;
  } catch (error) {
    console.error("Error seeding database:", error);
    return false;
  }
};
