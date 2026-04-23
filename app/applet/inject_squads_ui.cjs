const fs = require('fs');
let code = fs.readFileSync('src/components/AIAnalysis.tsx', 'utf8');

const returnStart = '  return (\n    <div className="space-y-4">\n      <Card className="border-none shadow-sm rounded-2xl">';

const tabsUI = `
  const renderSquadsTab = () => {
    const analyzedMatches = filteredMatches.filter(m => squadAnalysis.has(m.id)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <Card className="border-none shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="text-emerald-600" size={20} />
            Estudio de Convocatorias
          </CardTitle>
          <CardDescription>Análisis independiente del nivel de la plantilla reunida por partido.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analyzedMatches.length === 0 ? (
               <p className="col-span-full text-center py-8 text-gray-400 italic text-sm">No hay convocatorias con 5 o más jugadores analizadas.</p>
            ) : (
               analyzedMatches.map(match => {
                 const analysis = squadAnalysis.get(match.id);
                 if (!analysis) return null;
                 const opponent = opponents.find(o => o.id === match.opponentId);
                 const season = seasons.find(s => s.id === match.seasonId);

                 const gradeColors = {
                   'S': 'bg-emerald-100 text-emerald-800 border-emerald-300',
                   'A': 'bg-green-100 text-green-800 border-green-300',
                   'B': 'bg-blue-100 text-blue-800 border-blue-300',
                   'C': 'bg-amber-100 text-amber-800 border-amber-300',
                   'D': 'bg-red-100 text-red-800 border-red-300'
                 };

                 return (
                   <div key={match.id} className="flex flex-col p-4 bg-white rounded-2xl shadow-sm border border-gray-100 relative">
                     <div className="flex justify-between items-start mb-4">
                       <div className="flex gap-3">
                         <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                           {opponent?.shieldUrl ? (
                             <img src={opponent.shieldUrl} alt={opponent?.name || 'Rival'} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                           ) : (
                             <Shield size={24} className="text-gray-300" />
                           )}
                         </div>
                         <div>
                           <p className="font-bold text-gray-900">{opponent?.name || 'Rival desconocido'}</p>
                           <p className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={12}/> {format(new Date(match.date), 'dd MMM yyyy', { locale: es })}</p>
                         </div>
                       </div>
                       
                       <div className="flex flex-col items-end gap-1">
                         <div className={cn("px-3 py-1 text-lg font-black rounded-lg border", gradeColors[analysis.grade as keyof typeof gradeColors])}>
                            GRADO {analysis.grade}
                         </div>
                         <p className="text-[10px] text-gray-500 font-bold">PUNTUACIÓN: {analysis.score}/100</p>
                       </div>
                     </div>

                     <div className="mb-4">
                        <div className="flex items-center gap-1 mb-2">
                           <Users size={14} className="text-gray-400" />
                           <span className="text-xs font-bold text-gray-700">{analysis.attendingCount} Jugadores Convocados</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                           <div className={cn("h-2 rounded-full transition-all", analysis.score >= 75 ? "bg-emerald-500" : analysis.score >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: \`\${analysis.score}%\` }}></div>
                        </div>
                     </div>

                     <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-600 space-y-2">
                        {analysis.reasons.slice(0, 4).map((r, i) => (
                           <div key={i} className="flex gap-2 items-start">
                             <div className="mt-0.5 shrink-0">
                                {r.type === 'positive' && <ShieldCheck size={14} className="text-emerald-500" />}
                                {r.type === 'negative' && <ShieldAlert size={14} className="text-red-500" />}
                                {r.type === 'neutral' && <Minus size={14} className="text-amber-500" />}
                             </div>
                             <span className="leading-tight w-full break-words whitespace-normal">{r.text}</span>
                           </div>
                        ))}
                        {analysis.reasons.length > 4 && (
                          <div className="text-[10px] text-gray-400 font-medium pl-6 pt-1">
                            + {analysis.reasons.length - 4} factor(es) adicional(es)
                          </div>
                        )}
                     </div>
                   </div>
                 );
               })
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex bg-white rounded-xl shadow-sm p-1 border border-[#141414]/10 w-fit">
        <Button 
          variant={activeAITab === 'predictions' ? 'default' : 'ghost'} 
          onClick={() => setActiveAITab('predictions')}
          className={cn(
             "rounded-lg px-4 h-9 font-medium text-sm transition-all",
             activeAITab === 'predictions' ? 'bg-[#141414] text-white shadow-sm hover:bg-[#141414]/90' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          )}
        >
          Predicciones de Partido
        </Button>
        <Button 
          variant={activeAITab === 'squads' ? 'default' : 'ghost'} 
          onClick={() => setActiveAITab('squads')}
          className={cn(
             "rounded-lg px-4 h-9 font-medium text-sm transition-all flex items-center gap-2",
             activeAITab === 'squads' ? 'bg-[#141414] text-white shadow-sm hover:bg-[#141414]/90' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          )}
        >
          <ClipboardCheck size={16} />
          Estudio de Convocatorias
        </Button>
      </div>

      {activeAITab === 'squads' ? renderSquadsTab() : (
      <Card className="border-none shadow-sm rounded-2xl">
`;

code = code.replace(returnStart, tabsUI);

const closingTarget = '      <Dialog open={!!recommendedMatchId} onOpenChange={(open) => !open && setRecommendedMatchId(null)}>';
const finalCode = code.replace(closingTarget, '      )}\n\n' + closingTarget);

fs.writeFileSync('src/components/AIAnalysis.tsx', finalCode);
