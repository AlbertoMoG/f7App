import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, addDoc, query, where, getDocsFromServer } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { toast } from 'sonner';
import { db } from '../firebase';
import type {
  Player, Season, Opponent, Match, PlayerStat,
  Lineup, Team, Field, PlayerSeason, Injury,
  StandingsEntry, LeagueFixture,
} from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export interface FirestoreData {
  team: Team | null;
  players: Player[];
  playerSeasons: PlayerSeason[];
  seasons: Season[];
  opponents: Opponent[];
  matches: Match[];
  stats: PlayerStat[];
  lineups: Lineup[];
  fields: Field[];
  injuries: Injury[];
  standings: StandingsEntry[];
  leagueFixtures: LeagueFixture[];
  /** Fuerza lectura desde el servidor y actualiza el estado local (complementa los listeners en tiempo real). */
  syncDataFromServer: () => Promise<void>;
  isSyncingData: boolean;
}

export function useFirestoreData(user: User | null): FirestoreData {
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerSeasons, setPlayerSeasons] = useState<PlayerSeason[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [leagueFixtures, setLeagueFixtures] = useState<LeagueFixture[]>([]);
  const [isSyncingData, setIsSyncingData] = useState(false);

  const syncDataFromServer = useCallback(async () => {
    if (!user) return;
    setIsSyncingData(true);
    try {
      const teamSnap = await getDocsFromServer(
        query(collection(db, 'team'), where('ownerId', '==', user.uid))
      );
      if (teamSnap.empty) {
        toast.error('No hay equipo asociado a tu cuenta');
        return;
      }
      const currentTeam = { id: teamSnap.docs[0].id, ...teamSnap.docs[0].data() } as Team;
      setTeam(currentTeam);

      const tid = currentTeam.id;
      const [
        playersSnap,
        seasonsSnap,
        opponentsSnap,
        matchesSnap,
        statsSnap,
        lineupsSnap,
        fieldsSnap,
        playerSeasonsSnap,
        injuriesSnap,
        standingsSnap,
        leagueFixturesSnap,
      ] = await Promise.all([
        getDocsFromServer(query(collection(db, 'players'), where('teamId', '==', tid))),
        getDocsFromServer(query(collection(db, 'seasons'), where('teamId', '==', tid))),
        getDocsFromServer(query(collection(db, 'opponents'), where('teamId', '==', tid))),
        getDocsFromServer(query(collection(db, 'matches'), where('teamId', '==', tid))),
        getDocsFromServer(query(collection(db, 'playerStats'), where('teamId', '==', tid))),
        getDocsFromServer(query(collection(db, 'lineups'), where('teamId', '==', tid))),
        getDocsFromServer(query(collection(db, 'fields'), where('teamId', '==', tid))),
        getDocsFromServer(query(collection(db, 'playerSeasons'), where('teamId', '==', tid))),
        getDocsFromServer(query(collection(db, 'injuries'), where('teamId', '==', tid))),
        getDocsFromServer(query(collection(db, 'standings'), where('teamId', '==', tid))),
        getDocsFromServer(query(collection(db, 'leagueFixtures'), where('teamId', '==', tid))),
      ]);

      setPlayers(playersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Player)));
      setSeasons(seasonsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Season)));
      setOpponents(opponentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Opponent)));
      setMatches(matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Match)));
      setStats(statsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PlayerStat)));
      setLineups(lineupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Lineup)));
      setFields(fieldsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Field)));
      setPlayerSeasons(playerSeasonsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PlayerSeason)));
      setInjuries(injuriesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Injury)));
      setStandings(standingsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StandingsEntry)));
      setLeagueFixtures(leagueFixturesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueFixture)));

      toast.success('Datos sincronizados con Firestore');
    } catch (err) {
      console.error('syncDataFromServer:', err);
      handleFirestoreError(err, OperationType.LIST, 'sync-from-server');
      toast.error('No se pudo sincronizar. Comprueba la conexión.');
    } finally {
      setIsSyncingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let unsubPlayers: (() => void) | undefined;
    let unsubSeasons: (() => void) | undefined;
    let unsubOpponents: (() => void) | undefined;
    let unsubMatches: (() => void) | undefined;
    let unsubStats: (() => void) | undefined;
    let unsubLineups: (() => void) | undefined;
    let unsubFields: (() => void) | undefined;
    let unsubPlayerSeasons: (() => void) | undefined;
    let unsubInjuries: (() => void) | undefined;
    let unsubStandings: (() => void) | undefined;
    let unsubLeagueFixtures: (() => void) | undefined;

    const unsubTeam = onSnapshot(
      query(collection(db, 'team'), where('ownerId', '==', user.uid)),
      async (snapshot) => {
        if (!snapshot.empty) {
          const currentTeam = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Team;
          setTeam(currentTeam);

          unsubPlayers = onSnapshot(
            query(collection(db, 'players'), where('teamId', '==', currentTeam.id)),
            (snap) => setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Player))),
            (err) => handleFirestoreError(err, OperationType.LIST, 'players'),
          );
          unsubSeasons = onSnapshot(
            query(collection(db, 'seasons'), where('teamId', '==', currentTeam.id)),
            (snap) => setSeasons(snap.docs.map(d => ({ id: d.id, ...d.data() } as Season))),
            (err) => handleFirestoreError(err, OperationType.LIST, 'seasons'),
          );
          unsubOpponents = onSnapshot(
            query(collection(db, 'opponents'), where('teamId', '==', currentTeam.id)),
            (snap) => setOpponents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Opponent))),
            (err) => handleFirestoreError(err, OperationType.LIST, 'opponents'),
          );
          unsubMatches = onSnapshot(
            query(collection(db, 'matches'), where('teamId', '==', currentTeam.id)),
            (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Match))),
            (err) => handleFirestoreError(err, OperationType.LIST, 'matches'),
          );
          unsubStats = onSnapshot(
            query(collection(db, 'playerStats'), where('teamId', '==', currentTeam.id)),
            (snap) => setStats(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerStat))),
            (err) => handleFirestoreError(err, OperationType.LIST, 'playerStats'),
          );
          unsubLineups = onSnapshot(
            query(collection(db, 'lineups'), where('teamId', '==', currentTeam.id)),
            (snap) => setLineups(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lineup))),
            (err) => handleFirestoreError(err, OperationType.LIST, 'lineups'),
          );
          unsubFields = onSnapshot(
            query(collection(db, 'fields'), where('teamId', '==', currentTeam.id)),
            (snap) => setFields(snap.docs.map(d => ({ id: d.id, ...d.data() } as Field))),
            (err) => handleFirestoreError(err, OperationType.LIST, 'fields'),
          );
          unsubPlayerSeasons = onSnapshot(
            query(collection(db, 'playerSeasons'), where('teamId', '==', currentTeam.id)),
            (snap) => setPlayerSeasons(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerSeason))),
            (err) => handleFirestoreError(err, OperationType.LIST, 'playerSeasons'),
          );
          unsubInjuries = onSnapshot(
            query(collection(db, 'injuries'), where('teamId', '==', currentTeam.id)),
            (snap) => setInjuries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Injury))),
            (err) => handleFirestoreError(err, OperationType.LIST, 'injuries'),
          );
          unsubStandings = onSnapshot(
            query(collection(db, 'standings'), where('teamId', '==', currentTeam.id)),
            (snap) => setStandings(snap.docs.map(d => ({ id: d.id, ...d.data() } as StandingsEntry))),
            (err) => handleFirestoreError(err, OperationType.LIST, 'standings'),
          );
          unsubLeagueFixtures = onSnapshot(
            query(collection(db, 'leagueFixtures'), where('teamId', '==', currentTeam.id)),
            (snap) => setLeagueFixtures(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeagueFixture))),
            (err) => handleFirestoreError(err, OperationType.LIST, 'leagueFixtures'),
          );
        } else {
          try {
            await addDoc(collection(db, 'team'), { name: 'Mi Equipo Principal', ownerId: user.uid });
            toast.success('Equipo por defecto creado correctamente');
          } catch (err) {
            console.error('Default team creation error:', err);
            toast.error('Error al crear el equipo por defecto');
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'team'),
    );

    return () => {
      unsubTeam();
      unsubPlayers?.();
      unsubSeasons?.();
      unsubOpponents?.();
      unsubMatches?.();
      unsubStats?.();
      unsubLineups?.();
      unsubFields?.();
      unsubPlayerSeasons?.();
      unsubInjuries?.();
      unsubStandings?.();
      unsubLeagueFixtures?.();
    };
  }, [user]);

  return {
    team, players, playerSeasons, seasons, opponents,
    matches, stats, lineups, fields, injuries,
    standings, leagueFixtures,
    syncDataFromServer,
    isSyncingData,
  };
}
