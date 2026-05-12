import { describe, expect, it } from 'vitest';
import {
  OUTFIELD_SLOT_MAX,
  OUTFIELD_SLOT_MIN,
  buildOptimalRecommendedSquad,
  getFormationLineMinimums,
  squadMeanBaremo,
} from './optimalRecommendedSquad';
import type { Match, Player } from '../types';
import type { PlayerRating } from '../types/aiAnalysis';

describe('squadMeanBaremo', () => {
  it('returns 0 for empty squad', () => {
    expect(squadMeanBaremo([], [], 70)).toBe(0);
  });

  it('averages ratings with fallback for missing ids', () => {
    const p1 = { id: 'a', teamId: 't', firstName: 'A', lastName: 'A', number: 1, position: 'Medio' as const, birthDate: '2000-01-01' };
    const p2 = { id: 'b', teamId: 't', firstName: 'B', lastName: 'B', number: 2, position: 'Medio' as const, birthDate: '2000-01-01' };
    const ratings: PlayerRating[] = [{ id: 'a', rating: 80 }];
    expect(squadMeanBaremo([p1, p2], ratings, 60)).toBe(70);
  });
});

describe('getFormationLineMinimums', () => {
  it('returns 2-3-1 line counts', () => {
    expect(getFormationLineMinimums('2-3-1')).toEqual({ def: 2, mid: 3, fwd: 1 });
  });
});

describe('buildOptimalRecommendedSquad', () => {
  it('returns empty squad when no roster for season', () => {
    const res = buildOptimalRecommendedSquad({
      players: [],
      playerSeasons: [],
      seasonId: 's1',
      stats: [],
      injuries: [],
      allPlayerRatings: [],
      teamAvgBaremo: 70,
      synergyMap: new Map(),
      formation: '2-3-1',
      outfieldSlots: 10,
      predGF: 1.5,
      predGC: 1.5,
    });
    expect(res.squad).toEqual([]);
    expect(res.notes.some((n) => n.includes('No hay jugadores elegibles'))).toBe(true);
  });

  it('respects outfield slot bounds constant range', () => {
    expect(OUTFIELD_SLOT_MIN).toBe(10);
    expect(OUTFIELD_SLOT_MAX).toBe(12);
  });
});
