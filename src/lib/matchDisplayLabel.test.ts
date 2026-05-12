import { describe, expect, it } from 'vitest';
import {
  formatMatchDate,
  formatMatchOptionLabel,
  formatMatchRowSubtitle,
  getOpponentName,
  getSeasonName,
  matchRoundLabel,
} from './matchDisplayLabel';
import type { Match, Opponent, Season } from '../types';

describe('formatMatchOptionLabel', () => {
  const seasons: Season[] = [
    { id: 's1', teamId: 't1', name: '2025/26', division: 'Primera', startYear: 2025 },
  ];
  const opponents: Opponent[] = [{ id: 'o1', teamId: 't1', name: 'CD Rival' }];

  it('includes round type rival and optional home', () => {
    const match: Match = {
      id: 'm1',
      teamId: 't1',
      seasonId: 's1',
      opponentId: 'o1',
      date: '2026-03-15T19:30:00.000Z',
      status: 'scheduled',
      type: 'league',
      round: '8',
      isHome: true,
    };
    const label = formatMatchOptionLabel(match, seasons, opponents);
    expect(label).toContain('Jornada 8');
    expect(label).toContain('vs CD Rival');
    expect(label).toContain('Primera');
    expect(label).toContain('Casa');
  });

  it('uses Amistoso when type is not league or cup', () => {
    const match: Match = {
      id: 'm2',
      teamId: 't1',
      seasonId: 's1',
      opponentId: 'unknown-opp',
      date: '2026-04-01T10:00:00.000Z',
      status: 'scheduled',
      type: 'friendly',
    };
    const label = formatMatchOptionLabel(match, seasons, []);
    expect(label).toContain('Amistoso');
    expect(label).toContain('vs Rival');
  });
});

describe('getOpponentName', () => {
  const opponents: Opponent[] = [{ id: 'o1', teamId: 't1', name: '  CD X  ' }];
  it('trims name', () => {
    expect(getOpponentName(opponents, 'o1')).toBe('CD X');
  });
  it('returns fallback', () => {
    expect(getOpponentName(opponents, 'missing', 'N/A')).toBe('N/A');
  });
  it('resolves from Map', () => {
    const map = new Map<string, Opponent>([
      ['o1', { id: 'o1', teamId: 't1', name: 'FromMap' }],
    ]);
    expect(getOpponentName(map, 'o1')).toBe('FromMap');
  });
});

describe('getSeasonName', () => {
  const seasons: Season[] = [{ id: 's1', teamId: 't1', name: '2025/26', startYear: 2025 }];
  it('returns all label for all token', () => {
    expect(getSeasonName(seasons, 'all')).toBe('Todas las temporadas');
  });
  it('returns season name', () => {
    expect(getSeasonName(seasons, 's1')).toBe('2025/26');
  });
  it('resolves from Map', () => {
    const map = new Map<string, Season>([['s1', { id: 's1', teamId: 't1', name: 'MapSeason', startYear: 2025 }]]);
    expect(getSeasonName(map, 's1')).toBe('MapSeason');
  });
});

describe('formatMatchDate', () => {
  const m = { date: '2026-06-02T15:00:00.000Z' };
  it('formats listCompact', () => {
    expect(formatMatchDate(m, 'listCompact')).toMatch(/02\/06\/26/);
  });
  it('formats listTime', () => {
    expect(formatMatchDate(m, 'listTime')).toMatch(/\d{1,2}:\d{2}/);
  });
  it('formats listDayMonthShortYear', () => {
    expect(formatMatchDate(m, 'listDayMonthShortYear')).toMatch(/02/);
  });
});

describe('matchRoundLabel', () => {
  it('returns league jornada', () => {
    expect(matchRoundLabel({ type: 'league', round: '3' })).toBe('Jornada 3');
  });
});

describe('formatMatchRowSubtitle', () => {
  const seasons: Season[] = [{ id: 's1', teamId: 't1', name: 'X', startYear: 2025 }];
  const opponents: Opponent[] = [{ id: 'o1', teamId: 't1', name: 'Rival' }];
  const match: Match = {
    id: 'm1',
    teamId: 't1',
    seasonId: 's1',
    opponentId: 'o1',
    date: '2026-01-05T12:00:00.000Z',
    status: 'scheduled',
    type: 'league',
    round: '1',
  };
  it('joins date round and rival', () => {
    const s = formatMatchRowSubtitle(match, seasons, opponents);
    expect(s).toContain('vs Rival');
    expect(s).toContain('Jornada 1');
  });
});
