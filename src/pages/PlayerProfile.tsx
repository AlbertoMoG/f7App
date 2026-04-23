import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Player, PlayerStat, Match, Season, Opponent, Team, Injury } from '../types';
import { ArrowLeft, Calendar, Shield, Sword, Crosshair, Filter, Stethoscope, Activity, History, Users, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  calculatePlayerRating, 
  PESO_COMPROMISO, 
  PESO_DESEMPENO, 
  META_EXCELENCIA, 
  BONO_REGULARIDAD_PUNTOS, 
  PUNTOS_VICTORIA, 
  PUNTOS_EMPATE, 
  PUNTOS_DERROTA, 
  PUNTOS_BAJO_4_GOLES, 
  PUNTOS_GOL, 
  PUNTOS_ASISTENCIA, 
  PUNTOS_AMARILLA, 
  PUNTOS_ROJA, 
  PUNTOS_SIN_CONTESTAR, 
  PUNTOS_NO_ASISTENCIA 
} from '../lib/ratingSystem';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger, 
  TooltipProvider 
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import PlayerCumulativeAttendanceChart from '../components/PlayerCumulativeAttendanceChart';

const positionIcons: Record<string, any> = {
  'Portero': Shield,
  'Defensa': Shield,
  'Medio': Sword,
  'Delantero': Crosshair
};

const positionColors: Record<string, string> = {
  'Portero': 'bg-yellow-100 text-yellow-700',
  'Defensa': 'bg-blue-100 text-blue-700',
  'Medio': 'bg-emerald-100 text-emerald-700',
  'Delantero': 'bg-red-100 text-red-700'
};

