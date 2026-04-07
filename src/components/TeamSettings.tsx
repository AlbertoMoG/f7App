import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Save, Upload, Loader2 } from 'lucide-react';
import { Team } from '../types';
import { uploadImage } from '../lib/imageUpload';

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
      alert("Hubo un error al subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (team) {
      onUpdateTeam({ id: team.id, name, shieldUrl });
    } else {
      onSaveTeam({ name, shieldUrl });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Mi Equipo</h2>
        <p className="text-gray-500">Configura los detalles de tu equipo.</p>
      </header>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="relative group">
                <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center border-4 border-white shadow-lg overflow-hidden mb-4 relative">
                  {shieldUrl ? (
                    <img src={shieldUrl} alt="Escudo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Shield size={48} className="text-gray-300" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload size={14} className="mr-2" />
                  Subir Foto
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                />
              </div>
              <p className="text-sm text-gray-500 font-medium">Vista previa del escudo</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Equipo</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Ej: Los Galácticos FC" 
                required 
                className="rounded-xl h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shieldUrl">URL del Escudo (Opcional)</Label>
              <div className="flex gap-2">
                <Input 
                  id="shieldUrl" 
                  value={shieldUrl} 
                  onChange={(e) => setShieldUrl(e.target.value)} 
                  placeholder="https://... o sube una imagen arriba" 
                  className="rounded-xl h-12 flex-1"
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold">
              <Save size={20} className="mr-2" />
              Guardar Configuración
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
