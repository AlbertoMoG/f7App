import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Match, PlayerStat } from '../types';
import { formatMatchDate } from '@/lib/matchDisplayLabel';

interface PlayerCumulativeAttendanceChartProps {
  playerId: string;
  matches: Match[];
  stats: PlayerStat[];
}

export default function PlayerCumulativeAttendanceChart({ playerId, matches, stats }: PlayerCumulativeAttendanceChartProps) {
  const data = React.useMemo(() => {
    // Sort matches by date to show progression
    const sortedMatches = [...matches]
      .filter(m => m.status === 'completed')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let cumulative = 0;
    return sortedMatches.map((match, index) => {
      const matchStat = stats.find(s => s.playerId === playerId && s.matchId === match.id);
      const attended = matchStat?.attendance === 'attending';
      if (attended) cumulative += 1;
      
      return {
        name: `J${match.round || index + 1}`,
        fullDate: formatMatchDate(match, 'chartNumeric'),
        cumulative: cumulative,
        attended: attended,
        theoretical: index + 1 // Perfect regularity (attended all)
      };
    });
  }, [playerId, matches, stats]);

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">
        No hay datos de asistencia para mostrar la regularidad.
      </div>
    );
  }

  const maxCumulative = data.length > 0 ? data[data.length - 1].theoretical : 0;

  return (
    <div className="w-full h-full min-h-[250px] pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
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
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            domain={[0, maxCumulative]}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ 
              borderRadius: '16px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              padding: '12px',
              fontSize: '12px'
            }}
            labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#111827' }}
            formatter={(value: number, name: string) => {
              if (name === 'cumulative') return [`${value} Partidos`, 'Acumulado'];
              if (name === 'theoretical') return [`${value} Máximo`, 'Potencial'];
              return [value, name];
            }}
          />
          {/* Linea de tendencia ideal */}
          <Area
            type="monotone"
            dataKey="theoretical"
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="5 5"
            fill="transparent"
            isAnimationActive={false}
            name="theoretical"
          />
          {/* Asistencia real acumulada */}
          <Area
            type="stepAfter"
            dataKey="cumulative"
            stroke="#10b981"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorCumulative)"
            name="cumulative"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2 text-[10px] font-bold uppercase tracking-widest">
        <div className="flex items-center gap-1.5 text-emerald-600">
          <div className="w-3 h-0.5 bg-emerald-500"></div> Asistencia Real
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <div className="w-3 h-0.5 bg-gray-300 border-t border-dashed"></div> Asistencia Perfecta
        </div>
      </div>
    </div>
  );
}
