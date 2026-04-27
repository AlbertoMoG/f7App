/**
 * Realiza una división segura evitando divisiones por cero o resultados no finitos.
 * @param numerator Numerador.
 * @param denominator Denominador.
 * @param fallback Valor de retorno en caso de error (por defecto 0).
 * @returns Resultado de la división o el valor fallback.
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (denominator === 0 || !isFinite(denominator)) return fallback;
  const result = numerator / denominator;
  return isFinite(result) ? result : fallback;
}