export default function PlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [seasons, setSeasons] = useState<Record<string, Season>>({});
  const [playerSeasons, setPlayerSeasons] = useState<string[]>([]);
  const [opponents, setOpponents] = useState<Record<string, Opponent>>({});
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [selectedMatchType, setSelectedMatchType] = useState<string>('all');
  const [attendanceView, setAttendanceView] = useState<'summary' | 'regularity'>('summary');

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!playerId) return;

      try {
        // Fetch player
        const playerDoc = await getDoc(doc(db, 'players', playerId));
        let playerData: Player | null = null;
        if (playerDoc.exists()) {
          playerData = { id: playerDoc.id, ...playerDoc.data() } as Player;
          setPlayer(playerData);
        }

        if (!playerData) {
          setLoading(false);
          return;
        }

        // Fetch stats
        const statsQuery = query(collection(db, 'playerStats'), where('playerId', '==', playerId));
        const statsSnapshot = await getDocs(statsQuery);
        const playerStats = statsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PlayerStat));
        setStats(playerStats);

        // Fetch related matches
        const matchIds = [...new Set(playerStats.map(s => s.matchId))];
        const matchData: Record<string, Match> = {};
        const opponentIds = new Set<string>();
        const seasonIds = new Set<string>();

        // We can't use 'in' with more than 10 items, so we fetch all matches or chunk them.
        // For simplicity, let's fetch all matches, seasons, opponents for the team.
        const [matchesSnap, seasonsSnap, opponentsSnap, teamDoc, playerSeasonsSnap, injuriesSnap] = await Promise.all([
          getDocs(query(collection(db, 'matches'), where('teamId', '==', playerData.teamId))),
          getDocs(query(collection(db, 'seasons'), where('teamId', '==', playerData.teamId))),
          getDocs(query(collection(db, 'opponents'), where('teamId', '==', playerData.teamId))),
          getDoc(doc(db, 'team', playerData.teamId)),
          getDocs(query(collection(db, 'playerSeasons'), where('playerId', '==', playerId))),
          getDocs(query(collection(db, 'injuries'), where('playerId', '==', playerId)))
        ]);

        matchesSnap.docs.forEach(d => {
          matchData[d.id] = { id: d.id, ...d.data() } as Match;
        });
        
        const seasonData: Record<string, Season> = {};
        seasonsSnap.docs.forEach(d => {
          seasonData[d.id] = { id: d.id, ...d.data() } as Season;
        });

        const opponentData: Record<string, Opponent> = {};
        opponentsSnap.docs.forEach(d => {
          opponentData[d.id] = { id: d.id, ...d.data() } as Opponent;
        });

        if (teamDoc.exists()) {
          setTeam({ id: teamDoc.id, ...teamDoc.data() } as Team);
        }

        // Add empty arrays for seasons the player is in but has no stats yet
        const pSeasons: string[] = [];
        playerSeasonsSnap.docs.forEach(d => {
          const ps = d.data();
          pSeasons.push(ps.seasonId);
        });
        setPlayerSeasons(pSeasons);

        setInjuries(injuriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Injury)));
        setMatches(matchData);
        setSeasons(seasonData);
        setOpponents(opponentData);
      } catch (error) {
        console.error("Error fetching player data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [playerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] p-4 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold mb-4">Jugador no encontrado</h2>
        <Button onClick={() => navigate('/')}>Volver al inicio</Button>
      </div>
    );
  }

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 0;
    const today = new Date();
    const birthDateObj = new Date(birthDate);
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const m = today.getMonth() - birthDateObj.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }
    return age;
  };

  const Icon = positionIcons[player.position] || Shield;

  // Group stats by season
  const statsBySeason: Record<string, PlayerStat[]> = {};
  
  // Initialize with all seasons the player is part of (only if they exist in seasons object)
  playerSeasons.forEach(seasonId => {
    if (seasons[seasonId]) {
      statsBySeason[seasonId] = [];
    }
  });

  stats.forEach(stat => {
    // Only include stats for seasons that exist
    if (seasons[stat.seasonId]) {
      if (!statsBySeason[stat.seasonId]) {
        statsBySeason[stat.seasonId] = [];
      }
      statsBySeason[stat.seasonId].push(stat);
    }
  });

  // Sort seasons by name (assuming name has year or something, or just sort by ID for now)
  const sortedSeasonIds = Object.keys(statsBySeason).sort((a, b) => {
    const nameA = seasons[a]?.name || '';
    const nameB = seasons[b]?.name || '';
    return nameB.localeCompare(nameA); // Descending
  });

  // Calculate total stats
  const totalStats = stats.reduce((acc, stat) => {
    const match = matches[stat.matchId];
    const matchTypeMatches = selectedMatchType === 'all' || (match && match.type === selectedMatchType);
    const seasonMatches = selectedSeasonId === 'all' || stat.seasonId === selectedSeasonId;

    if (seasonMatches && matchTypeMatches) {
      if (stat.attendance === 'attending') {
        acc.matches++;
        acc.goals += stat.goals || 0;
        acc.assists += stat.assists || 0;
        acc.yellowCards += stat.yellowCards || 0;
        acc.redCards += stat.redCards || 0;
      } else if (stat.attendance === 'justified') {
        acc.justified++;
      } else if (stat.attendance === 'notAttending') {
        acc.unjustified++;
      } else if (stat.attendance === 'noResponse') {
        acc.noResponse++;
      }
    }
    return acc;
  }, { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, justified: 0, unjustified: 0, noResponse: 0 });

  const rating = calculatePlayerRating(Object.values(matches), injuries, stats, player, selectedSeasonId, Object.values(seasons));

  const attendanceData = [
    { name: 'Asiste', value: totalStats.matches, color: '#10B981' },
    { name: 'Falta Justificada', value: totalStats.justified, color: '#3B82F6' },
    { name: 'Falta Sin Justificar', value: totalStats.unjustified, color: '#EF4444' },
    { name: 'Sin Respuesta', value: totalStats.noResponse, color: '#9CA3AF' }
  ].filter(d => d.value > 0);

  const performanceData = stats
    .filter(s => {
      const match = matches[s.matchId];
      const matchTypeMatches = selectedMatchType === 'all' || (match && match.type === selectedMatchType);
      const seasonMatches = selectedSeasonId === 'all' || s.seasonId === selectedSeasonId;
      return seasonMatches && matchTypeMatches && s.attendance === 'attending' && match?.status === 'completed';
    })
    .sort((a, b) => new Date(matches[a.matchId].date).getTime() - new Date(matches[b.matchId].date).getTime())
    .map(s => {
      const match = matches[s.matchId];
      return {
        date: format(new Date(match.date), 'dd/MM'),
        opponent: opponents[match.opponentId]?.name || 'Rival',
        goals: s.goals || 0,
        assists: s.assists || 0,
      };
    });

  // Calculate consecutive scoring streak
  let currentScoringStreak = 0;
  let maxScoringStreak = 0;

  performanceData.forEach(match => {
    if (match.goals > 0) {
      currentScoringStreak++;
      maxScoringStreak = Math.max(maxScoringStreak, currentScoringStreak);
    } else {
      currentScoringStreak = 0;
    }
  });

  const allTeamMatches = Object.values(matches)
    .filter(m => {
      const matchTypeMatches = selectedMatchType === 'all' || m.type === selectedMatchType;
      const seasonMatches = selectedSeasonId === 'all' || m.seasonId === selectedSeasonId;
      return seasonMatches && matchTypeMatches && m.status === 'completed';
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const evolutionData = allTeamMatches.map((match, index) => {
    const matchesUpToNow = allTeamMatches.slice(0, index + 1);
    const currentRating = calculatePlayerRating(matchesUpToNow, injuries, stats, player, selectedSeasonId, Object.values(seasons));
    
    return {
      date: format(new Date(match.date), 'dd/MM'),
      opponent: opponents[match.opponentId]?.name || 'Rival',
      baremo: currentRating.notaFinal,
      desempeno: currentRating.notaDesempeno,
      compromiso: currentRating.notaCompromiso,
      round: match.round || '',
      seasonName: seasons[match.seasonId]?.name || '',
      matchId: match.id
    };
  });

  const shortPositions: Record<string, string> = {
    'Portero': 'POR',
    'Defensa': 'DEF',
    'Medio': 'MED',
    'Delantero': 'DEL'
  };

  const generatePDFReport = () => {
    const doc = new jsPDF();
    
    const seasonName = selectedSeasonId === 'all' ? 'Todas las temporadas' : (seasons[selectedSeasonId]?.name || 'Temporada');
    
    const played = totalStats.matches;
    const notPlayed = rating.partidosLesionado + totalStats.justified + totalStats.unjustified + totalStats.noResponse;

    let won = 0;
    let tied = 0;
    let lost = 0;

    stats.forEach(stat => {
      const match = matches[stat.matchId];
      if (!match || match.status !== 'completed' || stat.attendance !== 'attending') return;
      const matchTypeMatches = selectedMatchType === 'all' || match.type === selectedMatchType;
      const seasonMatches = selectedSeasonId === 'all' || stat.seasonId === selectedSeasonId;
      
      if (matchTypeMatches && seasonMatches) {
        if ((match.scoreTeam || 0) > (match.scoreOpponent || 0)) won++;
        else if ((match.scoreTeam || 0) === (match.scoreOpponent || 0)) tied++;
        else lost++;
      }
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(`Informe Asistencia: ${player.firstName} ${player.lastName} ${player.alias ? `"${player.alias}"` : ''}`, 14, 22);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Temporada: ${seasonName}`, 14, 30);
    doc.text(`Competición: ${selectedMatchType === 'all' ? 'Todas' : (selectedMatchType === 'league' ? 'Liga' : selectedMatchType === 'cup' ? 'Copa' : 'Amistoso')}`, 14, 36);

    autoTable(doc, {
      startY: 45,
      head: [['Métrica de Asistencia', 'Cantidad']],
      body: [
        ['Partidos Jugados', played.toString()],
        ['Partidos No Jugados (Justificados, ausencias, lesiones)', notPlayed.toString()],
      ],
      headStyles: { fillColor: [16, 185, 129] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Hitos del Equipo (Solo cuando el jugador participó)', 'Partidos']],
      body: [
        ['Partidos Ganados', won.toString()],
        ['Partidos Empatados', tied.toString()],
        ['Partidos Perdidos', lost.toString()]
      ],
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`Informe_${player.firstName}_${seasonName.replace(/ /g, '_')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-2 md:p-4">
      <div className="max-w-screen-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft size={20} className="mr-2" /> Volver
          </Button>
          <Button 
            onClick={generatePDFReport} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Download size={16} className="mr-2" /> Informe Asistencia (PDF)
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Player Card (Sticky) */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-8 space-y-6">
              {/* FUT Card */}
              <div className="relative w-full max-w-sm mx-auto aspect-[2/3] rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-700 p-1">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
                <div className="relative h-full w-full bg-gradient-to-b from-black/10 to-black/80 rounded-[22px] p-6 flex flex-col text-white overflow-hidden">
                  
                  {/* Top Section */}
                  <div className="flex justify-between items-start z-20">
                    {/* Rating & Position Box */}
                    <div className="flex flex-col items-center bg-black/40 backdrop-blur-sm border border-white/20 rounded-tl-xl rounded-br-xl p-2 shadow-lg min-w-[3.5rem]">
                      <span className="text-[8px] font-bold text-yellow-300 uppercase tracking-wider mb-0.5">Baremo</span>
                      <span className="text-4xl font-black italic tracking-tighter leading-none">{rating.notaFinal}</span>
                      <div className="w-full h-px bg-white/30 my-1"></div>
                      <span className="text-sm font-bold uppercase tracking-widest">{shortPositions[player.position] || player.position}</span>
                    </div>

                    {/* Jersey Number & Shield */}
                    <div className="flex flex-col items-end gap-2">
                      <div className="bg-white text-black px-3 py-1 rounded-bl-xl rounded-tr-xl shadow-lg font-black italic text-2xl border-2 border-yellow-500">
                        #{player.number}
                      </div>
                      {team?.shieldUrl && (
                        <div className="bg-white/90 p-1.5 rounded-xl shadow-lg border border-white/20">
                          <img src={team.shieldUrl} alt={team.name} className="w-8 h-8 object-contain drop-shadow-md" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Player Image */}
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 w-4/5 h-3/5 z-10">
                    {player.photoUrl ? (
                      <img src={player.photoUrl} alt={player.alias} className="w-full h-full object-cover object-top drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-9xl font-black opacity-20">{player.firstName[0]}{player.lastName[0]}</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Section */}
                  <div className="mt-auto z-20 flex flex-col items-center bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-3 shadow-xl">
                    <h2 className="text-2xl font-black italic uppercase tracking-wider mb-1 text-center leading-tight">
                      {player.alias || player.lastName}
                    </h2>
                    <div className="w-full h-px bg-white/30 my-2"></div>
                    
                    {/* Advanced Stats: Baremo, Compromiso, Desempeño */}
                    <div className="grid grid-cols-3 w-full gap-2 mb-2 text-center">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1 justify-center">
                          <span className="text-[10px] text-yellow-300 font-bold uppercase">Baremo</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="inline-flex">
                                  <Info size={10} className="text-yellow-300/60 cursor-help" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="p-4 bg-gray-900 text-white border-none rounded-2xl shadow-2xl min-w-[240px]">
                                <p className="font-bold mb-2 text-yellow-400 border-b border-white/10 pb-1 flex items-center gap-2">
                                  <Users size={14} /> Desglose: {player.alias || player.firstName}
                                </p>
                                
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-[10px]">
                                    <span className="text-gray-400">P. Finalizados:</span>
                                    <span className="font-bold text-right">{rating.partidosComputables}</span>
                                    <span className="text-gray-400">P. Asistidos:</span>
                                    <span className="font-bold text-emerald-400 text-right">{rating.partidosAsistidos}</span>
                                    <span className="text-gray-400">P. Justificados:</span>
                                    <span className="font-bold text-blue-400 text-right">{rating.partidosJustificados}</span>
                                    <span className="text-gray-400">P. No Asistidos:</span>
                                    <span className="font-bold text-red-400 text-right">{rating.partidosNoAsistencia}</span>
                                    <span className="text-gray-400">P. Sin Rspcta.:</span>
                                    <span className="font-bold text-gray-400 text-right">{rating.partidosSinRespuesta}</span>
                                    <span className="text-gray-400">P. Lesionado:</span>
                                    <span className="font-bold text-red-500 text-right">{rating.partidosLesionado}</span>
                                  </div>

                                  <div className="bg-white/5 p-2 rounded-xl space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-300 font-bold uppercase text-[9px]">1. Compromiso ({PESO_COMPROMISO * 100}%)</span>
                                      <span className="font-black text-blue-400 text-[12px]">{rating.notaCompromiso}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-gray-400 italic">Asistencia Efectiva:</span>
                                      <span className="font-medium text-emerald-500">{rating.asistenciaEfectiva} pts</span>
                                    </div>
                                  </div>

                                  <div className="bg-white/5 p-2 rounded-xl space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-300 font-bold uppercase text-[9px]">2. Desempeño ({PESO_DESEMPENO * 100}%)</span>
                                      <span className="font-black text-orange-400 text-[12px]">{rating.notaDesempeno}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-gray-400 italic">Desempeño Puro:</span>
                                      <span className="font-medium text-emerald-500">{rating.notaDesempenoPura} pts</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-gray-400 italic">Participación ({rating.porcentajeParticipacion}%):</span>
                                      <span className="font-medium text-orange-400">×{rating.factorFiabilidad}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-gray-400 italic">Pts. Totales / Media:</span>
                                      <span className="font-medium text-blue-400">{rating.puntosTotales} / {rating.mediaPorPartido}</span>
                                    </div>
                                    {(player.position === 'Portero' || player.position === 'Defensa') && (
                                       <div className="flex justify-between text-[10px]">
                                         <span className="text-gray-400 italic">Bono Defensivo (&lt; 4 Gls):</span>
                                         <span className="font-medium text-emerald-400">{rating.partidosBajo4Goles}</span>
                                       </div>
                                    )}
                                  </div>

                                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                                    <div className="flex flex-col">
                                      <span className="text-gray-400 text-[9px]">Racha Máx: {rating.rachaMaxima}</span>
                                      <span className="text-emerald-400 font-bold text-[10px]">Bono Reg: +{rating.bonoRegularidad}</span>
                                      {rating.penalizacionRegularidad > 0 && (
                                        <>
                                          <span className="text-gray-400 text-[9px] mt-1 border-t border-white/5 pt-1">Racha Ausencias: {rating.rachaMaximaAusencias}</span>
                                          <span className="text-red-400 font-bold text-[9px]">Pen. Ausencia: -{rating.penalizacionRegularidad}</span>
                                        </>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="text-gray-400 text-[8px] uppercase font-bold">Nota Final</span>
                                      <span className="font-black text-emerald-400 text-base leading-none">{rating.notaFinal}</span>
                                    </div>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <span className="font-black text-lg">{rating.notaFinal}</span>
                      </div>
                      <div className="flex flex-col border-x border-white/20">
                        <span className="text-[10px] text-emerald-300 font-bold uppercase">Compromiso</span>
                        <span className="font-black text-lg">{rating.notaCompromiso}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-blue-300 font-bold uppercase">Desempeño</span>
                        <span className="font-black text-lg">{rating.notaDesempeno}</span>
                      </div>
                    </div>

                    <div className="w-full h-px bg-white/30 my-2"></div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 w-full px-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold opacity-80 uppercase">Partidos</span>
                        <span className="font-black">{totalStats.matches}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold opacity-80 uppercase">Goles</span>
                        <span className="font-black">{totalStats.goals}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold opacity-80 uppercase">Asist.</span>
                        <span className="font-black">{totalStats.assists}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold opacity-80 uppercase">Racha Asist.</span>
                        <span className="font-black">{rating.rachaMaxima}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold opacity-80 uppercase">Racha Goles</span>
                        <span className="font-black">{maxScoringStreak}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold opacity-80 uppercase">T. Ama</span>
                        <span className="font-black">{totalStats.yellowCards}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold opacity-80 uppercase">T. Roj</span>
                        <span className="font-black">{totalStats.redCards}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Data Card */}
              <Card className="border-none shadow-sm rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Datos Personales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nombre Completo</span>
                    <span className="font-medium">{player.firstName} {player.lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nacimiento</span>
                    <span className="font-medium">{player.birthDate ? format(new Date(player.birthDate), 'dd/MM/yyyy') : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Edad</span>
                    <span className="font-medium">{calculateAge(player.birthDate)} años</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Posición</span>
                    <span className="font-medium">{player.position}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estado</span>
                    <span>
                      {injuries.some(i => !i.endDate) ? (
                        <span className="text-red-600 font-bold">Lesionado</span>
                      ) : player.isActive === false ? (
                        <span className="text-orange-600 font-bold">Baja</span>
                      ) : (
                        <span className="text-emerald-600 font-bold">Activo</span>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column: Match History & Injuries */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-8">
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold tracking-tight">Estadísticas e Historial</h2>
              <div className="flex flex-wrap gap-2">
                
                {/* Filtro de Temporadas */}
                <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                  <SelectTrigger className="w-[200px] bg-white rounded-xl">
                    <div className="flex items-center">
                      <Filter size={14} className="mr-2 text-gray-500 shrink-0" />
                      {/* AQUÍ ESTÁ EL TRUCO: Forzamos el texto a mano igual que en tu código */}
                      <SelectValue>
                        {selectedSeasonId === 'all' 
                          ? 'Todas las temporadas' 
                          : seasons[selectedSeasonId]?.name || 'Temporada'}
                      </SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todas las temporadas</SelectItem>
                    {sortedSeasonIds.map(id => (
                      <SelectItem key={id} value={id}>
                        {seasons[id]?.name || 'Desconocida'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro de Competición */}
                <Select value={selectedMatchType} onValueChange={setSelectedMatchType}>
                  <SelectTrigger className="w-[160px] bg-white rounded-xl">
                    <div className="flex items-center">
                      <Filter size={14} className="mr-2 text-gray-500 shrink-0" />
                      {/* AQUÍ ESTÁ EL TRUCO: Forzamos el texto a mano */}
                      <SelectValue>
                        {selectedMatchType === 'all' 
                          ? 'Todas' 
                          : selectedMatchType === 'league' ? 'Liga'
                          : selectedMatchType === 'cup' ? 'Copa'
                          : selectedMatchType === 'friendly' ? 'Amistoso'
                          : 'Competición'}
                      </SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="league">Liga</SelectItem>
                    <SelectItem value="cup">Copa</SelectItem>
                    <SelectItem value="friendly">Amistoso</SelectItem>
                  </SelectContent>
                </Select>
                
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="border-none shadow-sm rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg">Asistencia</CardTitle>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setAttendanceView('summary')}
                      className={cn(
                        "px-2 py-1 text-[10px] font-black uppercase rounded-md transition-all",
                        attendanceView === 'summary' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      Resumen
                    </button>
                    <button 
                      onClick={() => setAttendanceView('regularity')}
                      className={cn(
                        "px-2 py-1 text-[10px] font-black uppercase rounded-md transition-all",
                        attendanceView === 'regularity' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      Regularidad
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="h-64 flex flex-col">
                  {attendanceView === 'summary' ? (
                    attendanceData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={attendanceData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {attendanceData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-4 mt-2">
                          {attendanceData.map(d => (
                            <div key={d.name} className="flex items-center gap-1.5 text-xs">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                              <span className="text-gray-600">{d.name} ({d.value})</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-gray-400 italic text-sm">
                        No hay datos de asistencia
                      </div>
                    )
                  ) : (
                    <PlayerCumulativeAttendanceChart 
                      playerId={playerId || ''}
                      matches={allTeamMatches}
                      stats={stats}
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Goles y Asistencias</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  {performanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} allowDecimals={false} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
                        />
                        <Bar dataKey="goals" name="Goles" fill="#10B981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="assists" name="Asistencias" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">
                      No hay datos de rendimiento
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Evolution Chart */}
            <Card className="border-none shadow-sm rounded-2xl mb-8">
              <CardHeader>
                <CardTitle className="text-lg">Evolución del Baremo</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {evolutionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolutionData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <RechartsTooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-xl min-w-[200px]">
                                <p className="font-bold text-gray-900 mb-1">{data.date} vs {data.opponent}</p>
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                                  {data.seasonName} {data.round ? `• ${data.round}` : ''}
                                </div>
                                <div className="space-y-1.5">
                                  {payload.map((entry: any, index: number) => (
                                    <div key={index} className="flex justify-between items-center text-sm">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                        <span className="text-gray-600">{entry.name}</span>
                                      </div>
                                      <span className="font-black" style={{ color: entry.color }}>{Math.round(Number(entry.value))}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="baremo" 
                        name="Baremo Final" 
                        stroke="#EAB308" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#EAB308', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, fill: '#EAB308', strokeWidth: 0 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="desempeno" 
                        name="Desempeño" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 3, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="compromiso" 
                        name="Compromiso" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 3, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">
                    No hay suficientes datos para mostrar la evolución
                  </div>
                )}
              </CardContent>
            </Card>

        
        {sortedSeasonIds.length === 0 ? (
          <Card className="border-none shadow-sm rounded-2xl">
            <CardContent className="p-8 text-center text-gray-500 italic">
              No hay estadísticas registradas para este jugador.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {sortedSeasonIds
              .filter(seasonId => selectedSeasonId === 'all' || seasonId === selectedSeasonId)
              .map(seasonId => {
              const seasonStats = statsBySeason[seasonId];
              const seasonName = seasons[seasonId]?.name || 'Temporada Desconocida';
              
              // Filter out non-attending and by match type
              const filteredStats = seasonStats.filter(stat => {
                if (stat.attendance !== 'attending') return false;
                const match = matches[stat.matchId];
                if (!match) return false;
                if (selectedMatchType !== 'all' && match.type !== selectedMatchType) return false;
                return true;
              });

              if (filteredStats.length === 0) return null;

              // Sort stats by match date descending
              const sortedStats = [...filteredStats].sort((a, b) => {
                const matchA = matches[a.matchId];
                const matchB = matches[b.matchId];
                if (!matchA || !matchB) return 0;
                return new Date(matchB.date).getTime() - new Date(matchA.date).getTime();
              });

              return (
                <Card key={seasonId} className="border-none shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b border-gray-100 py-3 px-4">
                    <CardTitle className="text-base font-bold text-gray-700">{seasonName}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-gray-400 uppercase bg-white border-b border-gray-50">
                          <tr>
                            <th className="px-4 py-3 font-bold text-xs">Fecha</th>
                            <th className="px-4 py-3 font-bold text-xs">Rival</th>
                            <th className="px-4 py-3 font-bold text-xs">Competición</th>
                            <th className="px-4 py-3 font-bold text-center text-emerald-600 text-xs">Goles</th>
                            <th className="px-4 py-3 font-bold text-center text-blue-600 text-xs">Asist.</th>
                            <th className="px-4 py-3 font-bold text-center text-yellow-600 text-xs">T. Ama</th>
                            <th className="px-4 py-3 font-bold text-center text-red-600 text-xs">T. Roja</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedStats.map(stat => {
                            const match = matches[stat.matchId];
                            if (!match) return null;
                            const opponent = opponents[match.opponentId];
                            
                            return (
                              <tr key={stat.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap text-sm">
                                  {format(new Date(match.date), 'dd MMM yy', { locale: es })}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    {opponent?.shieldUrl ? (
                                      <div className="w-8 h-8 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center p-1 shrink-0">
                                        <img src={opponent.shieldUrl} alt={opponent.name} className="w-full h-full object-contain" />
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-400 shadow-sm border border-gray-100 shrink-0">
                                        {opponent?.name?.substring(0, 2).toUpperCase() || '??'}
                                      </div>
                                    )}
                                    <span className="font-bold text-gray-700 text-sm">{opponent?.name || 'Desconocido'}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-gray-600 text-sm">
                                      {match.type === 'league' ? 'Liga' : match.type === 'cup' ? 'Copa' : 'Amistoso'}
                                    </span>
                                    {match.round && <span className="text-[10px] text-gray-400">{match.round}</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center font-black text-emerald-600 text-sm">
                                  {stat.goals ? (
                                    <div className="flex items-center justify-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg w-fit mx-auto">
                                      <span>{stat.goals}</span>
                                      <span className="text-[10px]">⚽</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 font-medium">0</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center font-black text-blue-600 text-sm">
                                  {stat.assists ? (
                                    <div className="flex items-center justify-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg w-fit mx-auto">
                                      <span>{stat.assists}</span>
                                      <span className="text-[10px]">👟</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 font-medium">0</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center font-black text-yellow-600 text-sm">
                                  {stat.yellowCards ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <span>{stat.yellowCards}</span>
                                      <div className="w-2 h-3 bg-yellow-400 rounded-sm"></div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 font-medium">0</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center font-black text-red-600 text-sm">
                                  {stat.redCards ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <span>{stat.redCards}</span>
                                      <div className="w-2 h-3 bg-red-500 rounded-sm"></div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 font-medium">0</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
          </div>
            {/* Injury History Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <History className="text-red-600" size={20} />
                <h2 className="text-2xl font-bold tracking-tight">Historial de Lesiones</h2>
              </div>
              
              {injuries.length === 0 ? (
                <Card className="border-none shadow-sm rounded-2xl">
                  <CardContent className="p-6 text-center text-gray-500 italic">
                    No hay historial de lesiones registrado.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...injuries].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).map(injury => (
                    <Card key={injury.id} className="border-none shadow-sm rounded-2xl overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              injury.endDate ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                            )}>
                              {injury.endDate ? <Activity size={20} /> : <Stethoscope size={20} />}
                            </div>
                            <div>
                              <p className="font-bold text-sm">
                                {injury.endDate ? 'Recuperado' : 'Lesionado'}
                              </p>
                              <p className="text-[10px] text-gray-500 uppercase font-black tracking-wider">
                                {format(new Date(injury.startDate), 'dd MMM yyyy HH:mm', { locale: es })}
                                {injury.endDate && ` - ${format(new Date(injury.endDate), 'dd MMM yyyy HH:mm', { locale: es })}`}
                              </p>
                            </div>
                          </div>
                          {!injury.endDate && (
                            <Badge className="bg-red-500 text-white border-none text-[10px] font-black uppercase">Activa</Badge>
                          )}
                        </div>
                        {injury.cause && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-xs text-gray-600 italic">"{injury.cause}"</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
