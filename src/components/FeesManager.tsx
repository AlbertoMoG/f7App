import React, { useState, useEffect } from 'react';
import { Season, SeasonFees, SeasonFeesInput } from '../types';
import { DollarSign, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface FeesManagerProps {
  teamId: string;
  seasons: Season[];
}

export default function FeesManager({ teamId, seasons }: FeesManagerProps) {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Fees state
  const [ficha, setFicha] = useState(0);
  const [inscripcion, setInscripcion] = useState(0);
  const [seguro, setSeguro] = useState(0);
  const [arbitroPerMatch, setArbitroPerMatch] = useState(0);
  const [expectedMatches, setExpectedMatches] = useState(0);
  const [installments, setInstallments] = useState(1);
  const [previousBalance, setPreviousBalance] = useState(0);

  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId) {
      setSelectedSeasonId(seasons[seasons.length - 1].id);
    }
  }, [seasons, selectedSeasonId]);

  useEffect(() => {
    const fetchFees = async () => {
      if (!selectedSeasonId) return;
      setLoading(true);
      try {
        const feesDoc = await getDoc(doc(db, 'seasonFees', selectedSeasonId));
        if (feesDoc.exists()) {
          const feesData = feesDoc.data() as SeasonFees;
          setFicha(feesData.ficha || 0);
          setInscripcion(feesData.inscripcion || 0);
          setSeguro(feesData.seguro || 0);
          setArbitroPerMatch(feesData.arbitroPerMatch || 0);
          setExpectedMatches(feesData.expectedMatches || 0);
          setInstallments(feesData.installments || 1);
          setPreviousBalance(feesData.previousBalance || 0);
        } else {
          // Reset if no fees exist for this season
          setFicha(0);
          setInscripcion(0);
          setSeguro(0);
          setArbitroPerMatch(0);
          setExpectedMatches(0);
          setInstallments(1);
          setPreviousBalance(0);
        }
      } catch (error) {
        console.error("Error fetching fees:", error);
        toast.error("Error al cargar las cuotas");
      } finally {
        setLoading(false);
      }
    };

    fetchFees();
  }, [selectedSeasonId]);

  const handleSaveFees = async () => {
    if (!selectedSeasonId) return;
    try {
      const feesData: SeasonFees = {
        id: selectedSeasonId,
        seasonId: selectedSeasonId,
        teamId,
        ficha,
        inscripcion,
        seguro,
        arbitroPerMatch,
        expectedMatches,
        installments,
        previousBalance
      };
      await setDoc(doc(db, 'seasonFees', selectedSeasonId), feesData);
      toast.success("Configuración de cuotas guardada");
    } catch (error) {
      console.error("Error saving fees:", error);
      toast.error("Error al guardar las cuotas");
    }
  };

  if (seasons.length === 0) {
    return (
      <Card className="border-none shadow-sm rounded-3xl">
        <CardContent className="p-12 text-center text-gray-500">
          Crea primero una temporada para poder configurar sus cuotas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="w-64">
          <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
            <SelectTrigger className="bg-white border-gray-200 rounded-xl h-12">
              <SelectValue>
                {selectedSeasonId ? seasons.find(s => s.id === selectedSeasonId)?.name : 'Selecciona temporada'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {seasons.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
        </div>
      ) : (
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-white border-b border-gray-50 p-6">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <DollarSign className="text-emerald-600" size={20} />
              Configuración de Cuotas y Tesorería
            </CardTitle>
            <CardDescription>Establece los importes para la temporada seleccionada</CardDescription>
          </CardHeader>
          <CardContent className="p-6 bg-gray-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ficha (Por Jugador)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
                  <Input 
                    type="number" 
                    value={ficha} 
                    onChange={e => setFicha(Number(e.target.value))}
                    className="pl-9 rounded-xl bg-white border-gray-200 h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Inscripción (Total Equipo)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
                  <Input 
                    type="number" 
                    value={inscripcion} 
                    onChange={e => setInscripcion(Number(e.target.value))}
                    className="pl-9 rounded-xl bg-white border-gray-200 h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Seguro (Por Jugador)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
                  <Input 
                    type="number" 
                    value={seguro} 
                    onChange={e => setSeguro(Number(e.target.value))}
                    className="pl-9 rounded-xl bg-white border-gray-200 h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Árbitro (Por Partido)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
                  <Input 
                    type="number" 
                    value={arbitroPerMatch} 
                    onChange={e => setArbitroPerMatch(Number(e.target.value))}
                    className="pl-9 rounded-xl bg-white border-gray-200 h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Partidos Estimados</Label>
                <Input 
                  type="number" 
                  value={expectedMatches} 
                  onChange={e => setExpectedMatches(Number(e.target.value))}
                  className="rounded-xl bg-white border-gray-200 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tandas de Pago</Label>
                <Input 
                  type="number" 
                  min="1"
                  value={installments} 
                  onChange={e => setInstallments(Number(e.target.value))}
                  className="rounded-xl bg-white border-gray-200 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Resultado Anterior (Sobrante)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
                  <Input 
                    type="number" 
                    value={previousBalance} 
                    onChange={e => setPreviousBalance(Number(e.target.value))}
                    className="pl-9 rounded-xl bg-white border-gray-200 h-11"
                  />
                </div>
                <p className="text-[10px] text-gray-400">Reduce el coste total a pagar por los jugadores.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveFees} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold">
                <Save className="mr-2" size={18} />
                Guardar Configuración
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
