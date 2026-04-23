import { Match, PlayerStat, Injury, Player, Season } from '../types';

export interface PlayerRatingReport {
  partidosComputables: number;
  partidosLesionado: number;
  partidosJustificados: number;
  partidosAsistidos: number;
  partidosNoAsistencia: number;
  partidosSinRespuesta: number;
  partidosBajo4Goles: number;
  asistenciaEfectiva: number;
  rachaMaxima: number;
  rachaMaximaAusencias: number;
  bonoRegularidad: number;
  penalizacionRegularidad: number;
  notaCompromiso: number;
  notaDesempeno: number;
  notaDesempenoPura: number;
  factorFiabilidad: number;
  porcentajeParticipacion: number;
  notaFinal: number;
  puntosTotales: number;
  mediaPorPartido: number;
}

export const PESO_COMPROMISO = 0.55;
export const PESO_DESEMPENO = 0.45;
export const META_EXCELENCIA = 100;
export const BONO_REGULARIDAD_PUNTOS = 8;
export const BONO_REGULARIDAD_RACHA = 3;
export const PENALIZACION_REGULARIDAD_PUNTOS = 8;
export const PENALIZACION_REGULARIDAD_RACHA = 5;
export const PUNTOS_VICTORIA = 120;
export const PUNTOS_EMPATE = 50;
export const PUNTOS_DERROTA = 15;
export const PUNTOS_BAJO_4_GOLES = 40;
export const PUNTOS_GOL = 80;
export const PUNTOS_ASISTENCIA = 40;
export const PUNTOS_AMARILLA = -20;
export const PUNTOS_ROJA = -40;
export const PUNTOS_SIN_CONTESTAR = -10;
export const PUNTOS_NO_ASISTENCIA = -1.5;

