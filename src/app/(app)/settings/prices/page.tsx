
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDb } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Save, 
  ChevronLeft, 
  DollarSign, 
  Car, 
  Bike, 
  Dumbbell, 
  Repeat, 
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DEFAULT_PRICES = {
  auto: {
    "Curso Auto Básico (8 Hrs)": 133.00,
    "Curso Auto Plus (10 Hrs)": 155.00,
    "Curso Auto Premium (12 Hrs)": 180.00,
    "Reforzamiento 4 Hrs": 95.00,
    "Reforzamiento 2 Hrs": 75.00,
    "Ya se manejar": 57.00
  },
  moto: {
    "Curso Moto Básico (8 Hrs)": 115.00,
    "Curso Moto Plus (10 Hrs)": 135.00,
    "Curso Moto Premium (12 Hrs)": 155.00,
    "Moto Reforzamiento 4 Hrs": 95.00,
    "Moto Reforzamiento 2 Hrs": 75.00,
    "Ya se manejar (Moto)": 57.00
  },
  practice: {
    "Basico 8 Hrs": 123.00,
    "Plus 10 Hrs": 135.00,
    "Premium 12 Hrs": 160.00
  },
  ampliaciones: {
    "B": 57.00, "C": 57.00, "D": 57.00, "E1": 57.00,
    "E2": 75.00, "E3": 75.00, "F": 85.00
  },
  combos: {
    "D, E1": 85.00,
    "E1, E2": 75.00,
    "E1, E2, E3": 85.00,
    "E1, E2, E3, F": 95.00,
    "D, E1, E2, E3, F": 150.00,
    "B, E1, E2, E3, F": 150.00,
    "B, D": 85.00,
    "B, E1": 85.00,
    "E2, E3": 85.00,
    "B, F": 85.00,
    "B, D, E1, E2, E3, F": 200.00,
    "Combo Plus Auto + Moto": 290.00
  }
};

export default function PriceMaintenancePage() {
  const db = useDb();
  const { role, isLoading: isRoleLoading } = useCurrentRole();
  const { toast } = useToast();
  const [prices, setPrices] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadPrices() {
      if (!db) return;
      try {
        const docRef = doc(db, 'settings', 'prices');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setPrices(snap.data().values);
        } else {
          setPrices(DEFAULT_PRICES);
        }
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los precios.' });
      } finally {
        setIsLoading(false);
      }
    }
    loadPrices();
  }, [db, toast]);

  const handlePriceChange = (category: string, key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setPrices((prev: any) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: numValue
      }
    }));
  };

  const handleSave = async () => {
    if (!db || !isAdmin) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, 'settings', 'prices');
      await setDoc(docRef, {
        values: prices,
        updatedAt: serverTimestamp(),
        updatedBy: role
      });
      toast({ title: 'Precios Actualizados', description: 'Los cambios se han guardado en la base de datos.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron guardar los cambios.' });
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = role === 'Administrador';

  if (isRoleLoading || isLoading) {
    return <div className="p-24 text-center"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary opacity-20" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-2xl bg-slate-50">
        <ShieldAlert className="h-16 w-16 text-red-600 mb-4" />
        <h3 className="text-2xl font-black text-red-900 uppercase">Acceso Restringido</h3>
        <p className="text-slate-600 mt-2 max-w-sm font-medium">Solo el Administrador Principal puede modificar la estructura de precios del sistema.</p>
        <Button asChild className="mt-8" variant="default"><Link href="/dashboard">Volver al Panel</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild><Link href="/dashboard"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Mantenimiento de Precios</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Estructura comercial Freeway S.A.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="h-12 px-8 font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 shadow-lg gap-2">
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Guardar Estructura
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs font-bold text-amber-800 leading-relaxed uppercase">
          Advertencia: Los cambios realizados aquí afectarán inmediatamente los cálculos de saldo en los nuevos contratos. Asegúrese de validar los montos antes de guardar.
        </p>
      </div>

      <Tabs defaultValue="auto" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-14 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="auto" className="font-bold gap-2"><Car className="h-4 w-4" /> Auto</TabsTrigger>
          <TabsTrigger value="moto" className="font-bold gap-2"><Bike className="h-4 w-4" /> Moto</TabsTrigger>
          <TabsTrigger value="practice" className="font-bold gap-2"><Dumbbell className="h-4 w-4" /> Práctica</TabsTrigger>
          <TabsTrigger value="ampliaciones" className="font-bold gap-2"><Repeat className="h-4 w-4" /> Ampliaciones</TabsTrigger>
          <TabsTrigger value="combos" className="font-bold gap-2"><DollarSign className="h-4 w-4" /> Combos</TabsTrigger>
        </TabsList>

        {Object.entries(prices).map(([catId, catValues]: [string, any]) => (
          <TabsContent key={catId} value={catId} className="mt-6 space-y-6">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="bg-slate-50/50 border-b py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Valores Actuales: {catId.toUpperCase()}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  {Object.entries(catValues).map(([name, price]: [string, any]) => (
                    <div key={name} className="flex items-center justify-between gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors border-b last:border-0 md:last:border-b">
                      <Label className="text-[11px] font-black uppercase text-slate-700 flex-1">{name}</Label>
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">B/.</span>
                        <Input 
                          type="number" 
                          step="0.01"
                          className="pl-8 h-9 text-right font-black text-blue-700 focus:ring-red-500"
                          value={price}
                          onChange={(e) => handlePriceChange(catId, name, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
