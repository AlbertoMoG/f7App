import { describe, expect, it } from 'vitest';
import { toLineupByMatchIdMap, toOpponentMap } from './entityIndex';
import type { Lineup, Opponent } from '../types';

describe('entityIndex', () => {
  it('toOpponentMap', () => {
    const list: Opponent[] = [
      { id: 'a', teamId: 't', name: 'A' },
      { id: 'b', teamId: 't', name: 'B' },
    ];
    const m = toOpponentMap(list);
    expect(m.get('a')?.name).toBe('A');
    expect(m.size).toBe(2);
  });

  it('toLineupByMatchIdMap keeps first per matchId', () => {
    const lineups: Lineup[] = [
      { id: 'l1', teamId: 't', name: 'X', formation: '2-3-1', slots: [], matchId: 'm1', createdAt: '' },
      { id: 'l2', teamId: 't', name: 'Y', formation: '2-3-1', slots: [], matchId: 'm1', createdAt: '' },
    ];
    const m = toLineupByMatchIdMap(lineups);
    expect(m.get('m1')?.id).toBe('l1');
  });
});
