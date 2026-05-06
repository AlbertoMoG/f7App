import type { PositionBaremoFilledStudy } from '@/lib/baremoPositionStudy';

export function buildValoracionPositionHints(
  filled: PositionBaremoFilledStudy[],
  extraNotes: string[]
): string[] {
  const hints: string[] = [];
  const sortedByDelta = [...filled].sort((a, b) => a.deltaVsTeam - b.deltaVsTeam);

  for (const s of sortedByDelta) {
    if (s.deltaVsTeam <= -2.8) {
      hints.push(
        `${s.position}s: baremo medio de línea ${s.avgNotaFinal.toFixed(1)} (${s.deltaVsTeam.toFixed(1)} vs media del listado). Prioriza refuerzo o más minutos de calidad en esa demarcación.`
      );
    } else if (s.deltaVsTeam <= -1.3) {
      hints.push(
        `${s.position}s: ligeramente por debajo del resto de la vista filtrada; revisa competencia interna y continuidad.`
      );
    }
  }

  for (const s of filled) {
    if (s.lowSampleCount > 0 && s.lowSampleCount === s.count) {
      hints.push(
        `${s.position}s: toda la línea con señal de baja muestra; la lectura será volátil hasta acumular partidos.`
      );
    } else if (s.lowSampleCount >= 2) {
      hints.push(
        `${s.position}s: ${s.lowSampleCount}/${s.count} jugadores con baja fiabilidad estadística — valora mejoras sólo después de más datos reales.`
      );
    }
    if (s.count >= 3 && s.spreadBaremo >= 22) {
      hints.push(
        `${s.position}s: amplia dispersión (${s.minBaremo.toFixed(1)}–${s.maxBaremo.toFixed(
          1
        )}). Acotar titulares suele mejorar el baremo medio de línea en el modelo.`
      );
    }
  }

  if (sortedByDelta.length >= 2) {
    const weakest = sortedByDelta[0];
    const strongest = sortedByDelta[sortedByDelta.length - 1];
    if (
      weakest &&
      strongest &&
      weakest.position !== strongest.position &&
      strongest.deltaVsTeam - weakest.deltaVsTeam >= 4
    ) {
      hints.push(
        `Desbalance entre líneas: ${weakest.position}s muy por detrás respecto a ${strongest.position}s. Compensa con bloque medio o tácticas antes de cargar sólo un extremo del campo.`
      );
    }
  }

  const seen = new Set<string>();
  for (const n of extraNotes) {
    const t = n.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    hints.push(`Motores IA convocatoria: ${t}`);
  }

  const unique: string[] = [];
  const byText = new Set<string>();
  for (const h of hints) {
    if (byText.has(h)) continue;
    byText.add(h);
    unique.push(h);
  }
  return unique.slice(0, 12);
}
