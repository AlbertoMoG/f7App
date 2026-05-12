import { describe, expect, it } from 'vitest';
import {
  calculatePlayerRating,
  PESO_COMPROMISO,
  PESO_DESEMPENO,
  PUNTOS_VICTORIA,
} from './ratingSystem';
import type { Match, Player, PlayerStat } from '../types';

const basePlayer = (over: Partial<Player> = {}): Player => ({
  id: 'p1',
  teamId: 't1',
  firstName: 'Test',
  lastName: 'Player',
  number: 9,
  position: 'Delantero',
  birthDate: '1995-03-01',
  ...over,
});

describe('calculatePlayerRating', () => {
  it('returns baseline final score when there are no completed matches', () => {
    const r = calculatePlayerRating([], [], [], basePlayer(), 'all', []);
    expect(r.partidosComputables).toBe(0);
    expect(r.partidosAsistidos).toBe(0);
    expect(r.notaCompromiso).toBe(100);
    const expected = Math.round(100 * PESO_COMPROMISO + 0 * PESO_DESEMPENO);
    expect(r.notaFinal).toBe(expected);
  });

  it('counts attending win and applies performance weight', () => {
    const match: Match = {
      id: 'm1',
      teamId: 't1',
      seasonId: 's1',
      opponentId: 'o1',
      date: '2026-01-10T18:00:00.000Z',
      status: 'completed',
      scoreTeam: 2,
      scoreOpponent: 0,
      type: 'league',
    };
    const stat: PlayerStat = {
      id: 'st1',
      teamId: 't1',
      playerId: 'p1',
      matchId: 'm1',
      seasonId: 's1',
      attendance: 'attending',
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    };
    const r = calculatePlayerRating([match], [], [stat], basePlayer(), 's1', []);
    expect(r.partidosAsistidos).toBe(1);
    expect(r.puntosTotales).toBeGreaterThanOrEqual(PUNTOS_VICTORIA);
    expect(r.notaFinal).toBeGreaterThan(Math.round(100 * PESO_COMPROMISO));
  });

  it('ignores scheduled matches for computables', () => {
    const scheduled: Match = {
      id: 'm2',
      teamId: 't1',
      seasonId: 's1',
      opponentId: 'o1',
      date: '2026-02-01T18:00:00.000Z',
      status: 'scheduled',
    };
    const r = calculatePlayerRating([scheduled], [], [], basePlayer(), 's1', []);
    expect(r.partidosComputables).toBe(0);
  });
});
