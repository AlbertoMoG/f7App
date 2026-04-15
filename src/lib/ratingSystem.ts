import { Match, PlayerStat, Injury, Player } from '../types';

export interface PlayerRatingReport {
  partidosComputables: number;
  partidosLesionado: number;
  partidosJustificados: number;
  partidosAsistidos: number;
  partidosBajo4Goles: number;
  asistenciaEfectiva: number;
  rachaMaxima: number;
  bonoRegularidad: number;
  notaCompromiso: number;
  notaDesempeno: number;
  notaFinal: number;
}

const PESO_COMPROMISO = 0.55;
const PESO_DESEMPENO = 0.45;
const META_EXCELENCIA = 10.0;
const BONO_REGULARIDAD_PUNTOS = 0.8;
const BONO_REGULARIDAD_RACHA = 3;
const PUNTOS_VICTORIA = 10;
const PUNTOS_EMPATE = 5;
const PUNTOS_DERROTA = 1.5;
const PUNTOS_BAJO_4_GOLES = 4;
const PUNTOS_GOL = 12.5;
const PUNTOS_ASISTENCIA = 4;
const PUNTOS_AMARILLA = -1;
const PUNTOS_ROJA = -3;
const PUNTOS_SIN_CONTESTAR = -2;
const PUNTOS_NO_ASISTENCIA = -0.15;

export function calculatePlayerRating(
  matches: Match[],
  injuries: Injury[],
  playerStats: PlayerStat[],
  player: Player,
  seasonId?: string
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

  // Obtener lesiones del jugador
  const playerInjuries = injuries.filter(i => i.playerId === playerId);

  let partidosLesionado = 0;
  let partidosJustificados = 0;
  let partidosAsistidos = 0;
  let partidosBajo4Goles = 0;
  let noAsistencias = 0;
  let noContestados = 0;
  let maxStreak = 0;
  let currentStreak = 0;

  sortedMatches.forEach(match => {
    const fechaPartido = new Date(match.date);
    const estaLesionado = playerInjuries.some(injury => {
      const start = new Date(injury.startDate);
      const end = injury.endDate ? new Date(injury.endDate) : null;
      return fechaPartido >= start && (end === null || fechaPartido <= end);
    });

    if (estaLesionado) {
      partidosLesionado++;
    } else {
      const stat = stats.find(s => s.matchId === match.id);
      const attendance = stat?.attendance || 'noResponse';
      
      if (attendance === 'attending') {
        partidosAsistidos++;
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else if (attendance === 'justified') {
        partidosJustificados++;
        // Justified doesn't break the streak, but doesn't increment it either
        // unless the user wants it to count as "regularity".
        // Given "no puede ser regular por motivos justificados", 
        // let's make it NOT break the streak.
      } else if (attendance === 'notAttending') {
        noAsistencias++;
        currentStreak = 0;
      } else {
        currentStreak = 0;
        // Si no hay registro o es 'noResponse', se considera no contestado
        if (attendance === 'noResponse') {
          noContestados++;
        }
      }
    }
  });

  const partidosComputables = partidosTotales;
  const bonoRegularidad = Math.floor(maxStreak / BONO_REGULARIDAD_RACHA) * BONO_REGULARIDAD_PUNTOS;

  // 4. Calcular Nota de Compromiso
  let notaCompromiso = 10;
  let asistenciaEfectiva = 0;
  if (partidosComputables > 0) {
    const penalizacionNoContestar = noContestados * PUNTOS_SIN_CONTESTAR;
    const penalizacionNoAsistencia = noAsistencias * PUNTOS_NO_ASISTENCIA;
    // Las lesiones cuentan como un 75% de asistencia (penalización reducida un 75%)
    // Las ausencias justificadas cuentan como un 100% de asistencia (sin penalización)
    asistenciaEfectiva = partidosAsistidos + (partidosLesionado * 0.50) + (partidosJustificados * 1.0);
    notaCompromiso = Math.max(0, Math.min(10, ((asistenciaEfectiva / partidosComputables) * 10) + penalizacionNoContestar + penalizacionNoAsistencia));
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

        // Plus para porteros: Menos de 4 goles recibidos
        if (player.position === 'Portero' && opponentScore < 4) {
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

  // 6. Calcular Nota de Desempeño
  const notaDesempeno = Math.max(0, Math.min(10, (mediaPorPartido / META_EXCELENCIA) * 10));

  // 7. Calcular Nota Final
  const notaFinal = Math.min(10, (notaCompromiso * PESO_COMPROMISO) + (notaDesempeno * PESO_DESEMPENO) + bonoRegularidad);

  return {
    partidosComputables,
    partidosLesionado,
    partidosJustificados,
    partidosAsistidos,
    partidosBajo4Goles,
    asistenciaEfectiva: parseFloat(asistenciaEfectiva.toFixed(2)),
    rachaMaxima: maxStreak,
    bonoRegularidad: parseFloat(bonoRegularidad.toFixed(2)),
    notaCompromiso: parseFloat(notaCompromiso.toFixed(2)),
    notaDesempeno: parseFloat(notaDesempeno.toFixed(2)),
    notaFinal: parseFloat(notaFinal.toFixed(2))
  };
}
