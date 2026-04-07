import React from 'react';
import { motion } from 'motion/react';
import { 
  RotateCcw,
  Save,
  Info,
  Trash2,
  ChevronDown,
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
import { Player, Lineup, LineupSlot } from '../types';
import { cn } from '@/lib/utils';

interface LineupSimulatorProps {
  players: Player[];
  lineups: Lineup[];
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

export default function LineupSimulator({ players, lineups, onSaveLineup, onDeleteLineup }: LineupSimulatorProps) {
  const [activeFormation, setActiveFormation] = React.useState(FORMATIONS[0]);
  const [currentLineup, setCurrentLineup] = React.useState<(string | null)[]>(new Array(7).fill(null));
  const [draggedPlayerId, setDraggedPlayerId] = React.useState<string | null>(null);
  const [lineupName, setLineupName] = React.useState('');
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);

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

    onSaveLineup({
      name: lineupName,
      formation: activeFormation.name,
      slots,
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

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Simulador de Alineación</h2>
          <p className="text-gray-500">Arrastra los jugadores al campo para probar tácticas.</p>
        </div>
        <div className="flex gap-2">
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
        {/* Field */}
        <div className="xl:col-span-2">
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
                      "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex flex-col items-center justify-center transition-all border-2 border-dashed",
                      player 
                        ? "bg-white border-white shadow-xl scale-110" 
                        : "bg-emerald-800/50 border-emerald-500/50 hover:bg-emerald-800/80"
                    )}>
                      {player ? (
                        <>
                          <div className="relative">
                            <img 
                              src={player.photoUrl || `https://picsum.photos/seed/${player.id}/100/100`} 
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-emerald-100"
                              alt=""
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[8px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                              {player.number}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold mt-1 truncate max-w-[60px] text-emerald-900">
                            {player.firstName}
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
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {players.map(player => {
                const isInLineup = currentLineup.includes(player.id);
                return (
                  <div
                    key={player.id}
                    draggable={!isInLineup}
                    onDragStart={() => setDraggedPlayerId(player.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing",
                      isInLineup 
                        ? "bg-gray-50 border-gray-100 opacity-50 grayscale" 
                        : "bg-white border-gray-100 hover:border-emerald-200 hover:shadow-sm"
                    )}
                  >
                    <div className="relative">
                      <img 
                        src={player.photoUrl || `https://picsum.photos/seed/${player.id}/100/100`} 
                        className="w-10 h-10 rounded-full object-cover bg-emerald-50"
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[8px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                        {player.number}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{player.firstName} {player.lastName}</p>
                      <p className="text-[10px] text-gray-400 font-medium uppercase">{player.position}</p>
                    </div>
                    {isInLineup && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                  </div>
                );
              })}
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
