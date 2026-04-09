import React from 'react';
import { 
  RotateCcw,
  Save,
  Info,
  Trash2,
  ChevronDown,
  Users,
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
import { Player, Lineup, LineupSlot, Match, PlayerStat, Season } from '../types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toPng } from 'html-to-image';

interface LineupSimulatorProps {
  players: Player[];
  lineups: Lineup[];
  matches: Match[];
  stats: PlayerStat[];
  seasons: Season[];
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
];

export default function LineupSimulator({ players, lineups, matches, stats, seasons, onSaveLineup, onDeleteLineup }: LineupSimulatorProps) {
  const [activeFormation, setActiveFormation] = React.useState(FORMATIONS[0]);
  const [currentLineup, setCurrentLineup] = React.useState<(string | null)[]>(new Array(7).fill(null));
  const [draggedPlayerId, setDraggedPlayerId] = React.useState<string | null>(null);
  const [lineupName, setLineupName] = React.useState('');
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = React.useState<string>('');
  const [selectedMatchId, setSelectedMatchId] = React.useState<string>('');
  const [isExporting, setIsExporting] = React.useState(false);
  const lineupRef = React.useRef<HTMLDivElement>(null);

  const filteredMatches = matches.filter(m => !selectedSeasonId || m.seasonId === selectedSeasonId);

  const eligiblePlayers = players.filter(p => {
    if (!selectedMatchId) return true;
    const stat = stats.find(s => s.matchId === selectedMatchId && s.playerId === p.id);
    return stat ? stat.attendance === 'attending' : false;
  });

  const notEligiblePlayers = players.filter(p => {
    if (!selectedMatchId) return false;
    const stat = stats.find(s => s.matchId === selectedMatchId && s.playerId === p.id);
    return stat ? stat.attendance !== 'attending' : true;
  });

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

  const resetLineup = () => setCurrentLineup(new Array(7).fill(null));

  const handleSave = () => {
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
      matchId: selectedMatchId || undefined,
      benchPlayerIds,
      createdAt: new Date().toISOString()
    });
    
    setLineupName('');
    setIsSaveDialogOpen(false);
  };

  const loadLineup = (l: Lineup) => {
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
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Simulador de Alineación</h2>
          <p className="text-gray-500">Arrastra los jugadores al campo para probar tácticas.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleExportImage} 
            disabled={isExporting}
            className="rounded-xl border-gray-200"
          >
            {isExporting ? 'Exportando...' : 'Descargar Imagen'}
          </Button>
          <Button variant="outline" onClick={resetLineup} className="rounded-xl border-gray-200">
            <RotateCcw size={16} className="mr-2" /> Reiniciar
          </Button>
          
          <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
            <DialogTrigger render={<Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" />}>
              <Save size={16} className="mr-2" /> Guardar
            </DialogTrigger>
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
              <DialogFooter>
                <Button onClick={handleSave} disabled={!lineupName} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl w-full">
                  Confirmar Guardado
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Field and Bench Container for Export */}
        <div className="xl:col-span-2" ref={lineupRef}>
          {/* Field */}
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
                        <>
                          <div className="relative flex items-end justify-center">
                            <img 
                              src={player.photoUrl || `https://picsum.photos/seed/${player.id}/100/100`} 
                              className="w-16 h-20 sm:w-20 sm:h-24 rounded-2xl object-cover drop-shadow-2xl"
                              alt=""
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute -bottom-2 -right-2 bg-white text-emerald-900 text-[10px] sm:text-xs font-black h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center shadow-lg border-2 border-emerald-100">
                              {player.number}
                            </div>
                          </div>
                          <span className="text-[10px] sm:text-xs font-black mt-2 text-center text-white drop-shadow-md bg-black/40 px-2 py-0.5 rounded-lg whitespace-nowrap">
                            {player.alias || player.firstName}
                          </span>
                        </>
                      ) : (
                        <span className="text-emerald-400 font-bold text-xs">{slot.pos}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
            {FORMATIONS.map(f => (
              <Button
                key={f.name}
                variant={activeFormation.name === f.name ? 'default' : 'outline'}
                onClick={() => {
                  setActiveFormation(f);
                  resetLineup();
                }}
                className={cn(
                  "rounded-xl px-6 h-11",
                  activeFormation.name === f.name ? "bg-emerald-600 hover:bg-emerald-700" : "bg-white border-none shadow-sm"
                )}
              >
                Formación {f.name}
              </Button>
            ))}
          </div>

          {/* Banquillo section */}
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Users size={20} className="text-emerald-600" />
                Banquillo
              </h3>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                {eligiblePlayers.filter(p => !currentLineup.includes(p.id)).length} Jugadores
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {eligiblePlayers.filter(p => !currentLineup.includes(p.id)).map(player => (
                <div 
                  key={player.id} 
                  draggable
                  onDragStart={() => setDraggedPlayerId(player.id)}
                  className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 hover:border-emerald-200 transition-colors cursor-grab active:cursor-grabbing"
                >
                  <div className="relative">
                    <img 
                      src={player.photoUrl || `https://picsum.photos/seed/${player.id}/100/100`} 
                      className="w-12 h-12 rounded-full object-cover border-2 border-emerald-100"
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[8px] font-bold h-4 w-4 rounded-full flex items-center justify-center border border-white">
                      {player.number}
                    </div>
                  </div>
                  <div className="text-center overflow-hidden w-full">
                    <p className="text-xs font-bold truncate">{player.alias || player.firstName}</p>
                    <p className="text-[10px] text-gray-500">{player.position}</p>
                  </div>
                </div>
              ))}
              {eligiblePlayers.filter(p => !currentLineup.includes(p.id)).length === 0 && (
                <p className="col-span-full text-sm text-gray-400 italic py-8 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  No hay jugadores en el banquillo.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Saved Lineups */}
          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center justify-between">
                Alineaciones Guardadas
                <ChevronDown size={16} className="text-gray-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
              {lineups.map(l => (
                <div key={l.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group">
                  <button 
                    onClick={() => loadLineup(l)}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-bold">{l.name}</p>
                    <p className="text-[10px] text-gray-400">{l.formation} • {new Date(l.createdAt).toLocaleDateString()}</p>
                  </button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => onDeleteLineup(l.id)}
                    className="h-8 w-8 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              {lineups.length === 0 && (
                <p className="text-xs text-center text-gray-400 py-4 italic">No hay alineaciones guardadas.</p>
              )}
            </CardContent>
          </Card>

          {/* Player List */}
          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Plantilla</CardTitle>
              <CardDescription>Arrastra a los jugadores al campo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-bold text-gray-500">Temporada</Label>
                  <select 
                    className="flex-1 bg-gray-50 border-none rounded-xl h-10 px-3 text-sm"
                    value={selectedSeasonId}
                    onChange={(e) => {
                      setSelectedSeasonId(e.target.value);
                      setSelectedMatchId('');
                    }}
                  >
                    <option value="">Todas las temporadas</option>
                    {seasons.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-bold text-gray-500">Partido</Label>
                  <select 
                    className="flex-1 bg-gray-50 border-none rounded-xl h-10 px-3 text-sm"
                    value={selectedMatchId}
                    onChange={(e) => setSelectedMatchId(e.target.value)}
                  >
                    <option value="">Selecciona un partido...</option>
                    {filteredMatches.map(m => (
                      <option key={m.id} value={m.id}>
                        {format(new Date(m.date), 'dd/MM')} - {m.type === 'league' ? 'Liga' : m.type === 'cup' ? 'Copa' : 'Amistoso'} {m.round ? `(${m.round})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-emerald-600 uppercase">Elegibles ({eligiblePlayers.length})</h3>
                  {eligiblePlayers.length === 0 && <p className="text-xs text-gray-400 italic">No hay jugadores elegibles.</p>}
                  {eligiblePlayers.map(player => {
                    const isInLineup = currentLineup.includes(player.id);
                    return (
                      <div
                        key={player.id}
                        draggable={!isInLineup}
                        onDragStart={() => setDraggedPlayerId(player.id)}
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-xl border transition-all",
                          isInLineup 
                            ? "bg-gray-50 border-gray-100 opacity-50 grayscale" 
                            : "bg-white border-gray-100 hover:border-emerald-200 hover:shadow-sm cursor-grab"
                        )}
                      >
                        <div className="relative">
                          <img 
                            src={player.photoUrl || `https://picsum.photos/seed/${player.id}/100/100`} 
                            className="w-10 h-12 rounded-lg object-cover"
                            alt=""
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-600 text-white text-[9px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-sm border border-white">
                            {player.number}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">
                            {player.alias || `${player.firstName} ${player.lastName}`}
                          </p>
                        </div>
                        {isInLineup && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                    );
                  })}
                </div>

                {notEligiblePlayers.length > 0 && (
                  <div className="space-y-2 opacity-60">
                    <h3 className="text-xs font-black text-gray-500 uppercase">No Elegibles ({notEligiblePlayers.length})</h3>
                    {notEligiblePlayers.map(player => (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl border bg-gray-50 border-gray-100"
                      >
                        <div className="relative">
                          <img 
                            src={player.photoUrl || `https://picsum.photos/seed/${player.id}/100/100`} 
                            className="w-10 h-12 rounded-lg object-cover grayscale"
                            alt=""
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate text-gray-500">
                            {player.alias || `${player.firstName} ${player.lastName}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-blue-50 rounded-2xl">
            <CardContent className="p-4 flex gap-3">
              <Info className="text-blue-500 shrink-0" size={20} />
              <p className="text-xs text-blue-700 leading-relaxed">
                <strong>Tip:</strong> Puedes guardar múltiples alineaciones para diferentes escenarios de juego.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
