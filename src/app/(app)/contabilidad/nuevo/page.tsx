'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDb, useFirebaseApp } from '@/firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, ScanLine, Save, ChevronLeft, ImagePlus } from 'lucide-react';
import Link from 'next/link';

const expenseSchema = z.object({
  amount: z.coerce.number().min(0.01, 'El monto debe ser mayor a 0'),
  dateString: z.string().min(1, 'La fecha es requerida'),
  provider: z.string().min(1, 'El proveedor es requerido'),
  providerRuc: z.string().optional(),
  providerDv: z.string().optional(),
  invoiceNumber: z.string().optional(),
  category: z.enum(['Combustible', 'Alquiler', 'Salarios', 'Mantenimiento', 'Insumos', 'Otros']),
  description: z.string().min(1, 'La descripción es requerida'),
  originalImage: z.string().optional(),
});

export default function NuevoGastoPage() {
  const router = useRouter();
  const db = useDb();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();
  
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: 0,
      dateString: new Date().toISOString().split('T')[0],
      provider: '',
      providerRuc: '',
      providerDv: '',
      invoiceNumber: '',
      category: 'Otros',
      description: '',
      originalImage: '',
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;

    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 500;
      const MAX_HEIGHT = 700;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round(width * (MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.4);
      URL.revokeObjectURL(url);

      setPreviewImage(compressedBase64);
      setIsScanning(true);

      try {
        toast({ title: "Analizando documento...", description: "La IA está leyendo los datos." });
        
        const fetchRes = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Image: compressedBase64 })
        });
        
        const response = await fetchRes.json();
        
        if (response.success && response.data) {
          const { amount, date, provider, providerRuc, providerDv, invoiceNumber, category, description } = response.data;
          
          form.setValue('amount', amount || 0);
          form.setValue('provider', provider || '');
          form.setValue('providerRuc', providerRuc || '');
          form.setValue('providerDv', providerDv || '');
          form.setValue('invoiceNumber', invoiceNumber || '');
          form.setValue('description', description || '');
          form.setValue('category', category as any || 'Otros');
          form.setValue('originalImage', compressedBase64);

          if (date) {
            form.setValue('dateString', date);
          }

          toast({ title: "¡Escaneo completado!", description: "Revisa los campos autocompletados." });
        } else {
          throw new Error(response.error);
        }
      } catch (error: any) {
        toast({ title: "Error de Escaneo", description: error.message, variant: "destructive" });
      } finally {
        setIsScanning(false);
      }
    };
  };

  const onSubmit = async (values: z.infer<typeof expenseSchema>) => {
    if (!db) return;
    setIsSaving(true);
    try {
      if (values.invoiceNumber?.trim() && values.provider?.trim()) {
        const dupQ = query(collection(db, 'expenses'), where('invoiceNumber', '==', values.invoiceNumber.trim()));
        const dupSnap = await getDocs(dupQ);
        
        let isDuplicate = false;
        dupSnap.forEach(d => {
           const data = d.data();
           const matchProv = data.provider?.toLowerCase() === values.provider.toLowerCase();
           const matchRuc = values.providerRuc && data.providerRuc === values.providerRuc;
           if (matchProv || matchRuc) {
               isDuplicate = true;
           }
        });

        if (isDuplicate) {
            toast({ title: "Factura Duplicada", description: "Esta factura ya fue ingresada para ese proveedor.", variant: "destructive" });
            setIsSaving(false);
            return;
        }
      }

      let imageUrl = null;
      if (values.originalImage && firebaseApp) {
        try {
          toast({ title: "Subiendo imagen...", description: "Guardando foto en la nube." });
          const storage = getStorage(firebaseApp);
          const filename = `receipts/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          const storageRef = ref(storage, filename);
          await uploadString(storageRef, values.originalImage, 'data_url');
          imageUrl = await getDownloadURL(storageRef);
        } catch (uploadError: any) {
          console.error("Storage upload error:", uploadError);
          toast({ title: "Advertencia", description: "La foto no se subió, pero los datos sí se guardarán." });
        }
      }

      let dateObj = new Date(values.dateString);
      if (isNaN(dateObj.getTime())) {
        dateObj = new Date();
      }

      await addDoc(collection(db, 'expenses'), {
        amount: values.amount,
        date: dateObj,
        provider: values.provider,
        providerRuc: values.providerRuc || '',
        providerDv: values.providerDv || '',
        invoiceNumber: values.invoiceNumber || '',
        category: values.category,
        description: values.description,
        createdAt: serverTimestamp(),
        ...(imageUrl && { imageUrl }),
      });
      
      if (values.provider) {
        const providerId = values.providerRuc ? values.providerRuc.replace(/[^a-zA-Z0-9]/g, '') : values.provider.replace(/[\s./]/g, '-').toLowerCase();
        await setDoc(doc(db, 'providers', providerId), {
          name: values.provider,
          ruc: values.providerRuc || '',
          dv: values.providerDv || '',
          lastExpenseDate: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      
      toast({ title: "Gasto Guardado", description: "El gasto se ha registrado correctamente." });
      router.push('/contabilidad');
    } catch (error: any) {
      console.error("Database error:", error);
      toast({ title: "Error al guardar", description: `Fallo Crítico: ${error?.message || 'Error en base de datos'}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-20 mt-6 px-4">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="outline" size="icon" asChild><Link href="/contabilidad"><ChevronLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Registrar Gasto</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-5 space-y-6">
          <Card className="border-blue-200 shadow-sm bg-blue-50/30">
            <CardHeader className="pb-3 border-b border-blue-100 bg-white">
              <CardTitle className="text-sm font-black text-blue-800 uppercase flex items-center gap-2">
                <ScanLine className="h-5 w-5" /> Escáner de Facturas AI
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <Button 
                    asChild
                    disabled={isScanning} 
                    className="h-20 bg-blue-600 hover:bg-blue-700 shadow-xl cursor-pointer flex-1"
                  >
                    <label>
                      <div className="flex flex-col items-center justify-center font-black uppercase text-[10px] sm:text-xs gap-1 text-white">
                        {isScanning ? (
                          <><Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin" /> Analizando</>
                        ) : (
                          <><Camera className="h-6 w-6 sm:h-8 sm:w-8 mb-1" /> Tomar Foto</>
                        )}
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                        onChange={handleFileChange} 
                        disabled={isScanning}
                      />
                    </label>
                  </Button>

                  <Button 
                    asChild
                    disabled={isScanning} 
                    className="h-20 bg-indigo-600 hover:bg-indigo-700 shadow-xl cursor-pointer flex-1"
                  >
                    <label>
                      <div className="flex flex-col items-center justify-center font-black uppercase text-[10px] sm:text-xs gap-1 text-white">
                        {isScanning ? (
                          <><Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin" /> Espere...</>
                        ) : (
                          <><ImagePlus className="h-6 w-6 sm:h-8 sm:w-8 mb-1" /> De Galería</>
                        )}
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileChange} 
                        disabled={isScanning}
                      />
                    </label>
                  </Button>
                </div>
                
                {previewImage && (
                  <div className="mt-4 border-2 border-slate-300 rounded-xl overflow-hidden relative aspect-square bg-slate-100">
                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-7">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="text-sm font-black uppercase text-slate-600">Detalles del Documento</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="amount" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black uppercase text-xs">Monto Total (B/.)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" className="font-black text-red-600 text-lg" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="dateString" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black uppercase text-xs">Fecha Factura</FormLabel>
                        <FormControl>
                          <Input type="date" className="font-bold uppercase" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="provider" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-black uppercase text-xs">Nombre Proveedor</FormLabel>
                      <FormControl>
                        <Input className="font-bold uppercase" placeholder="Proveedor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="providerRuc" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black uppercase text-xs">RUC</FormLabel>
                        <FormControl>
                          <Input className="font-medium uppercase" placeholder="RUC" {...field} />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="providerDv" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black uppercase text-xs">DV</FormLabel>
                        <FormControl>
                          <Input className="font-medium uppercase" placeholder="DV" {...field} />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-black uppercase text-xs">N° Factura / Recibo / Doc.</FormLabel>
                      <FormControl>
                        <Input className="font-medium uppercase bg-amber-50" placeholder="Ej. 0001 (Para evitar duplicados)" {...field} />
                      </FormControl>
                      <FormDescription className="text-[10px] font-bold text-amber-600 uppercase">La IA extraerá el número de factura para avisarte si estás registrando la misma dos veces.</FormDescription>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-black uppercase text-xs">Categoría</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="font-bold uppercase"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Combustible">Combustible</SelectItem>
                          <SelectItem value="Alquiler">Alquiler</SelectItem>
                          <SelectItem value="Salarios">Salarios / Planilla</SelectItem>
                          <SelectItem value="Mantenimiento">Mantenimiento</SelectItem>
                          <SelectItem value="Insumos">Insumos Oficina</SelectItem>
                          <SelectItem value="Otros">Gastos Generales (Otros)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-black uppercase text-xs">Concepto / Descripción</FormLabel>
                      <FormControl>
                        <Input className="font-medium" placeholder="Descripción breve" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button type="submit" className="w-full h-14 bg-black hover:bg-slate-800 text-white font-black uppercase tracking-widest gap-2 shadow-xl" disabled={isSaving || isScanning}>
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    Guardar Comprobante
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
