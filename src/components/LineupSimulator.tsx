import React from 'react';
import { 
  RotateCcw,
  Save,
  Info,
  Trash2,
  ChevronDown,
  Users,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Tooltip, 
  TooltipTrigger, 
  TooltipContent, 
} from '@/components/ui/tooltip';
import { Player, Lineup, LineupSlot, Match, PlayerStat, Season, PlayerSeason, Injury, Opponent } from '../types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toPng } from 'html-to-image';
import { formatMatchOptionLabel } from '@/lib/matchDisplayLabel';

interface LineupSimulatorProps {
  players: Player[];
  playerSeasons: PlayerSeason[];
  lineups: Lineup[];
  matches: Match[];
  stats: PlayerStat[];
  seasons: Season[];
  opponents: Opponent[];
  injuries: Injury[];
  globalSeasonId: string;
  initialMatchId?: string | null;
  onClearInitialMatchId?: () => void;
  onSaveLineup: (lineup: Omit<Lineup, 'id'>) => void;
  onDeleteLineup: (id: string) => void;
}

const FORMATIONS = [
  { name: '2-3-1', slots: [
    { x: 50, y: 85, pos: 'POR' },
    { x: 30, y: 65, pos: 'DEF' },
    { x: 70, y: 65, pos: 'DEF' },
    { x: 20, y: 40, pos: 'MED' },
    { x: 50, y: 40, pos: 'MED' },
    { x: 80, y: 40, pos: 'MED' },
    { x: 50, y: 15, pos: 'DEL' },
  ]},
  { name: '3-2-1', slots: [
    { x: 50, y: 85, pos: 'POR' },
    { x: 20, y: 65, pos: 'DEF' },
    { x: 50, y: 65, pos: 'DEF' },
    { x: 80, y: 65, pos: 'DEF' },
    { x: 35, y: 40, pos: 'MED' },
    { x: 65, y: 40, pos: 'MED' },
    { x: 50, y: 15, pos: 'DEL' },
  ]},
  { name: '2-2-2', slots: [
    { x: 50, y: 85, pos: 'POR' },
    { x: 30, y: 65, pos: 'DEF' },
    { x: 70, y: 65, pos: 'DEF' },
    { x: 30, y: 40, pos: 'MED' },
    { x: 70, y: 40, pos: 'MED' },
    { x: 30, y: 15, pos: 'DEL' },
    { x: 70, y: 15, pos: 'DEL' },
  ]},
  { name: '3-3', slots: [
    { x: 50, y: 85, pos: 'POR' },
    { x: 20, y: 65, pos: 'DEF' },
    { x: 50, y: 65, pos: 'DEF' },
    { x: 80, y: 65, pos: 'DEF' },
    { x: 20, y: 25, pos: 'DEL' },
    { x: 50, y: 25, pos: 'DEL' },
    { x: 80, y: 25, pos: 'DEL' },
  ]},
];

