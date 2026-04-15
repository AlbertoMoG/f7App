import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Save, Upload, Loader2 } from 'lucide-react';
import { Team } from '../types';
import { uploadImage } from '../lib/imageUpload';
import { toast } from 'sonner';

interface TeamSettingsProps {
  team: Team | null;
  onSaveTeam: (team: Omit<Team, 'id'>) => void;
  onUpdateTeam: (team: Team) => void;
}

export default function TeamSettings({ team, onSaveTeam, onUpdateTeam }: TeamSettingsProps) {
  const [name, setName] = useState(team?.name || '');
  const [shieldUrl, setShieldUrl] = useState(team?.shieldUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (team) {
      setName(team.name);
      setShieldUrl(team.shieldUrl || '');
    }
  }, [team]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const url = await uploadImage(file, 'teams');
      setShieldUrl(url);
    } catch (error) {
      console.error("Error uploading team shield:", error);
      toast.error("Hubo un error al subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (team) {
      onUpdateTeam({ id: team.id, name, shieldUrl, ownerId: team.ownerId });
    } else {
      onSaveTeam({ name, shieldUrl } as any); // ownerId is injected in App.tsx
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="flex flex-col gap-2">
        <h2 className="text-4xl font-black tracking-tight text-gray-900">{team?.name || 'Mi Equipo'}</h2>
        <p className="text-gray-500 font-medium">Personaliza la identidad visual y el nombre de tu club.</p>
      </header>

      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="bg-emerald-600 p-8 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <Shield size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black">Identidad del Club</h2>
              <p className="text-emerald-100 text-sm font-medium">Configura el escudo y nombre principal</p>
            </div>
          </div>
        </div>
        <CardContent className="p-10">
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="flex flex-col items-center justify-center">
              <div className="relative group">
                <div className="w-40 h-40 bg-gray-50 rounded-[2.5rem] flex items-center justify-center border-4 border-white shadow-2xl overflow-hidden mb-6 relative transition-transform duration-500 group-hover:scale-105">
                  {shieldUrl ? (
                    <img src={shieldUrl} alt="Escudo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Shield size={64} className="text-gray-200" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-2xl shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white hover:bg-gray-50 text-gray-900 font-black uppercase tracking-widest text-[10px] h-10 px-6 border border-gray-100"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload size={14} className="mr-2" />
                  Cambiar Escudo
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                />
              </div>
              <p className="text-xs text-gray-400 font-black uppercase tracking-[0.2em] mt-2">Escudo Oficial</p>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-3">
                <Label htmlFor="name" className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Nombre del Equipo</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Ej: Los Galácticos FC" 
                  required 
                  className="rounded-2xl bg-gray-50 border-transparent h-16 text-xl px-6 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-bold"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="shieldUrl" className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-1">URL del Escudo (Opcional)</Label>
                <Input 
                  id="shieldUrl" 
                  value={shieldUrl} 
                  onChange={(e) => setShieldUrl(e.target.value)} 
                  placeholder="https://... o sube una imagen arriba" 
                  className="rounded-2xl bg-gray-50 border-transparent h-16 text-base px-6 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-medium"
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] h-16 font-black text-lg shadow-xl shadow-emerald-100 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Save size={24} className="mr-3" />
              Guardar Cambios
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
