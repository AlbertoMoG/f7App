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
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  team?: any;
  onLogout: () => void;
}

export default function Layout({ children, activeTab, setActiveTab, user, team, onLogout }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const navItems = [
    { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
    { id: 'team', label: team?.name || 'Mi Equipo', icon: Shield },
    { id: 'players', label: 'Jugadores', icon: Users },
    { id: 'matches', label: 'Partidos', icon: Calendar },
    { id: 'simulator', label: 'Simulador', icon: Trophy },
    { id: 'seasons', label: 'Temporadas', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex text-[#141414] font-sans">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-[#141414]/10 transition-all duration-300 flex flex-col",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center justify-between">
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

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group",
                activeTab === item.id 
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                  : "hover:bg-emerald-50 text-gray-500 hover:text-emerald-600"
              )}
            >
              <item.icon size={22} className={cn(
                "transition-transform",
                activeTab === item.id ? "scale-110" : "group-hover:scale-110"
              )} />
              {isSidebarOpen && (
                <span className="font-medium">{item.label}</span>
              )}
              {isSidebarOpen && activeTab === item.id && (
                <ChevronRight size={16} className="ml-auto opacity-50" />
              )}
            </button>
          ))}
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
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
