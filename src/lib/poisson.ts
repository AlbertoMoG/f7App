/**
 * Calcula la probabilidad de Poisson.
 */
export function poisson(lambda: number, k: number): number {
  const L = Math.exp(-lambda);
  let p = 1.0;
  for (let i = 1; i <= k; i++) {
    p *= lambda / i;
  }
  return p * L;
}

/**
 * Calcula el resultado más probable dado un lambda de goles a favor (GF) y goles en contra (GC).
 */
export function getMostProbableScore(predGF: number, predGC: number): { team: number; opponent: number } {
  let maxProb = -1;
  let score = { team: 0, opponent: 0 };

  // Limitamos a 8 goles para la búsqueda del más probable
  const LIMIT = 8;
  for (let i = 0; i <= LIMIT; i++) {
    for (let j = 0; j <= LIMIT; j++) {
      const prob = poisson(predGF, i) * poisson(predGC, j);
      if (prob > maxProb) {
        maxProb = prob;
        score = { team: i, opponent: j };
      }
    }
  }
  return score;
}
