import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { Match, PlayerStat, Season } from '../types';
import { formatMatchDate, getSeasonName } from '@/lib/matchDisplayLabel';

interface AttendanceChartProps {
  matches: Match[];
  stats: PlayerStat[];
  seasons: Season[];
  globalSeasonId: string;
}

export default function AttendanceChart({ matches, stats, seasons, globalSeasonId }: AttendanceChartProps) {
  const [view, setView] = React.useState<'matchday' | 'season'>('matchday');

  const matchData = React.useMemo(() => {
    // Sort matches by date to show progression
    const sortedMatches = [...matches]
      .filter(m => m.status === 'completed')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sortedMatches.map((match, index) => {
      const matchStats = stats.filter(s => s.matchId === match.id);
      const attendingCount = matchStats.filter(s => s.attendance === 'attending').length;
      
      return {
        name: `J${match.round || index + 1}`,
        fullDate: formatMatchDate(match, 'chartDay'),
        attending: attendingCount,
        seasonName: getSeasonName(seasons, match.seasonId, { missingLabel: 'S/T' }),
        matchId: match.id,
        date: match.date
      };
    });
  }, [matches, stats, seasons]);

  const seasonData = React.useMemo(() => {
    const seasonMap = new Map<string, { total: number, count: number, name: string }>();
    
    matchData.forEach(m => {
      const current = seasonMap.get(m.seasonName) || { total: 0, count: 0, name: m.seasonName };
      current.total += m.attending;
      current.count += 1;
      seasonMap.set(m.seasonName, current);
    });

    return Array.from(seasonMap.values()).map(s => ({
      name: s.name,
      avgAttending: parseFloat((s.total / s.count).toFixed(1))
    }));
  }, [matchData]);

  if (matchData.length === 0) {
    return null;
  }

  const chartData = (view === 'matchday' ? matchData : seasonData) as any[];

  return (
    <Card className="border border-gray-100 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="text-emerald-600" size={20} />
            {view === 'matchday' ? 'Asistencia por Jornada' : 'Media por Temporada'}
          </CardTitle>
          <CardDescription>
            {view === 'matchday' 
              ? 'Número de jugadores que asistieron a cada partido.' 
              : 'Promedio de jugadores que asisten por temporada.'}
          </CardDescription>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setView('matchday')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${view === 'matchday' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Jornada
          </button>
          <button 
            onClick={() => setView('season')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${view === 'season' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Temporada
          </button>
        </div>
      </CardHeader>
      <CardContent className="h-[300px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 600, fill: '#6b7280' }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              domain={[0, 'auto']}
              allowDecimals={true}
            />
            <Tooltip
              cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                padding: '12px'
              }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#111827' }}
              formatter={(value: number) => [`${value} Jugadores`, 'Asistencia']}
              labelFormatter={(label) => {
                const item = matchData.find(d => d.name === label);
                if (view === 'matchday' && item) {
                  return `${item.seasonName} - ${label} (${item.fullDate})`;
                }
                return label;
              }}
            />
            <ReferenceLine y={7} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Min 7', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
            <Bar 
              dataKey={view === 'matchday' ? 'attending' : 'avgAttending'} 
              radius={[4, 4, 0, 0]}
              barSize={Math.min(40, 400 / chartData.length)}
            >
              {chartData.map((entry: any, index: number) => {
                const val = view === 'matchday' ? entry.attending : entry.avgAttending;
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={val < 7 ? '#f97316' : '#10b981'} 
                    fillOpacity={0.8}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
