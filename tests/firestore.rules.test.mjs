import fs from 'node:fs';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-f7app';
const OWNER_UID = 'owner-uid';
const OTHER_UID = 'other-uid';
const TEAM_ID = 'team-1';
const PLAYER_ID = 'player-1';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'team', TEAM_ID), {
      name: 'Team One',
      ownerId: OWNER_UID,
    });
    await setDoc(doc(db, 'team', 'team-2'), {
      name: 'Team Two',
      ownerId: OTHER_UID,
    });
    await setDoc(doc(db, 'players', PLAYER_ID), {
      teamId: TEAM_ID,
      firstName: 'Leo',
      lastName: 'Messi',
      number: 10,
      position: 'Delantero',
      birthDate: '1987-06-24',
    });
  });
});

after(async () => {
  await testEnv.cleanup();
});

describe('Firestore security rules', () => {
  it('denies read for unauthenticated user', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'players', PLAYER_ID)));
  });

  it('allows owner to read own team data', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(getDoc(doc(db, 'players', PLAYER_ID)));
  });

  it('denies read from another authenticated user', async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(db, 'players', PLAYER_ID)));
  });

  it('denies completed match creation without score', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'matches', 'match-no-score'), {
        teamId: TEAM_ID,
        seasonId: 'season-1',
        date: '2026-04-28',
        opponentId: 'opp-1',
        status: 'completed',
      })
    );
  });

  it('allows completed match creation with valid score', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'matches', 'match-with-score'), {
        teamId: TEAM_ID,
        seasonId: 'season-1',
        date: '2026-04-28',
        opponentId: 'opp-1',
        status: 'completed',
        scoreTeam: 2,
        scoreOpponent: 1,
      })
    );
  });

  it('denies leagueFixture with same home and away', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'leagueFixtures', 'fx-bad'), {
        teamId: TEAM_ID,
        seasonId: 'season-1',
        date: '2026-04-28',
        homeOpponentId: 'opp-a',
        awayOpponentId: 'opp-a',
        status: 'scheduled',
      })
    );
  });

  it('allows completed leagueFixture with scores', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'leagueFixtures', 'fx-ok'), {
        teamId: TEAM_ID,
        seasonId: 'season-1',
        date: '2026-04-28',
        homeOpponentId: 'opp-a',
        awayOpponentId: 'opp-b',
        status: 'completed',
        scoreHome: 3,
        scoreAway: 1,
      })
    );
  });

  it('denies player create without teamId', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'players', 'player-no-team'), {
        firstName: 'A',
        lastName: 'B',
        number: 1,
        position: 'Medio',
        birthDate: '2000-01-01',
      })
    );
  });

  it('denies owner moving player to another team they do not own', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      setDoc(
        doc(db, 'players', PLAYER_ID),
        {
          teamId: 'team-2',
          firstName: 'Leo',
          lastName: 'Messi',
          number: 10,
          position: 'Delantero',
          birthDate: '1987-06-24',
        },
        { merge: true }
      )
    );
  });

  it('denies match with invalid status value', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'matches', 'match-bad-status'), {
        teamId: TEAM_ID,
        seasonId: 'season-1',
        date: '2026-04-28',
        opponentId: 'opp-1',
        status: 'finished',
      })
    );
  });

  it('denies opponent create without required name shape', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'opponents', 'opp-bad'), {
        teamId: TEAM_ID,
        name: '',
      })
    );
  });

  it('allows scheduled match without scores', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'matches', 'match-scheduled'), {
        teamId: TEAM_ID,
        seasonId: 'season-1',
        date: '2026-05-01',
        opponentId: 'opp-1',
        status: 'scheduled',
      })
    );
  });

  it('enforces attendance enum with justified/doubtful support', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'playerStats', 'stat-1'), {
        teamId: TEAM_ID,
        playerId: PLAYER_ID,
        matchId: 'match-with-score',
        seasonId: 'season-1',
        attendance: 'doubtful',
      })
    );
    await assertFails(
      setDoc(doc(db, 'playerStats', 'stat-2'), {
        teamId: TEAM_ID,
        playerId: PLAYER_ID,
        matchId: 'match-with-score',
        seasonId: 'season-1',
        attendance: 'maybe',
      })
    );
  });
});
