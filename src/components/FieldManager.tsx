import React from 'react';
import { 
  Plus, 
  Trash2, 
  MapPin,
  Check,
  Edit2,
  Map
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '../types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FieldManagerProps {
  fields: Field[];
  onAddField: (name: string, location?: string) => void;
  onUpdateField: (id: string, name: string, location?: string) => void;
  onDeleteField: (id: string) => void;
}

export default function FieldManager({ 
  fields, 
  onAddField,
  onUpdateField,
  onDeleteField
}: FieldManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingField, setEditingField] = React.useState<Field | null>(null);
  const [fieldName, setFieldName] = React.useState('');
  const [fieldLocation, setFieldLocation] = React.useState('');

  React.useEffect(() => {
    if (editingField) {
      setFieldName(editingField.name);
      setFieldLocation(editingField.location || '');
      setIsDialogOpen(true);
    } else if (!isDialogOpen) {
      setFieldName('');
      setFieldLocation('');
    }
  }, [editingField, isDialogOpen]);

  const handleSave = () => {
    if (fieldName) {
      if (editingField) {
        onUpdateField(editingField.id, fieldName, fieldLocation);
      } else {
        onAddField(fieldName, fieldLocation);
      }
      setIsDialogOpen(false);
      setEditingField(null);
    } else {
      toast.error("Introduce un nombre para el campo");
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campos de Fútbol</h2>
          <p className="text-gray-500">Gestiona los recintos donde juegas tus partidos.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingField(null);
          }}>
            <DialogTrigger render={
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold shadow-lg shadow-emerald-100">
                <Plus size={18} className="mr-2" />
                Nuevo Campo
              </Button>
            }>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>{editingField ? 'Editar Campo' : 'Nuevo Campo'}</DialogTitle>
                <DialogDescription>
                  {editingField ? 'Modifica la información del campo.' : 'Añade la información del nuevo campo.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Nombre del campo</Label>
                  <Input 
                    placeholder="Ej: Polideportivo Municipal" 
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    className="rounded-xl bg-white border-gray-200 shadow-sm h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Ubicación (Coordenadas o Dirección)</Label>
                  <Input 
                    placeholder="Ej: 41.6488, -0.8891 o Calle Mayor 1" 
                    value={fieldLocation}
                    onChange={(e) => setFieldLocation(e.target.value)}
                    className="rounded-xl bg-white border-gray-200 shadow-sm h-11"
                  />
                  <p className="text-[10px] text-gray-400 italic ml-1">Puedes pegar coordenadas de Google Maps para facilitar la navegación.</p>
                </div>

                <Button 
                  onClick={handleSave}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold shadow-lg shadow-emerald-100 mt-2"
                >
                  {editingField ? (
                    <>
                      <Check size={18} className="mr-2" />
                      Guardar Cambios
                    </>
                  ) : (
                    <>
                      <Plus size={18} className="mr-2" />
                      Añadir Campo
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {fields.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
              <Map size={32} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">No hay campos</h3>
            <p className="text-gray-500 max-w-sm mb-6">
              Aún no has añadido ningún campo de fútbol. Añade el primero para poder seleccionarlo en tus partidos.
            </p>
            <Button 
              onClick={() => setIsDialogOpen(true)}
              variant="outline"
              className="rounded-xl border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
            >
              <Plus size={18} className="mr-2" />
              Añadir Primer Campo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {fields.map(f => (
            <Card 
              key={f.id} 
              className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl group overflow-hidden bg-white"
            >
              <CardContent className="p-4 flex flex-col relative">
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    onClick={() => setEditingField(f)} 
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => onDeleteField(f.id)} 
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
                    <MapPin size={20} className="text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm truncate pr-12">{f.name}</h3>
                </div>
                
                {f.location && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 line-clamp-1 flex items-center gap-1">
                      <MapPin size={12} className="shrink-0" />
                      {f.location}
                    </p>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-emerald-600 hover:underline mt-1 inline-block"
                    >
                      Ver en Google Maps
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