export default function LineupSimulator({ 
  players, 
  playerSeasons,
  lineups, 
  matches, 
  stats, 
  seasons,
  opponents,
  injuries,
  globalSeasonId,
  initialMatchId,
  onClearInitialMatchId,
  onSaveLineup, 
  onDeleteLineup 
}: LineupSimulatorProps) {
  const [activeFormation, setActiveFormation] = React.useState(FORMATIONS[0]);
  const [currentLineup, setCurrentLineup] = React.useState<(string | null)[]>(new Array(7).fill(null));
  const [draggedPlayerId, setDraggedPlayerId] = React.useState<string | null>(null);
  const [lineupName, setLineupName] = React.useState('');
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  const [selectedMatchId, setSelectedMatchId] = React.useState<string>('');
  /** When global season is "all", user picks which season scopes matches / roster. */
  const [localSeasonForAll, setLocalSeasonForAll] = React.useState<string>('');

  const latestSeasonId = React.useMemo(() => {
    if (seasons.length === 0) return '';
    return [...seasons].sort((a, b) => b.startYear - a.startYear)[0]!.id;
  }, [seasons]);

  const effectiveSeasonId = React.useMemo(() => {
    if (globalSeasonId !== 'all') return globalSeasonId;
    return localSeasonForAll || latestSeasonId;
  }, [globalSeasonId, localSeasonForAll, latestSeasonId]);

  React.useEffect(() => {
    if (globalSeasonId === 'all' && latestSeasonId && !localSeasonForAll) {
      setLocalSeasonForAll(latestSeasonId);
    }
  }, [globalSeasonId, latestSeasonId, localSeasonForAll]);

  React.useEffect(() => {
    if (!selectedMatchId || !effectiveSeasonId) return;
    const m = matches.find((x) => x.id === selectedMatchId);
    if (!m || m.seasonId !== effectiveSeasonId) setSelectedMatchId('');
  }, [effectiveSeasonId, selectedMatchId, matches]);
  const [isExporting, setIsExporting] = React.useState(false);
  const lineupRef = React.useRef<HTMLDivElement>(null);

  const [isMatchConfirmOpen, setIsMatchConfirmOpen] = React.useState(false);

  // Auto-load lineup if initialMatchId is provided
  React.useEffect(() => {
    if (initialMatchId) {
      const match = matches.find(m => m.id === initialMatchId);
      if (match) {
        if (globalSeasonId === 'all') {
          setLocalSeasonForAll(match.seasonId);
        }
        setSelectedMatchId(initialMatchId);
        
        const associatedLineup = lineups.find(l => l.matchId === initialMatchId);
        if (associatedLineup) {
          const formation = FORMATIONS.find(f => f.name === associatedLineup.formation) || FORMATIONS[0];
          setActiveFormation(formation);
          setCurrentLineup(associatedLineup.slots.map(s => s.playerId));
        } else {
          // Reset lineup if no associated lineup
          setCurrentLineup(new Array(7).fill(null));
        }
      }
      // Clear the initial ID so it doesn't re-trigger on every render
      onClearInitialMatchId?.();
    }
  }, [initialMatchId, lineups, matches, onClearInitialMatchId, globalSeasonId]);

  const filteredMatches = matches
    .filter((m) => !!effectiveSeasonId && m.seasonId === effectiveSeasonId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const selectedMatch = matches.find(m => m.id === selectedMatchId);

  // Players that belong to the selected season
  const seasonPlayers = React.useMemo(() => {
    let filtered = players;
    if (effectiveSeasonId) {
      const seasonPlayerIds = playerSeasons
        .filter(ps => ps.seasonId === effectiveSeasonId)
        .map(ps => ps.playerId);
      filtered = players.filter(p => seasonPlayerIds.includes(p.id));
    }
    // Filter out injured and inactive players
    return filtered.filter(p => {
      const activeInjury = injuries.some(i => i.playerId === p.id && !i.endDate);
      return p.isActive !== false && !activeInjury;
    });
  }, [players, playerSeasons, effectiveSeasonId, injuries]);

  // Eligible players: are in the season AND (if match selected) are attending
  const eligiblePlayers = seasonPlayers.filter(p => {
    if (!selectedMatchId) return true;
    const stat = stats.find(s => s.matchId === selectedMatchId && s.playerId === p.id);
    return stat ? stat.attendance === 'attending' : false;
  });

  // Not eligible: are in the season BUT (if match selected) are NOT attending
  const notEligiblePlayers = seasonPlayers.filter(p => {
    if (!selectedMatchId) return false;
    const stat = stats.find(s => s.matchId === selectedMatchId && s.playerId === p.id);
    return stat ? stat.attendance !== 'attending' : true;
  });

  const benchPlayers = eligiblePlayers.filter(p => !currentLineup.includes(p.id));
  const startingPlayersCount = currentLineup.filter(id => id !== null).length;

  const getPosLabel = (pos: string) => {
    switch (pos) {
      case 'Portero': return 'POR';
      case 'Defensa': return 'DEF';
      case 'Medio': return 'MED';
      case 'Delantero': return 'DEL';
      default: return pos;
    }
  };

  const groupedPlayers = React.useMemo(() => {
    const groups: Record<string, Player[]> = {
      'Portero': [],
      'Defensa': [],
      'Medio': [],
      'Delantero': []
    };
    eligiblePlayers.forEach(p => {
      if (groups[p.position]) groups[p.position].push(p);
    });
    return groups;
  }, [eligiblePlayers]);

  const eligiblePlayersCount = eligiblePlayers.length;

  const handleDrop = (index: number) => {
    if (!draggedPlayerId) return;
    
    const newLineup = [...currentLineup];
    // If player is already in lineup, remove from old position
    const oldIndex = newLineup.indexOf(draggedPlayerId);
    if (oldIndex !== -1) newLineup[oldIndex] = null;
    
    newLineup[index] = draggedPlayerId;
    setCurrentLineup(newLineup);
    setDraggedPlayerId(null);
  };

  const removeFromLineup = (index: number) => {
    const newLineup = [...currentLineup];
    newLineup[index] = null;
    setCurrentLineup(newLineup);
  };

  const resetLineup = () => setCurrentLineup(new Array(7).fill(null));

  const handleSave = (associateWithMatch: boolean = false) => {
    if (!lineupName) return;
    
    const slots: LineupSlot[] = activeFormation.slots.map((slot, i) => ({
      ...slot,
      playerId: currentLineup[i]
    }));

    const benchPlayerIds = eligiblePlayers
      .filter(p => !currentLineup.includes(p.id))
      .map(p => p.id);

    onSaveLineup({
      name: lineupName,
      formation: activeFormation.name,
      slots,
      matchId: associateWithMatch ? selectedMatchId : undefined,
      benchPlayerIds,
      createdAt: new Date().toISOString()
    } as any);
    
    setLineupName('');
    setIsSaveDialogOpen(false);
    setIsMatchConfirmOpen(false);
  };

  const onInitialSaveClick = () => {
    if (!lineupName) return;
    if (effectiveSeasonId && selectedMatchId) {
      setIsMatchConfirmOpen(true);
    } else {
      handleSave(false);
    }
  };

  const loadLineup = (l: Lineup) => {
    if (l.matchId) {
      const match = matches.find(m => m.id === l.matchId);
      if (match) {
        if (globalSeasonId === 'all') {
          setLocalSeasonForAll(match.seasonId);
        }
        setSelectedMatchId(l.matchId);
      }
    }
    const formation = FORMATIONS.find(f => f.name === l.formation) || FORMATIONS[0];
    setActiveFormation(formation);
    setCurrentLineup(l.slots.map(s => s.playerId));
  };

  const handleExportImage = async () => {
    if (!lineupRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(lineupRef.current, {
        cacheBust: true,
        backgroundColor: '#F5F5F0',
        pixelRatio: 2,
        filter: (node: any) => {
          const isNoExport = node.classList?.contains('no-export');
          return !isNoExport;
        }
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `alineacion-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.click();
    } catch (error) {
      console.error('Error exporting image:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Simulador de Alineación</h2>
          <p className="text-gray-500">Arrastra los jugadores al campo para probar tácticas.</p>
        </div>
        
        <div className="flex flex-col gap-4 w-full lg:w-auto">
          <div className="flex flex-wrap items-center gap-4">
            {globalSeasonId === 'all' && seasons.length > 0 && (
              <div className="flex flex-col gap-1 min-w-[140px]">
                <Label className="text-[10px] font-black text-gray-400 uppercase ml-1">Temporada</Label>
                <select
                  className="bg-white border border-gray-200 rounded-xl h-10 px-3 text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none max-w-[220px]"
                  value={localSeasonForAll || latestSeasonId}
                  onChange={(e) => setLocalSeasonForAll(e.target.value)}
                >
                  {[...seasons]
                    .sort((a, b) => b.startYear - a.startYear)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.division ? ` · ${s.division}` : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1 min-w-[200px] sm:min-w-[280px] flex-1 max-w-full">
                <Label className="text-[10px] font-black text-gray-400 uppercase ml-1">Partido</Label>
                <select 
                  className="bg-white border border-gray-200 rounded-xl h-10 px-3 text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none w-full max-w-md"
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                >
                  <option value="">Selecciona partido...</option>
                  {filteredMatches.map(m => (
                    <option key={m.id} value={m.id}>
                      {formatMatchOptionLabel(m, seasons, opponents)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-[10px] font-black text-gray-400 uppercase ml-1">Formación</Label>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {FORMATIONS.map(f => (
                  <button
                    key={f.name}
                    onClick={() => {
                      setActiveFormation(f);
                      resetLineup();
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                      activeFormation.name === f.name 
                        ? "bg-white text-emerald-700 shadow-sm" 
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full justify-end">
            <Button 
              variant="outline" 
              onClick={handleExportImage} 
              disabled={isExporting}
              className="rounded-xl border-gray-200 h-10"
            >
              {isExporting ? 'Exportando...' : 'Descargar'}
            </Button>
            <Button variant="outline" onClick={resetLineup} className="rounded-xl border-gray-200 h-10">
              <RotateCcw size={16} className="mr-2" /> Reiniciar
            </Button>
            
              <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogTrigger render={
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10">
                    <Save size={16} className="mr-2" /> Guardar
                  </Button>
                } />
                <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Guardar Alineación</DialogTitle>
                  <DialogDescription>Asigna un nombre a esta configuración táctica.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="name">Nombre de la alineación</Label>
                  <Input 
                    id="name" 
                    value={lineupName} 
                    onChange={(e) => setLineupName(e.target.value)} 
                    placeholder="Ej: Táctica Ofensiva Final"
                    className="rounded-xl mt-2"
                  />
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={onInitialSaveClick} 
                    disabled={!lineupName} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl w-full"
                  >
                    Confirmar Guardado
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Match Association Confirmation Dialog */}
            <Dialog open={isMatchConfirmOpen} onOpenChange={setIsMatchConfirmOpen}>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>¿Asociar al partido?</DialogTitle>
                  <DialogDescription>
                    Has seleccionado un partido. ¿Quieres vincular esta alineación a la convocatoria de{' '}
                    {selectedMatch ? formatMatchOptionLabel(selectedMatch, seasons, opponents) : ''}?
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <p className="text-sm text-emerald-800 font-medium">
                    Si aceptas, esta alineación aparecerá directamente en la ficha del partido.
                  </p>
                </div>
                <DialogFooter className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => handleSave(false)} 
                    className="flex-1 rounded-xl"
                  >
                    No, solo guardar
                  </Button>
                  <Button 
                    onClick={() => handleSave(true)} 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                  >
                    Sí, asociar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Sidebar: Plantilla */}
        <div className="xl:col-span-3 space-y-6">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden sticky top-8">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Plantilla</CardTitle>
                  <p className="text-[9px] text-gray-500 font-medium">Convocados</p>
                </div>
                <div className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-black">
                  {eligiblePlayersCount}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="space-y-5">
                {(['Portero', 'Defensa', 'Medio', 'Delantero'] as const).map(pos => (
                  <div key={pos} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{getPosLabel(pos)}</h3>
                      <div className="h-px flex-1 bg-gray-100" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {groupedPlayers[pos].map(player => {
                        const isInLineup = currentLineup.includes(player.id);
                        return (
                          <Tooltip key={player.id}>
                            <TooltipTrigger>
                              <div
                                draggable={!isInLineup}
                                onDragStart={() => setDraggedPlayerId(player.id)}
                                className={cn(
                                  "relative flex flex-col items-center transition-all group",
                                  isInLineup ? "opacity-30 grayscale" : "cursor-grab active:cursor-grabbing"
                                )}
                              >
                                <div className={cn(
                                  "relative aspect-[3/4] w-full rounded-lg overflow-hidden border transition-all",
                                  isInLineup 
                                    ? "border-gray-100" 
                                    : "border-gray-100 group-hover:border-emerald-400 group-hover:shadow-md"
                                )}>
                                  <img 
                                    src={player.photoUrl || `https://picsum.photos/seed/${player.id}/80/100`} 
                                    className="w-full h-full object-cover"
                                    alt={player.alias || player.firstName}
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-[1px] py-0.5 px-1">
                                    <p className="text-[8px] font-bold text-center text-white truncate leading-tight">
                                      {player.alias || player.firstName}
                                    </p>
                                  </div>
                                  <div className="absolute top-0.5 right-0.5 bg-emerald-600 text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center shadow-sm border border-white/50">
                                    {player.number}
                                  </div>
                                  {isInLineup && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                                      <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-gray-900 text-white border-none font-bold text-[10px] px-2 py-1">
                              {player.alias || `${player.firstName} ${player.lastName}`}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Area (Field + Bench) for Export */}
        <div className="xl:col-span-9 grid grid-cols-1 xl:grid-cols-9 gap-6" ref={lineupRef}>
          {/* Middle Content: Field */}
          <div className="xl:col-span-6 space-y-8">
            <div className="w-full">
              <Card className="border-none shadow-sm bg-emerald-700 overflow-hidden relative aspect-[3/4] sm:aspect-[4/3] rounded-3xl">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  {/* Field Markings */}
                  <div className="absolute inset-4 border-2 border-white rounded-lg" />
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-white" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white rounded-full" />
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-48 h-24 border-2 border-white rounded-b-xl" />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-48 h-24 border-2 border-white rounded-t-xl" />
                </div>

                <div className="relative h-full w-full">
                  {activeFormation.slots.map((slot, i) => {
                    const playerId = currentLineup[i];
                    const player = players.find(p => p.id === playerId);
                    
                    return (
                      <div
                        key={i}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(i)}
                        className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
                        style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                      >
                        <div className={cn(
                          "flex flex-col items-center justify-center transition-all",
                          player 
                            ? "scale-110 z-10" 
                            : "w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-dashed bg-emerald-800/50 border-emerald-500/50 hover:bg-emerald-800/80"
                        )}>
                          {player ? (
                            <div className="group/player relative flex flex-col items-center">
                              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
                                <img 
                                  src={player.photoUrl || `https://picsum.photos/seed/${player.id}/100/120`} 
                                  className="w-16 h-20 sm:w-20 sm:h-24 object-cover"
                                  alt=""
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-[2px] py-1 px-1">
                                  <p className="text-[8px] sm:text-[10px] font-black text-center text-white truncate leading-tight">
                                    {player.alias || player.firstName}
                                  </p>
                                </div>
                                <div className="absolute top-1 right-1 bg-white text-emerald-900 text-[9px] sm:text-[11px] font-black h-5 w-5 sm:h-6 sm:w-6 rounded-full flex items-center justify-center shadow-lg border border-emerald-100">
                                  {player.number}
                                </div>
                              </div>
                              
                              {/* Remove Button - Moved outside overflow-hidden */}
                              <button
                                onClick={() => removeFromLineup(i)}
                                className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1.5 shadow-xl opacity-0 group-hover/player:opacity-100 transition-opacity z-30 no-export hover:bg-red-600 active:scale-90"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-emerald-400 font-bold text-xs">{slot.pos}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Not Available section */}
            {notEligiblePlayers.length > 0 && (
              <div className="mt-10 no-export">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Users size={20} className="text-gray-400" />
                    No Disponibles (Fuera de Convocatoria)
                  </h3>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                    {notEligiblePlayers.length} Jugadores
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 opacity-50">
                  {notEligiblePlayers.map(player => (
                    <div 
                      key={player.id} 
                      className="flex flex-col items-center gap-1 grayscale"
                    >
                      <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                        <img 
                          src={player.photoUrl || `https://picsum.photos/seed/${player.id}/100/130`} 
                          className="w-full h-full object-cover"
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="text-center w-full px-1">
                        <p className="text-[11px] font-bold truncate leading-tight text-gray-500">
                          {player.alias || player.firstName}
                        </p>
                        <p className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">
                          {getPosLabel(player.position)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Banquillo & Saved */}
          <div className="xl:col-span-3 space-y-6">
            {/* Banquillo section */}
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
              <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-emerald-900">Banquillo</CardTitle>
                    <p className="text-[9px] text-emerald-700 font-medium">Jugadores de refresco</p>
                  </div>
                  <div className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-black">
                    {benchPlayers.length}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="grid grid-cols-3 gap-2">
                  {benchPlayers.map(player => (
                    <div 
                      key={player.id} 
                      draggable
                      onDragStart={() => setDraggedPlayerId(player.id)}
                      className="flex flex-col items-center transition-all group cursor-grab active:cursor-grabbing"
                    >
                      <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden border border-gray-100 bg-white group-hover:border-emerald-400 transition-all">
                        <img 
                          src={player.photoUrl || `https://picsum.photos/seed/${player.id}/80/100`} 
                          className="w-full h-full object-cover"
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-[1px] py-0.5 px-1">
                          <p className="text-[8px] font-bold text-center text-white truncate leading-tight">
                            {player.alias || player.firstName}
                          </p>
                        </div>
                        <div className="absolute top-0.5 right-0.5 bg-emerald-600 text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-white/50">
                          {player.number}
                        </div>
                      </div>
                    </div>
                  ))}
                  {benchPlayers.length === 0 && (
                    <div className="col-span-3 py-8 text-center">
                      <p className="text-[10px] text-gray-400 italic">No hay jugadores en el banquillo.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Saved Lineups */}
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden no-export">
              <CardHeader className="py-3 px-4 border-b border-gray-100 bg-gray-50/50">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  Guardadas
                  <ChevronDown size={14} className="text-gray-400" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 max-h-[250px] overflow-y-auto">
                {lineups.map(l => (
                  <div key={l.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl group transition-colors">
                    <button 
                      onClick={() => loadLineup(l)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-xs font-bold truncate">{l.name}</p>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[9px] text-gray-400">{l.formation} • {new Date(l.createdAt).toLocaleDateString()}</p>
                        {l.matchId && (
                          (() => {
                            const match = matches.find(m => m.id === l.matchId);
                            if (!match) return null;
                            return (
                              <p className="text-[8px] text-emerald-600 font-bold leading-snug line-clamp-2">
                                <span className="inline-flex items-start gap-1">
                                  <Calendar size={8} className="shrink-0 mt-0.5" />
                                  <span>{formatMatchOptionLabel(match, seasons, opponents)}</span>
                                </span>
                              </p>
                            );
                          })()
                        )}
                      </div>
                    </button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onDeleteLineup(l.id)}
                      className="h-6 w-6 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
                {lineups.length === 0 && (
                  <p className="text-[10px] text-center text-gray-400 py-4 italic">No hay alineaciones.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-blue-50 rounded-2xl no-export">
              <CardContent className="p-4 flex gap-3">
                <Info className="text-blue-500 shrink-0" size={16} />
                <p className="text-[10px] text-blue-700 leading-relaxed">
                  <strong>Tip:</strong> Arrastra desde el banquillo o la plantilla al campo.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
