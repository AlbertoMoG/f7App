import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Match, Opponent, Season } from '@/types';

/** Single-line label for match pickers: date, round/type, rival, optional home/away. */
export function formatMatchOptionLabel(match: Match, seasons: Season[], opponents: Opponent[]): string {
  const rival = opponents.find((o) => o.id === match.opponentId)?.name?.trim() || 'Rival';
  const dateStr = format(new Date(match.date), 'EEE d MMM yyyy · HH:mm', { locale: es });
  const roundLabel =
    match.type === 'league'
      ? `Jornada ${match.round ?? '?'}`
      : match.type === 'cup'
        ? `Ronda ${match.round ?? '?'}`
        : 'Amistoso';
  const season = seasons.find((s) => s.id === match.seasonId);
  const division = season?.division?.trim();
  const home = match.isHome === true ? 'Casa' : match.isHome === false ? 'Fuera' : '';
  const parts = [dateStr, roundLabel];
  if (division) parts.push(division);
  parts.push(`vs ${rival}`);
  if (home) parts.push(home);
  return parts.join(' · ');
}
