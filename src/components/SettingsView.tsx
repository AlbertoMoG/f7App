import React, { useState } from 'react';
import { Settings, ShieldAlert, CalendarRange, MapPin, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import SeasonManager from './SeasonManager';
import OpponentManager from './OpponentManager';
import FieldManager from './FieldManager';
import FeesManager from './FeesManager';
import { Season, Opponent, Match, Player, Team, Field, PlayerSeason } from '../types';

interface SettingsViewProps {
  seasons: Season[];
  players: Player[];
  playerSeasons: PlayerSeason[];
  opponents: Opponent[];
  matches: Match[];
  fields: Field[];
  team: Team | null;
  onAddSeason: (name: string, division: string, playerIds?: string[], opponentIds?: string[]) => void;
  onUpdateSeason: (id: string, name: string, division: string, playerIds: string[], opponentIds: string[]) => void;
  onDeleteSeason: (id: string) => void;
  onAddOpponent: (name: string, shieldUrl?: string, seasonIds?: string[]) => void;
  onUpdateOpponent: (id: string, name: string, shieldUrl?: string, seasonIds?: string[]) => void;
  onDeleteOpponent: (id: string) => void;
  onAddField: (name: string, location?: string) => void;
  onUpdateField: (id: string, name: string, location?: string) => void;
  onDeleteField: (id: string) => void;
}

export default function SettingsView({
  seasons,
  players,
  playerSeasons,
  opponents,
  matches,
  fields,
  team,
  onAddSeason,
  onUpdateSeason,
  onDeleteSeason,
  onAddOpponent,
  onUpdateOpponent,
  onDeleteOpponent,
  onAddField,
  onUpdateField,
  onDeleteField
}: SettingsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'seasons' | 'opponents' | 'fields' | 'fees'>('seasons');

  const tabs = [
    { id: 'seasons', label: 'Temporadas', icon: CalendarRange },
    { id: 'opponents', label: 'Rivales', icon: ShieldAlert },
    { id: 'fields', label: 'Campos', icon: MapPin },
    { id: 'fees', label: 'Cuotas', icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-3">
            <Settings className="text-emerald-600" size={32} />
            Configuraciones
          </h2>
          <p className="text-gray-500 mt-1 font-medium">Gestiona las temporadas, rivales y otros ajustes del equipo.</p>
        </div>
      </header>

      <div className="flex space-x-2 border-b border-gray-200 pb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors whitespace-nowrap",
              activeSubTab === tab.id
                ? "bg-emerald-100 text-emerald-700"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeSubTab === 'seasons' && (
          <SeasonManager 
            seasons={seasons} 
            players={players}
            playerSeasons={playerSeasons}
            opponents={opponents}
            onAddSeason={onAddSeason} 
            onUpdateSeason={onUpdateSeason}
            onDeleteSeason={onDeleteSeason} 
          />
        )}
        {activeSubTab === 'opponents' && (
          <OpponentManager 
            seasons={seasons} 
            opponents={opponents} 
            matches={matches}
            team={team}
            onAddOpponent={onAddOpponent} 
            onUpdateOpponent={onUpdateOpponent}
            onDeleteOpponent={onDeleteOpponent} 
          />
        )}
        {activeSubTab === 'fields' && (
          <FieldManager 
            fields={fields}
            onAddField={onAddField}
            onUpdateField={onUpdateField}
            onDeleteField={onDeleteField}
          />
        )}
        {activeSubTab === 'fees' && (
          <FeesManager 
            teamId={team?.id || ''}
            seasons={seasons}
          />
        )}
      </div>
    </div>
  );
}
