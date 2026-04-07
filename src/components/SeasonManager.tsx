import React from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar,
  ShieldAlert,
  Upload,
  Loader2,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Season, Opponent } from '../types';
import { uploadImage } from '../lib/imageUpload';

interface SeasonManagerProps {
  seasons: Season[];
  opponents: Opponent[];
  onAddSeason: (name: string) => void;
  onAddOpponent: (name: string, shieldUrl?: string) => void;
  onDeleteSeason: (id: string) => void;
  onDeleteOpponent: (id: string) => void;
}

export default function SeasonManager({ 
  seasons, 
  opponents, 
  onAddSeason, 
  onAddOpponent,
  onDeleteSeason,
  onDeleteOpponent
}: SeasonManagerProps) {
  const [newSeason, setNewSeason] = React.useState('');
  const [newOpponent, setNewOpponent] = React.useState('');
  const [newOpponentShieldUrl, setNewOpponentShieldUrl] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const url = await uploadImage(file, 'opponents');
      setNewOpponentShieldUrl(url);
    } catch (error) {
      console.error("Error uploading opponent shield:", error);
      alert("Hubo un error al subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
        <p className="text-gray-500">Gestiona temporadas y equipos rivales.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Seasons */}
        <Card className="border-none shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="text-emerald-600" size={20} />
              Temporadas
            </CardTitle>
            <CardDescription>Define los periodos de competición.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <Input 
                placeholder="Ej: 2025/2026" 
                value={newSeason}
                onChange={(e) => setNewSeason(e.target.value)}
                className="rounded-xl"
              />
              <Button 
                onClick={() => {
                  if (newSeason) {
                    onAddSeason(newSeason);
                    setNewSeason('');
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
              >
                <Plus size={18} />
              </Button>
            </div>
            <div className="space-y-2">
              {seasons.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="font-medium">{s.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => onDeleteSeason(s.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Opponents */}
        <Card className="border-none shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="text-emerald-600" size={20} />
              Rivales
            </CardTitle>
            <CardDescription>Equipos contra los que compites.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-2">
              <Input 
                placeholder="Nombre del equipo..." 
                value={newOpponent}
                onChange={(e) => setNewOpponent(e.target.value)}
                className="rounded-xl"
              />
              <div className="flex gap-2">
                <Input 
                  placeholder="URL del escudo (opcional)..." 
                  value={newOpponentShieldUrl}
                  onChange={(e) => setNewOpponentShieldUrl(e.target.value)}
                  className="rounded-xl flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  className="rounded-xl px-3"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                />
                <Button 
                  onClick={() => {
                    if (newOpponent) {
                      onAddOpponent(newOpponent, newOpponentShieldUrl);
                      setNewOpponent('');
                      setNewOpponentShieldUrl('');
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                >
                  <Plus size={18} />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {opponents.map(o => (
                <div key={o.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    {o.shieldUrl ? (
                      <img src={o.shieldUrl} alt={o.name} className="w-8 h-8 rounded-full object-cover border bg-white" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <Shield size={14} className="text-gray-500" />
                      </div>
                    )}
                    <span className="font-medium">{o.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onDeleteOpponent(o.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
