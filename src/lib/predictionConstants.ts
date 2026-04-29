// constants for AI prediction model
/** Agresividad del ajuste del bias por aprendizaje automático (0-1) */
export const BIAS_LEARNING_RATE = 0.4;

/** Ventana de recencia en días. Partidos más antiguos que esto pesan 0 */
export const RECENCY_WINDOW_DAYS = 730; // 2 años

/** Número de partidos recientes usados para calibración del modelo */
export const CALIBRATION_MATCH_COUNT = 5;

/** Modificador de goles en contra cuando no hay portero especialista */
export const NO_GOALKEEPER_GC_MODIFIER = 1.35;

/** Modificador de goles a favor por cada delantero adicional (≥3) */
export const EXTRA_ATTACKERS_GF_MODIFIER = 1.15;

/** Penalización por goles a favor por baja de jugador clave */
export const KEY_PLAYER_MISSING_GF_PENALTY = 0.15;

/** Penalización por goles en contra por baja de jugador clave */
export const KEY_PLAYER_MISSING_GC_PENALTY = 0.10;

/** Win rate mínimo de un dúo para considerarlo "sinergia letal" */
export const SYNERGY_WIN_RATE_THRESHOLD = 0.70;

/** Partidos mínimos juntos para computar sinergia de dúo */
export const SYNERGY_MIN_MATCHES = 3;

/** Bonus de goles a favor por cada sinergia letal encontrada */
export const SYNERGY_GF_BONUS = 0.05;

/** Peso de las medias de temporada en la predicción final (0-1) */
export const STANDINGS_WEIGHT = 0.3;

/** Clamp del modificador de clasificación (min, max) */
export const STANDINGS_MODIFIER_CLAMP = { MIN: 0.7, MAX: 1.3 };

/** Partidos de liga neutra considerados para “forma reciente” del rival */
export const OPPONENT_LEAGUE_FORM_WINDOW = 5;

/** Clamp del ratio forma reciente vs temporada (evita saltos bruscos) */
export const OPPONENT_FORM_TREND_CLAMP = { MIN: 0.88, MAX: 1.12 };

/** Peso mín/máx al ponderar partidos del rival según fortaleza del oponente enfrentado */
export const OPPONENT_STRENGTH_WEIGHT_CLAMP = { MIN: 0.78, MAX: 1.22 };

/** Número de jugadores mínimos para activar la predicción */
export const MIN_PLAYERS_FOR_PREDICTION = 5;

/** Días de descanso considerados "fatiga" */
export const FATIGUE_DAYS_THRESHOLD = 4;

/** Días de descanso considerados "óptimo" */
export const REST_DAYS_THRESHOLD = 10;

/** Franjas de edad y sus modificadores */
export const AGE_MODIFIERS = {
  VERY_YOUNG: { maxAge: 22, modifier: 0.9 },
  PRIME: { minAge: 22, maxAge: 26, modifier: 1.05 },
  PEAK: { minAge: 26, maxAge: 32, modifier: 1.1 },
  VETERAN: { minAge: 32, modifier: 0.95 },
} as const;

export const GRADE_COLORS = {
  'S': 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  'S_DARK': 'bg-fuchsia-600 text-white border-fuchsia-700',
  'A': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'A_DARK': 'bg-emerald-600 text-white border-emerald-700',
  'B': 'bg-blue-100 text-blue-700 border-blue-200',
  'B_DARK': 'bg-blue-600 text-white border-blue-700',
  'C': 'bg-amber-100 text-amber-700 border-amber-200',
  'C_DARK': 'bg-amber-500 text-white border-amber-600',
  'D': 'bg-red-100 text-red-700 border-red-200',
  'D_DARK': 'bg-red-600 text-white border-red-700'
} as const;

export const posOrder: Record<string, number> = {
  'Portero': 1,
  'Defensa': 2,
  'Medio': 3,
  'Delantero': 4
};