export function calculatePlayerRating(
  matches: Match[],
  injuries: Injury[],
  playerStats: PlayerStat[],
  player: Player,
  seasonId?: string,
  seasons?: Season[]
): PlayerRatingReport {
  const playerId = player.id;
  // Filtrar partidos por temporada si se proporciona
  const filteredMatches = seasonId && seasonId !== 'all'
    ? matches.filter(m => m.seasonId === seasonId)
    : matches;

  // 1. Filtrar estadísticas del jugador y por temporada
  const stats = playerStats.filter(s => {
    if (s.playerId !== playerId) return false;
    if (seasonId && seasonId !== 'all') {
      return s.seasonId === seasonId;
    }
    return true;
  });
  
  // 2. Procesar Calendario y Lesiones (Solo partidos finalizados)
  const sortedMatches = [...filteredMatches]
    .filter(m => m.status === 'completed')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const partidosTotales = sortedMatches.length;

  // Obtener lesiones del jugador (filtradas por temporada si se proporciona)
  let playerInjuries = injuries.filter(i => i.playerId === playerId);

  if (seasonId && seasonId !== 'all') {
    const season = seasons?.find(s => s.id === seasonId);
    if (season && season.startYear) {
      const startYear = season.startYear;
      const seasonStart = new Date(startYear, 7, 1); 
      const seasonEnd = new Date(startYear + 1, 6, 31);
      
      playerInjuries = playerInjuries.filter(i => {
        if (i.seasonId === seasonId) return true;
        const injuryDate = new Date(i.startDate);
        return injuryDate >= seasonStart && injuryDate <= seasonEnd;
      });
    } else {
      playerInjuries = playerInjuries.filter(i => i.seasonId === seasonId);
    }
  }

  let partidosLesionado = 0;
  let partidosJustificados = 0;
  let partidosAsistidos = 0;
  let partidosBajo4Goles = 0;
  let noAsistencias = 0;
  let noContestados = 0;
  let maxStreak = 0;
  let currentStreak = 0;
  let maxAbsentStreak = 0;
  let currentAbsentStreak = 0;
  let hasStartedTenure = false;
  let partidosComputablesCount = 0;

  sortedMatches.forEach(match => {
    const fechaPartido = new Date(match.date);
    const estaLesionado = playerInjuries.some(injury => {
      const start = new Date(injury.startDate);
      const end = injury.endDate ? new Date(injury.endDate) : null;
      return fechaPartido >= start && (end === null || fechaPartido <= end);
    });

    const stat = stats.find(s => s.matchId === match.id);
    
    // Si no ha empezado su "tenure" (no tiene stats registradas ni está lesionado en este partido),
    // ignoramos este partido para el cálculo de su compromiso personal.
    if (!hasStartedTenure && !stat && !estaLesionado) {
      return;
    }
    
    hasStartedTenure = true;
    partidosComputablesCount++;

    if (estaLesionado) {
      partidosLesionado++;
      currentAbsentStreak = 0; // La lesión rompe la racha de ausencias
      // Estar lesionado no rompe la racha de regularidad, la mantiene
    } else {
      const attendance = stat?.attendance || 'noResponse';
      
      if (attendance === 'attending') {
        partidosAsistidos++;
        currentStreak++;
        currentAbsentStreak = 0;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        // Cualquier falta de asistencia (justificada, no asistencia, sin respuesta, duda) corta la racha positiva
        // y aumenta la racha negativa
        currentStreak = 0;
        currentAbsentStreak++;
        if (currentAbsentStreak > maxAbsentStreak) maxAbsentStreak = currentAbsentStreak;
        
        if (attendance === 'notAttending' || attendance === 'doubtful') {
          noAsistencias++;
        } else if (attendance === 'justified') {
          partidosJustificados++;
        } else if (attendance === 'noResponse') {
          noContestados++;
        }
      }
    }
  });

  const partidosComputables = partidosComputablesCount;
  const bonoRegularidad = Math.floor(maxStreak / BONO_REGULARIDAD_RACHA) * BONO_REGULARIDAD_PUNTOS;
  const penalizacionRegularidad = Math.floor(maxAbsentStreak / PENALIZACION_REGULARIDAD_RACHA) * PENALIZACION_REGULARIDAD_PUNTOS;

  // 4. Calcular Nota de Compromiso
  let notaCompromiso = 100;
  let asistenciaEfectiva = 0;
  if (partidosComputables > 0) {
    const penalizacionNoContestar = noContestados * PUNTOS_SIN_CONTESTAR;
    const penalizacionNoAsistencia = noAsistencias * PUNTOS_NO_ASISTENCIA;
    // Las lesiones cuentan como un 80% de asistencia (pequeña penalización frente a los que juegan)
    // Las ausencias justificadas cuentan como un 100% de asistencia (sin penalización)
    asistenciaEfectiva = partidosAsistidos + (partidosLesionado * 0.8) + partidosJustificados;
    notaCompromiso = Math.max(0, Math.min(100, Math.round(((asistenciaEfectiva / partidosComputables) * 100) + penalizacionNoContestar + penalizacionNoAsistencia)));
  }

  // 5. Calcular Media de Desempeño
  let puntosTotales = 0;
  stats.forEach(s => {
    if (s.attendance === 'attending') {
      const match = matches.find(m => m.id === s.matchId);
      if (match && match.status === 'completed') {
        const teamScore = match.scoreTeam || 0;
        const opponentScore = match.scoreOpponent || 0;
        
        if (teamScore > opponentScore) puntosTotales += PUNTOS_VICTORIA; // Victoria
        else if (teamScore === opponentScore) puntosTotales += PUNTOS_EMPATE; // Empate
        else puntosTotales += PUNTOS_DERROTA; // Derrota

        // Plus para porteros y defensas: Menos de 4 goles recibidos
        if ((player.position === 'Portero' || player.position === 'Defensa') && opponentScore < 4) {
          puntosTotales += PUNTOS_BAJO_4_GOLES;
          partidosBajo4Goles++;
        }
      }
      
      puntosTotales += (s.goals || 0) * PUNTOS_GOL;
      puntosTotales += (s.assists || 0) * PUNTOS_ASISTENCIA;
      puntosTotales += (s.yellowCards || 0) * PUNTOS_AMARILLA;
      puntosTotales += (s.redCards || 0) * PUNTOS_ROJA;
    }
  });

  const mediaPorPartido = partidosAsistidos > 0 ? puntosTotales / partidosAsistidos : 0;

  // 6. Calcular Nota de Desempeño Pura
  const notaDesempenoPura = Math.max(0, Math.min(100, Math.round((mediaPorPartido / META_EXCELENCIA) * 100)));

  // --- Factor de Participación (%) ---
  // Adecúa la nota de desempeño en base al porcentaje de asistencia sobre el total de partidos del equipo.
  // Evita que pocos partidos copen el podio, escalando la pureza de la nota del 60% al 100%.
  const porcentajeParticipacion = partidosTotales > 0 ? (partidosAsistidos / partidosTotales) : 1;
  const factorFiabilidad = 0.6 + (0.4 * porcentajeParticipacion); // Suaviza la nota sin masacrarla

  const notaDesempeno = Math.round(notaDesempenoPura * factorFiabilidad);

  // 7. Calcular Nota Final
  const notaPreliminar = (notaCompromiso * PESO_COMPROMISO) + (notaDesempeno * PESO_DESEMPENO) + bonoRegularidad - penalizacionRegularidad;
  const notaFinal = Math.max(0, Math.min(100, Math.round(notaPreliminar)));

  return {
    partidosComputables,
    partidosLesionado,
    partidosJustificados,
    partidosAsistidos,
    partidosNoAsistencia: noAsistencias,
    partidosSinRespuesta: noContestados,
    partidosBajo4Goles,
    asistenciaEfectiva: Math.round(asistenciaEfectiva),
    rachaMaxima: maxStreak,
    rachaMaximaAusencias: maxAbsentStreak,
    bonoRegularidad: Math.round(bonoRegularidad),
    penalizacionRegularidad: Math.round(penalizacionRegularidad),
    notaCompromiso: Math.round(notaCompromiso),
    notaDesempeno: Math.round(notaDesempeno),
    notaDesempenoPura: Math.round(notaDesempenoPura),
    factorFiabilidad: parseFloat(factorFiabilidad.toFixed(2)),
    porcentajeParticipacion: Math.round(porcentajeParticipacion * 100),
    notaFinal: Math.round(notaFinal),
    puntosTotales: Math.round(puntosTotales),
    mediaPorPartido: Math.round(mediaPorPartido)
  };
}
