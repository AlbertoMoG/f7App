import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Player, Season, SeasonFees, PlayerPayment, Match, PlayerSeason } from '../types';
import { DollarSign, PieChart as PieChartIcon, Save, Users, Target, Activity, CheckCircle2, ChevronDown, ChevronUp, ShieldAlert, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';

export default function Treasury({ teamId }: { teamId: string }) {
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerSeasons, setPlayerSeasons] = useState<PlayerSeason[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [fees, setFees] = useState<SeasonFees | null>(null);
  const [payments, setPayments] = useState<Record<string, PlayerPayment>>({});
  
  // Form state for fees
  const [ficha, setFicha] = useState(0);
  const [inscripcion, setInscripcion] = useState(0);
  const [seguro, setSeguro] = useState(0);
  const [arbitroPerMatch, setArbitroPerMatch] = useState(0);
  const [expectedMatches, setExpectedMatches] = useState(0);
  const [installments, setInstallments] = useState(1);
  const [previousBalance, setPreviousBalance] = useState(0);

  // Form state for payments
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});

  // Collapsible states
  const [expandedCharts, setExpandedCharts] = useState<Record<string, boolean>>({
    ficha: true,
    seguro: true,
    arbitros: true
  });

  const toggleChart = (key: string) => {
    setExpandedCharts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [seasonsSnap, playersSnap, playerSeasonsSnap, matchesSnap] = await Promise.all([
          getDocs(query(collection(db, 'seasons'), where('teamId', '==', teamId))),
          getDocs(query(collection(db, 'players'), where('teamId', '==', teamId))),
          getDocs(query(collection(db, 'playerSeasons'))),
          getDocs(query(collection(db, 'matches'), where('teamId', '==', teamId)))
        ]);

        const seasonsData = seasonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Season));
        setSeasons(seasonsData);
        setPlayers(playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
        setPlayerSeasons(playerSeasonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerSeason)));
        setMatches(matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match)));

        if (seasonsData.length > 0) {
          // Select most recent season by default (assuming last created or just first for now)
          setSelectedSeasonId(seasonsData[seasonsData.length - 1].id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching treasury data:", error);
        toast.error("Error al cargar los datos");
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId]);

  useEffect(() => {
    const fetchSeasonTreasury = async () => {
      if (!selectedSeasonId) return;
      setLoading(true);
      try {
        // Fetch fees
        const feesDoc = await getDoc(doc(db, 'seasonFees', selectedSeasonId));
        if (feesDoc.exists()) {
          const feesData = { id: feesDoc.id, ...feesDoc.data() } as SeasonFees;
          setFees(feesData);
          setFicha(feesData.ficha || 0);
          setInscripcion(feesData.inscripcion || 0);
          setSeguro(feesData.seguro || 0);
          setArbitroPerMatch(feesData.arbitroPerMatch || 0);
          setExpectedMatches(feesData.expectedMatches || 0);
          setInstallments(feesData.installments || 1);
          setPreviousBalance(feesData.previousBalance || 0);
        } else {
          setFees(null);
          setFicha(0);
          setInscripcion(0);
          setSeguro(0);
          setArbitroPerMatch(0);
          setExpectedMatches(0);
          setInstallments(1);
          setPreviousBalance(0);
        }

        // Fetch payments
        const paymentsSnap = await getDocs(query(collection(db, 'playerPayments'), where('seasonId', '==', selectedSeasonId)));
        const paymentsData: Record<string, PlayerPayment> = {};
        const inputsData: Record<string, string> = {};
        
        paymentsSnap.docs.forEach(d => {
          const p = { id: d.id, ...d.data() } as PlayerPayment;
          paymentsData[p.playerId] = p;
          inputsData[p.playerId] = p.amountPaid.toString();
        });
        
        setPayments(paymentsData);
        setPaymentInputs(inputsData);
      } catch (error) {
        console.error("Error fetching season treasury:", error);
        toast.error("Error al cargar la tesorería de la temporada");
      } finally {
        setLoading(false);
      }
    };

    fetchSeasonTreasury();
  }, [selectedSeasonId]);

  const handleSavePayment = async (playerId: string) => {
    if (!selectedSeasonId) return;
    const amount = parseFloat(paymentInputs[playerId]) || 0;
    
    try {
      const paymentId = payments[playerId]?.id || `${selectedSeasonId}_${playerId}`;
      const paymentData: PlayerPayment = {
        id: paymentId,
        playerId,
        seasonId: selectedSeasonId,
        teamId,
        amountPaid: amount
      };
      
      await setDoc(doc(db, 'playerPayments', paymentId), paymentData);
      setPayments(prev => ({ ...prev, [playerId]: paymentData }));
      toast.success("Pago actualizado");
    } catch (error) {
      console.error("Error saving payment:", error);
      toast.error("Error al actualizar el pago");
    }
  };

  // Calculations
  const seasonPlayers = useMemo(() => {
    const playerIdsInSeason = new Set(playerSeasons.filter(ps => ps.seasonId === selectedSeasonId).map(ps => ps.playerId));
    return players.filter(p => playerIdsInSeason.has(p.id));
  }, [players, playerSeasons, selectedSeasonId]);

  const numPlayers = seasonPlayers.length;
  
  const totalInscripcionPerPlayer = numPlayers > 0 ? inscripcion / numPlayers : 0;
  const totalArbitrosPerPlayer = numPlayers > 0 ? (arbitroPerMatch * expectedMatches) / numPlayers : 0;
  const discountPerPlayer = numPlayers > 0 ? previousBalance / numPlayers : 0;
  
  const totalExpectedPerPlayer = Math.max(0, ficha + seguro + totalInscripcionPerPlayer + totalArbitrosPerPlayer - discountPerPlayer);
  const totalExpectedTeam = totalExpectedPerPlayer * numPlayers;
  
  const totalCollected = Object.values(payments).reduce((sum, p) => sum + p.amountPaid, 0);
  const totalPending = totalExpectedTeam - totalCollected;

  // Arbitros calculations
  const seasonMatches = matches.filter(m => m.seasonId === selectedSeasonId);
  const completedMatches = seasonMatches.filter(m => m.status === 'completed').length;
  const arbitrosPaid = completedMatches * arbitroPerMatch;
  
  // Let's assume the collected money goes to: 1. Inscripcion, 2. Seguro, 3. Ficha, 4. Arbitros
  // Or we can just calculate how much is left for arbitros after fixed costs.
  const fixedCosts = inscripcion + (seguro * numPlayers) + (ficha * numPlayers);
  const moneyForArbitros = Math.max(0, totalCollected + previousBalance - fixedCosts);
  const matchesCanPay = arbitroPerMatch > 0 ? Math.floor(moneyForArbitros / arbitroPerMatch) : 0;
  const matchesPendingPay = Math.max(0, completedMatches - matchesCanPay);

  // Global coverage calculations
  let remDiscountGlobal = previousBalance;
  const reqArbitrosGlobal = Math.max(0, (arbitroPerMatch * expectedMatches) - remDiscountGlobal);
  remDiscountGlobal = Math.max(0, remDiscountGlobal - (arbitroPerMatch * expectedMatches));
  
  const reqSeguroGlobal = Math.max(0, (seguro * numPlayers) - remDiscountGlobal);
  remDiscountGlobal = Math.max(0, remDiscountGlobal - (seguro * numPlayers));
  
  const reqFichaInscripcionGlobal = Math.max(0, (ficha * numPlayers + inscripcion) - remDiscountGlobal);

  let remCollectedGlobal = totalCollected;
  const coveredFichaInscripcion = Math.min(reqFichaInscripcionGlobal, remCollectedGlobal);
  remCollectedGlobal = Math.max(0, remCollectedGlobal - coveredFichaInscripcion);
  
  const coveredSeguro = Math.min(reqSeguroGlobal, remCollectedGlobal);
  remCollectedGlobal = Math.max(0, remCollectedGlobal - coveredSeguro);
  
  const coveredArbitros = Math.min(reqArbitrosGlobal, remCollectedGlobal);

  const chartDataFicha = [
    { name: 'Cubierto', value: coveredFichaInscripcion, color: '#3B82F6' },
    { name: 'Pendiente', value: Math.max(0, reqFichaInscripcionGlobal - coveredFichaInscripcion), color: '#4B5563' }
  ];

  const chartDataSeguro = [
    { name: 'Cubierto', value: coveredSeguro, color: '#F59E0B' },
    { name: 'Pendiente', value: Math.max(0, reqSeguroGlobal - coveredSeguro), color: '#4B5563' }
  ];

  const chartDataArbitros = [
    { name: 'Cubierto', value: coveredArbitros, color: '#EC4899' },
    { name: 'Pendiente', value: Math.max(0, reqArbitrosGlobal - coveredArbitros), color: '#4B5563' }
  ];

  const costBreakdownData = [
    { name: 'Fichas', value: ficha * numPlayers, color: '#3B82F6' },
    { name: 'Inscripción', value: inscripcion, color: '#8B5CF6' },
    { name: 'Seguro', value: seguro * numPlayers, color: '#F59E0B' },
    { name: 'Árbitros (Est.)', value: arbitroPerMatch * expectedMatches, color: '#EC4899' }
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-20">
      <div className="max-w-screen-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <DollarSign className="text-emerald-600" size={32} />
              Tesorería
            </h1>
            <p className="text-gray-500 mt-1">Gestiona las cuotas y pagos del equipo</p>
          </div>
          
          <div className="w-64">
            <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
              <SelectTrigger className="bg-white border-gray-200 rounded-xl h-12">
                <SelectValue>
                  {selectedSeasonId ? seasons.find(s => s.id === selectedSeasonId)?.name : 'Selecciona temporada'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {seasons.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex flex-col">
                      <span className="font-bold">{s.name}</span>
                      {s.division && <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{s.division}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!selectedSeasonId ? (
          <Card className="border-none shadow-sm rounded-3xl">
            <CardContent className="p-12 text-center text-gray-500">
              Selecciona una temporada para ver la tesorería.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Resumen y Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Desglose Numérico (Factura) */}
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden lg:col-span-1">
                <CardHeader className="bg-white border-b border-gray-50 p-6">
                  <CardTitle className="text-lg font-black flex items-center gap-2">
                    <Receipt className="text-emerald-600" size={20} />
                    Desglose de Cuota
                  </CardTitle>
                  <CardDescription>Detalle de costes por jugador</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Ficha Individual</span>
                        <span className="font-mono font-bold">{ficha.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Inscripción Equipo (Prorrateada)</span>
                        <span className="font-mono font-bold">{totalInscripcionPerPlayer.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Seguro Individual</span>
                        <span className="font-mono font-bold">{seguro.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Árbitros ({expectedMatches} partidos)</span>
                        <span className="font-mono font-bold">{totalArbitrosPerPlayer.toFixed(2)}€</span>
                      </div>
                      
                      <div className="h-px bg-gray-200 my-2" />
                      
                      <div className="flex justify-between items-center text-sm text-emerald-600">
                        <span className="font-bold">Sobrante Temporada Anterior</span>
                        <span className="font-mono font-bold">-{discountPerPlayer.toFixed(2)}€</span>
                      </div>
                      
                      <div className="h-px bg-gray-200 my-2" />
                      
                      <div className="flex justify-between items-center">
                        <span className="text-base font-black text-gray-900">TOTAL A PAGAR</span>
                        <span className="text-xl font-black text-emerald-600 font-mono">{totalExpectedPerPlayer.toFixed(2)}€</span>
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">
                      {installments > 1 ? `${installments} PAGOS DE ${(totalExpectedPerPlayer / installments).toFixed(2)}€` : 'PAGO ÚNICO'}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ficha + Inscripción */}
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                <CardHeader 
                  className="bg-white border-b border-gray-50 p-6 cursor-pointer hover:bg-gray-50 transition-colors flex flex-row items-center justify-between"
                  onClick={() => toggleChart('ficha')}
                >
                  <div>
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                      <Target className="text-blue-600" size={20} />
                      Ficha + Inscripción
                    </CardTitle>
                    <CardDescription>Estado de cobertura global</CardDescription>
                  </div>
                  {expandedCharts.ficha ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </CardHeader>
                {expandedCharts.ficha && (
                  <CardContent className="p-6">
                    <div className="h-48 relative flex items-center justify-center">
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-2xl font-black text-gray-900">
                          {reqFichaInscripcionGlobal > 0 ? ((coveredFichaInscripcion / reqFichaInscripcionGlobal) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartDataFicha}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {chartDataFicha.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value.toFixed(2)}€`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex justify-between text-xs font-bold">
                      <span className="text-blue-600">Cubierto: {coveredFichaInscripcion.toFixed(2)}€</span>
                      <span className="text-gray-600">Pendiente: {(reqFichaInscripcionGlobal - coveredFichaInscripcion).toFixed(2)}€</span>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Seguro */}
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                <CardHeader 
                  className="bg-white border-b border-gray-50 p-6 cursor-pointer hover:bg-gray-50 transition-colors flex flex-row items-center justify-between"
                  onClick={() => toggleChart('seguro')}
                >
                  <div>
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                      <ShieldAlert className="text-amber-600" size={20} />
                      Seguro Individual
                    </CardTitle>
                    <CardDescription>Estado de cobertura global</CardDescription>
                  </div>
                  {expandedCharts.seguro ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </CardHeader>
                {expandedCharts.seguro && (
                  <CardContent className="p-6">
                    <div className="h-48 relative flex items-center justify-center">
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-2xl font-black text-gray-900">
                          {reqSeguroGlobal > 0 ? ((coveredSeguro / reqSeguroGlobal) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartDataSeguro}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {chartDataSeguro.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value.toFixed(2)}€`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex justify-between text-xs font-bold">
                      <span className="text-amber-600">Cubierto: {coveredSeguro.toFixed(2)}€</span>
                      <span className="text-gray-600">Pendiente: {(reqSeguroGlobal - coveredSeguro).toFixed(2)}€</span>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Árbitros */}
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                <CardHeader 
                  className="bg-white border-b border-gray-50 p-6 cursor-pointer hover:bg-gray-50 transition-colors flex flex-row items-center justify-between"
                  onClick={() => toggleChart('arbitros')}
                >
                  <div>
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                      <Activity className="text-pink-600" size={20} />
                      Fondo de Árbitros
                    </CardTitle>
                    <CardDescription>Estado de cobertura global</CardDescription>
                  </div>
                  {expandedCharts.arbitros ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </CardHeader>
                {expandedCharts.arbitros && (
                  <CardContent className="p-6">
                    <div className="h-48 relative flex items-center justify-center">
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-2xl font-black text-gray-900">
                          {reqArbitrosGlobal > 0 ? ((coveredArbitros / reqArbitrosGlobal) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartDataArbitros}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {chartDataArbitros.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value.toFixed(2)}€`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-pink-600">Cubierto: {coveredArbitros.toFixed(2)}€</span>
                        <span className="text-gray-600">Pendiente: {(reqArbitrosGlobal - coveredArbitros).toFixed(2)}€</span>
                      </div>
                      <div className="bg-pink-50 rounded-xl p-3 border border-pink-100">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-pink-700 uppercase tracking-widest">Partidos Cubiertos</span>
                          <span className="text-lg font-black text-pink-700">{matchesCanPay} / {expectedMatches}</span>
                        </div>
                        <div className="w-full h-1.5 bg-pink-200 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="h-full bg-pink-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (matchesCanPay / expectedMatches) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>

              {/* Pagos Individuales - Pendientes */}
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden mb-8">
                <CardHeader className="bg-white border-b border-gray-50 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-black flex items-center gap-2">
                        <Users className="text-emerald-600" size={20} />
                        Pagos Pendientes
                      </CardTitle>
                      <CardDescription>Jugadores con cuotas por saldar</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] text-gray-400 uppercase bg-gray-50/50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 font-bold tracking-widest">Jugador</th>
                          <th className="px-6 py-4 font-bold tracking-widest">Estado de Cobertura</th>
                          <th className="px-6 py-4 font-bold tracking-widest text-right">Pagado</th>
                          <th className="px-6 py-4 font-bold tracking-widest text-right">Pendiente</th>
                          <th className="px-6 py-4 font-bold tracking-widest text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seasonPlayers.filter(p => {
                          const paid = payments[p.id]?.amountPaid || 0;
                          return paid < totalExpectedPerPlayer;
                        }).map(player => {
                          const paid = payments[player.id]?.amountPaid || 0;
                          const pending = Math.max(0, totalExpectedPerPlayer - paid);
                          const progress = totalExpectedPerPlayer > 0 ? Math.min(100, (paid / totalExpectedPerPlayer) * 100) : 0;
                          
                          // Calculate requirements with discount applied to lowest priority first
                          let remDiscount = discountPerPlayer;
                          const reqArbitros = Math.max(0, totalArbitrosPerPlayer - remDiscount);
                          remDiscount = Math.max(0, remDiscount - totalArbitrosPerPlayer);
                          
                          const reqSeguro = Math.max(0, seguro - remDiscount);
                          remDiscount = Math.max(0, remDiscount - seguro);
                          
                          const reqFichaInscripcion = Math.max(0, ficha + totalInscripcionPerPlayer - remDiscount);

                          // Calculate coverage
                          let remPaid = paid;
                          const paidFichaInscripcion = Math.min(reqFichaInscripcion, remPaid);
                          remPaid = Math.max(0, remPaid - paidFichaInscripcion);
                          
                          const paidSeguro = Math.min(reqSeguro, remPaid);
                          remPaid = Math.max(0, remPaid - paidSeguro);
                          
                          const paidArbitros = Math.min(reqArbitros, remPaid);

                          return (
                            <tr key={player.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/30 transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-900">
                                {player.alias || player.firstName} {player.lastName}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div 
                                        className={cn(
                                          "h-full rounded-full transition-all duration-500",
                                          progress >= 100 ? "bg-emerald-500" : "bg-blue-500"
                                        )}
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] font-black text-gray-700 w-8">{progress.toFixed(0)}%</span>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    {reqFichaInscripcion > 0 && (
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-gray-500 font-bold uppercase tracking-tighter">Ficha + Insc.</span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-bold text-gray-700">{paidFichaInscripcion.toFixed(0)}/{reqFichaInscripcion.toFixed(0)}€</span>
                                          <div className={`w-1.5 h-1.5 rounded-full ${paidFichaInscripcion >= reqFichaInscripcion ? 'bg-emerald-500' : paidFichaInscripcion > 0 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                        </div>
                                      </div>
                                    )}
                                    {reqSeguro > 0 && (
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-gray-500 font-bold uppercase tracking-tighter">Seguro</span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-bold text-gray-700">{paidSeguro.toFixed(0)}/{reqSeguro.toFixed(0)}€</span>
                                          <div className={`w-1.5 h-1.5 rounded-full ${paidSeguro >= reqSeguro ? 'bg-emerald-500' : paidSeguro > 0 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                        </div>
                                      </div>
                                    )}
                                    {reqArbitros > 0 && (
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-gray-500 font-bold uppercase tracking-tighter">Árbitros</span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-bold text-gray-700">{paidArbitros.toFixed(0)}/{reqArbitros.toFixed(0)}€</span>
                                          <div className={`w-1.5 h-1.5 rounded-full ${paidArbitros >= reqArbitros ? 'bg-emerald-500' : paidArbitros > 0 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Input
                                    type="number"
                                    value={paymentInputs[player.id] || ''}
                                    onChange={(e) => setPaymentInputs(prev => ({ ...prev, [player.id]: e.target.value }))}
                                    className="w-24 h-8 text-right font-mono text-sm"
                                  />
                                  <span className="text-gray-500 font-bold">€</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-red-500">
                                {pending > 0 ? `${pending.toFixed(2)}€` : '-'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSavePayment(player.id)}
                                  className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg"
                                >
                                  Guardar
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        {seasonPlayers.filter(p => (payments[p.id]?.amountPaid || 0) < totalExpectedPerPlayer).length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                              No hay pagos pendientes
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Pagos Individuales - Saldados */}
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                <CardHeader className="bg-white border-b border-gray-50 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-black flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-600" size={20} />
                        Pagos Saldados
                      </CardTitle>
                      <CardDescription>Jugadores que han completado sus pagos</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] text-gray-400 uppercase bg-gray-50/50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 font-bold tracking-widest">Jugador</th>
                          <th className="px-6 py-4 font-bold tracking-widest text-right">Total Pagado</th>
                          <th className="px-6 py-4 font-bold tracking-widest text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seasonPlayers.filter(p => {
                          const paid = payments[p.id]?.amountPaid || 0;
                          return paid >= totalExpectedPerPlayer && totalExpectedPerPlayer > 0;
                        }).map(player => {
                          const paid = payments[player.id]?.amountPaid || 0;

                          return (
                            <tr key={player.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/30 transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-900">
                                {player.alias || player.firstName} {player.lastName}
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                                {paid.toFixed(2)}€
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Input
                                    type="number"
                                    value={paymentInputs[player.id] || ''}
                                    onChange={(e) => setPaymentInputs(prev => ({ ...prev, [player.id]: e.target.value }))}
                                    className="w-24 h-8 text-right font-mono text-sm"
                                  />
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleSavePayment(player.id)}
                                    className="rounded-lg"
                                  >
                                    Ajustar
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {seasonPlayers.filter(p => (payments[p.id]?.amountPaid || 0) >= totalExpectedPerPlayer && totalExpectedPerPlayer > 0).length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">
                              Aún no hay jugadores con pagos saldados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
          </div>
        )}
      </div>
    </div>
  );
}
