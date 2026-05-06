import React from 'react';
import { cn } from '@/lib/utils';
import { Beaker, Brain } from 'lucide-react';
import type {
  Injury,
  LeagueFixture,
  Match,
  Opponent,
  Player,
  PlayerSeason,
  PlayerStat,
  Season,
  Field,
  StandingsEntry,
  Team,
} from '../types';
import AIAnalysis from './AIAnalysis';
import { PlantillaIALabTab } from '../features/ai-analysis/components/PlantillaIALabTab';

export interface InteligenciaIAWorkspaceProps {
  team: Team | null;
  players: Player[];
  playerSeasons: PlayerSeason[];
  matches: Match[];
  stats: PlayerStat[];
  opponents: Opponent[];
  seasons: Season[];
  fields: Field[];
  injuries: Injury[];
  globalSeasonId: string;
  standings?: StandingsEntry[];
  leagueFixtures?: LeagueFixture[];
  onNavigateToMatch?: (matchId: string) => void;
}

export default function InteligenciaIAWorkspace(props: InteligenciaIAWorkspaceProps) {
  const [zone, setZone] = React.useState<'lab' | 'tools'>('lab');

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap bg-gray-50/90 p-1.5 rounded-2xl gap-1 border border-gray-100 max-w-full">
        <button
          type="button"
          onClick={() => setZone('lab')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-wider',
            zone === 'lab'
              ? 'bg-white text-emerald-600 shadow-sm'
              : 'text-gray-400 hover:text-gray-500'
          )}
        >
          <Beaker size={15} />
          Laboratorio plantilla
        </button>
        <button
          type="button"
          onClick={() => setZone('tools')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-wider',
            zone === 'tools'
              ? 'bg-white text-emerald-600 shadow-sm'
              : 'text-gray-400 hover:text-gray-500'
          )}
        >
          <Brain size={15} />
          Herramientas predictivas
        </button>
      </div>

      {zone === 'lab' ? (
        <PlantillaIALabTab
          team={props.team}
          players={props.players}
          playerSeasons={props.playerSeasons}
          matches={props.matches}
          stats={props.stats}
          seasons={props.seasons}
          injuries={props.injuries}
          globalSeasonId={props.globalSeasonId}
        />
      ) : (
        <AIAnalysis {...props} />
      )}
    </div>
  );
}
