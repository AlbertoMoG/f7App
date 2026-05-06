import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Trophy, 
  Settings, 
  LogOut,
  ChevronRight,
  Menu,
  X,
  Shield,
  ShieldAlert,
  ClipboardCheck,
  DollarSign,
  Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { Season } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  team?: any;
  onLogout: () => void;
  seasons: Season[];
  globalSeasonId: string;
  setGlobalSeasonId: (id: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab, user, team, onLogout, seasons, globalSeasonId, setGlobalSeasonId }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const navItems = [
    { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
    { id: 'inteligencia-ia', label: 'Inteligencia IA', icon: Brain },
    { id: 'standings', label: 'Clasificación', icon: Trophy },
    { id: 'players', label: 'Jugadores', icon: Users },
    { id: 'matches', label: 'Partidos', icon: Calendar },
    { id: 'simulator', label: 'Simulador', icon: ClipboardCheck },
    { id: 'treasury', label: 'Tesorería', icon: DollarSign },
    { id: 'settings', label: 'Configuraciones', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex text-[#141414] font-sans">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-[#141414]/10 transition-all duration-300 flex flex-col sticky top-0 h-screen z-20",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            {isSidebarOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                {team?.shieldUrl ? (
                  <img src={team.shieldUrl} alt="Escudo" className="w-8 h-8 object-cover rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <Shield className="text-emerald-600" size={24} />
                )}
                <h1 className="text-lg font-bold tracking-tight truncate max-w-[140px]">
                  {team?.name || 'Fútbol 7 Mgr'}
                </h1>
              </motion.div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hover:bg-emerald-50"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>

          {isSidebarOpen && (
            <div className="w-full">
              <Select value={globalSeasonId} onValueChange={setGlobalSeasonId}>
                <SelectTrigger className="w-full bg-gray-50 border-none rounded-xl h-10 font-medium">
                  <SelectValue>
                    {globalSeasonId === 'all' 
                      ? 'Todas las temporadas' 
                      : seasons.find(s => s.id === globalSeasonId)?.name || 'Temporada'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Todas las temporadas</SelectItem>
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
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group",
                    isActive
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                      : "hover:bg-emerald-50 text-gray-500 hover:text-emerald-600"
                  )}
                >
                  <item.icon size={22} className={cn(
                    "transition-transform",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )} />
                  {isSidebarOpen && (
                    <span className="font-medium">{item.label}</span>
                  )}
                  {isSidebarOpen && isActive && (
                    <ChevronRight size={16} className="ml-auto opacity-50" />
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#141414]/10">
          <div className={cn(
            "flex items-center gap-3 p-2 rounded-xl",
            isSidebarOpen ? "bg-gray-50" : "justify-center"
          )}>
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="User" 
                className="w-8 h-8 rounded-full border border-emerald-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                {user?.displayName?.[0] || 'U'}
              </div>
            )}
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{user?.displayName}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            )}
            {isSidebarOpen && (
              <Button variant="ghost" size="icon" onClick={onLogout} className="text-gray-400 hover:text-red-500">
                <LogOut size={18} />
              </Button>
            )}
          </div>
          {!isSidebarOpen && (
            <Button variant="ghost" size="icon" onClick={onLogout} className="w-full mt-2 text-gray-400 hover:text-red-500">
              <LogOut size={18} />
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-2 md:p-3">
        <div className="max-w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
