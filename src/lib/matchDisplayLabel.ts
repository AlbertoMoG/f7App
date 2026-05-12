import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Match, Opponent, Season } from '@/types';

const ES = { locale: es };

export type OpponentLookup = Opponent[] | ReadonlyMap<string, Opponent>;
export type SeasonLookup = Season[] | ReadonlyMap<string, Season>;

function resolveOpponent(lookup: OpponentLookup, id: string): Opponent | undefined {
  if (Array.isArray(lookup)) return lookup.find((o) => o.id === id);
  return lookup.get(id);
}

function resolveSeason(lookup: SeasonLookup, id: string): Season | undefined {
  if (Array.isArray(lookup)) return lookup.find((s) => s.id === id);
  return lookup.get(id);
}

/** Display presets for match dates (Spanish locale, consistent across app). */
export type MatchDateFormatPreset =
  | 'listCompact' /** dd/MM/yy */
  | 'listMedium' /** dd MMM yyyy */
  | 'listMediumWithTime' /** dd MMM yyyy · HH:mm */
  | 'listWeekday' /** EEEE */
  | 'listWeekdayShort' /** EEE */
  | 'listDayMonth' /** dd MMM */
  | 'listDayMonthCommaTime' /** d MMM, HH:mm */
  | 'listDayOfMonth' /** d (calendar cell) */
  | 'listDayOfMonthPadded' /** dd */
  | 'listTime' /** HH:mm */
  | 'dashboardDate' /** d MMM, yyyy */
  | 'headerFull' /** dd MMMM yyyy */
  | 'numericDate' /** dd/MM */
  | 'chartDay' /** d MMM */
  | 'chartNumeric' /** dd/MM */
  | 'longWeekdayDate' /** PPPP */
  | 'calendarMonthYear' /** MMMM yyyy */
  | 'deleteDialogDate' /** d 'de' MMMM yyyy */
  | 'pickerRow' /** EEE d MMM yyyy · HH:mm */
  | 'listDayMonthShortYear' /** dd MMM yy */
  | 'birthDateDisplay' /** dd/MM/yyyy */
  | 'injuryDateTime' /** dd MMM yyyy HH:mm */
  | 'opponentListSpanishDate'; /** d 'de' MMMM, yyyy */

export function formatDatePreset(dateInput: string | Date, preset: MatchDateFormatPreset): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  switch (preset) {
    case 'listCompact':
      return format(d, 'dd/MM/yy', ES);
    case 'listMedium':
      return format(d, 'dd MMM yyyy', ES);
    case 'listMediumWithTime':
      return format(d, 'dd MMM yyyy · HH:mm', ES);
    case 'listWeekday':
      return format(d, 'EEEE', ES);
    case 'listWeekdayShort':
      return format(d, 'EEE', ES);
    case 'listDayMonth':
      return format(d, 'dd MMM', ES);
    case 'listDayMonthCommaTime':
      return format(d, 'd MMM, HH:mm', ES);
    case 'listDayOfMonth':
      return format(d, 'd', ES);
    case 'listDayOfMonthPadded':
      return format(d, 'dd', ES);
    case 'listTime':
      return format(d, 'HH:mm', ES);
    case 'dashboardDate':
      return format(d, 'd MMM, yyyy', ES);
    case 'headerFull':
      return format(d, 'dd MMMM yyyy', ES);
    case 'numericDate':
      return format(d, 'dd/MM', ES);
    case 'chartDay':
      return format(d, 'd MMM', ES);
    case 'chartNumeric':
      return format(d, 'dd/MM', ES);
    case 'longWeekdayDate':
      return format(d, 'PPPP', ES);
    case 'calendarMonthYear':
      return format(d, 'MMMM yyyy', ES);
    case 'deleteDialogDate':
      return format(d, "d 'de' MMMM yyyy", ES);
    case 'pickerRow':
      return format(d, 'EEE d MMM yyyy · HH:mm', ES);
    case 'listDayMonthShortYear':
      return format(d, 'dd MMM yy', ES);
    case 'birthDateDisplay':
      return format(d, 'dd/MM/yyyy', ES);
    case 'injuryDateTime':
      return format(d, 'dd MMM yyyy HH:mm', ES);
    case 'opponentListSpanishDate':
      return format(d, "d 'de' MMMM, yyyy", ES);
  }
}

export function formatMatchDate(match: Pick<Match, 'date'>, preset: MatchDateFormatPreset): string {
  return formatDatePreset(match.date, preset);
}

export function getOpponentName(
  opponents: OpponentLookup,
  opponentId: string | undefined | null,
  fallback = '—'
): string {
  if (!opponentId) return fallback;
  const name = resolveOpponent(opponents, opponentId)?.name?.trim();
  return name || fallback;
}

export function getSeasonName(
  seasons: SeasonLookup,
  seasonId: string | undefined | null,
  options?: { allToken?: string; allLabel?: string; missingLabel?: string }
): string {
  const allToken = options?.allToken ?? 'all';
  const allLabel = options?.allLabel ?? 'Todas las temporadas';
  const missing = options?.missingLabel ?? '—';
  if (!seasonId || seasonId === allToken) return allLabel;
  return resolveSeason(seasons, seasonId)?.name?.trim() || missing;
}

/** Jornada / ronda / amistoso (sin fecha). */
export function matchRoundLabel(match: Pick<Match, 'type' | 'round'>): string {
  if (match.type === 'league') return `Jornada ${match.round ?? '?'}`;
  if (match.type === 'cup') return `Ronda ${match.round ?? '?'}`;
  return 'Amistoso';
}

/** One-line subtitle: date (medium) · round · vs rival. */
export function formatMatchRowSubtitle(
  match: Match,
  seasons: SeasonLookup,
  opponents: OpponentLookup
): string {
  const dateStr = formatMatchDate(match, 'listMedium');
  const round = matchRoundLabel(match);
  const rival = getOpponentName(opponents, match.opponentId, 'Rival');
  const division = resolveSeason(seasons, match.seasonId)?.division?.trim();
  const parts = [dateStr, round];
  if (division) parts.push(division);
  parts.push(`vs ${rival}`);
  return parts.join(' · ');
}

/** Single-line label for match pickers: date, round/type, rival, optional home/away. */
export function formatMatchOptionLabel(match: Match, seasons: SeasonLookup, opponents: OpponentLookup): string {
  const rival = getOpponentName(opponents, match.opponentId, 'Rival');
  const dateStr = formatDatePreset(match.date, 'pickerRow');
  const roundLabel = matchRoundLabel(match);
  const season = resolveSeason(seasons, match.seasonId);
  const division = season?.division?.trim();
  const home = match.isHome === true ? 'Casa' : match.isHome === false ? 'Fuera' : '';
  const parts = [dateStr, roundLabel];
  if (division) parts.push(division);
  parts.push(`vs ${rival}`);
  if (home) parts.push(home);
  return parts.join(' · ');
}
