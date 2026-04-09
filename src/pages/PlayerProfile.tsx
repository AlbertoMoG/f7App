import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Player, PlayerStat, Match, Season, Opponent, Team } from '../types';
import { ArrowLeft, Calendar, Shield, Sword, Crosshair, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  const [opponents, setOpponents] = useState<Record<string, Opponent>>({});
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [selectedMatchType, setSelectedMatchType] = useState<string>('all');

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!playerId) return;

      try {
        // Fetch player
        const playerDoc = await getDoc(doc(db, 'players', playerId));
        if (playerDoc.exists()) {
          setPlayer({ id: playerDoc.id, ...playerDoc.data() } as Player);
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
        // For simplicity, let's fetch all matches, seasons, opponents.
        const [matchesSnap, seasonsSnap, opponentsSnap, teamsSnap] = await Promise.all([
          getDocs(collection(db, 'matches')),
          getDocs(collection(db, 'seasons')),
          getDocs(collection(db, 'opponents')),
          getDocs(query(collection(db, 'team'), limit(1)))
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

        if (!teamsSnap.empty) {
          setTeam({ id: teamsSnap.docs[0].id, ...teamsSnap.docs[0].data() } as Team);
        }

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
  stats.forEach(stat => {
    if (!statsBySeason[stat.seasonId]) {
      statsBySeason[stat.seasonId] = [];
    }
    statsBySeason[stat.seasonId].push(stat);
  });

  // Sort seasons by name (assuming name has year or something, or just sort by ID for now)
  const sortedSeasonIds = Object.keys(statsBySeason).sort((a, b) => {
    const nameA = seasons[a]?.name || '';
    const nameB = seasons[b]?.name || '';
    return nameB.localeCompare(nameA); // Descending
  });

  // Calculate total stats (only for matches attended)
  const totalStats = stats.reduce((acc, stat) => {
    if (stat.attendance === 'attending') {
      acc.matches++;
      acc.goals += stat.goals || 0;
      acc.assists += stat.assists || 0;
      acc.yellowCards += stat.yellowCards || 0;
      acc.redCards += stat.redCards || 0;
    }
    return acc;
  }, { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 });

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6">
          <ArrowLeft size={20} className="mr-2" /> Volver
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Player Card (Sticky) */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-8 space-y-6">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                <div className="bg-emerald-600 h-32 relative">
                  {team?.shieldUrl && (
                    <div className="absolute top-4 right-4 opacity-40 pointer-events-none">
                      <img src={team.shieldUrl} alt={team.name} className="h-20 w-20 object-contain drop-shadow-md" />
                    </div>
                  )}
                  <div className="absolute -bottom-16 left-8">
                    <Avatar className="h-32 w-32 border-4 border-white rounded-3xl shadow-lg bg-white">
                      <AvatarImage src={player.photoUrl} className="object-cover rounded-3xl" />
                      <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold text-4xl rounded-3xl">
                        {player.firstName[0]}{player.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="absolute top-4 left-4 bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-2xl font-black text-2xl border border-white/30 shadow-sm">
                    #{player.number}
                  </div>
                </div>
                <CardContent className="pt-20 pb-8 px-8">
                  <div className="flex flex-col gap-6">
                    <div>
                      <h1 className="text-3xl font-black tracking-tight text-gray-900 leading-tight">
                        {player.firstName} <br/> {player.lastName}
                      </h1>
                      {player.alias && (
                        <p className="text-lg text-gray-500 font-medium mt-1">"{player.alias}"</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-4">
                        <Badge variant="secondary" className={cn("rounded-xl px-3 py-1 text-xs font-bold uppercase tracking-wider", positionColors[player.position])}>
                          <Icon size={14} className="mr-1.5" />
                          {player.position}
                        </Badge>
                        <span className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-xl">
                          {calculateAge(player.birthDate)} años
                        </span>
                        {player.isInjured && (
                          <Badge variant="destructive" className="rounded-xl px-3 py-1 text-xs font-bold uppercase tracking-wider bg-red-500 text-white border-none">
                            Lesionado
                          </Badge>
                        )}
                        {player.isActive === false && (
                          <Badge variant="secondary" className="rounded-xl px-3 py-1 text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-700 border-none">
                            Baja
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Total Stats */}
                    <div className="flex justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100 w-full">
                      <div className="text-center px-2">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Partidos</p>
                        <p className="text-2xl font-black text-gray-900">{totalStats.matches}</p>
                      </div>
                      <div className="w-px bg-gray-200"></div>
                      <div className="text-center px-2">
                        <p className="text-[10px] text-emerald-600 uppercase font-bold mb-1">Goles</p>
                        <p className="text-2xl font-black text-emerald-700">{totalStats.goals}</p>
                      </div>
                      <div className="w-px bg-gray-200"></div>
                      <div className="text-center px-2">
                        <p className="text-[10px] text-blue-600 uppercase font-bold mb-1">Asist.</p>
                        <p className="text-2xl font-black text-blue-700">{totalStats.assists}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column: Match History */}
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold tracking-tight">Historial de Partidos</h2>
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
                                <td className="px-4 py-3 text-center font-black text-emerald-600 text-sm">{stat.goals || 0}</td>
                                <td className="px-4 py-3 text-center font-black text-blue-600 text-sm">{stat.assists || 0}</td>
                                <td className="px-4 py-3 text-center font-black text-yellow-600 text-sm">{stat.yellowCards || 0}</td>
                                <td className="px-4 py-3 text-center font-black text-red-600 text-sm">{stat.redCards || 0}</td>
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
        </div>
      </div>
    </div>
  );
}
