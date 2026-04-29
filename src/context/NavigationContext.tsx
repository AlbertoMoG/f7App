import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import type { Season } from '../types';

interface NavigationContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  globalSeasonId: string;
  setGlobalSeasonId: (id: string) => void;
  selectedMatchId: string | null;
  setSelectedMatchId: (id: string | null) => void;
  navigateToMatch: (matchId: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({
  children,
  seasons,
}: {
  children: React.ReactNode;
  seasons: Season[];
}) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalSeasonId, setGlobalSeasonId] = useState<string>('all');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const initialSeasonSet = useRef(false);
  useEffect(() => {
    if (!initialSeasonSet.current && seasons.length > 0) {
      const latest = [...seasons].sort((a, b) => b.startYear - a.startYear)[0];
      if (latest) {
        setGlobalSeasonId(latest.id);
        initialSeasonSet.current = true;
      }
    }
  }, [seasons]);

  const navigateToMatch = (matchId: string) => {
    setSelectedMatchId(matchId);
    setActiveTab('matches');
  };

  return (
    <NavigationContext.Provider value={{
      activeTab, setActiveTab,
      globalSeasonId, setGlobalSeasonId,
      selectedMatchId, setSelectedMatchId,
      navigateToMatch,
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used inside NavigationProvider');
  return ctx;
}
