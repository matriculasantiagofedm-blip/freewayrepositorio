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
import { Loader2, Camera, ScanLine, Save, ChevronLeft, ImagePlus, CheckCircle2 } from 'lucide-react';
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

    const inputElement = e.target;

    const processImage = async (base64String: string) => {
      setPreviewImage(base64String);
      setIsScanning(true);
      toast({ title: "Analizando documento con IA...", description: "Extrayendo proveedor, RUC, total y fecha." });

      try {
        const fetchRes = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Image: base64String })
        });

        const response = await fetchRes.json();

        if (response.success && response.data) {
          const { amount, date, provider, providerRuc, providerDv, invoiceNumber, category, description } = response.data;
          
          if (amount !== undefined && amount !== null && !isNaN(Number(amount))) {
            form.setValue('amount', Number(amount));
          }
          if (provider && provider !== 'No disponible') {
            form.setValue('provider', provider);
          }
          if (providerRuc) form.setValue('providerRuc', providerRuc);
          if (providerDv) form.setValue('providerDv', providerDv);
          if (invoiceNumber) form.setValue('invoiceNumber', invoiceNumber);
          if (description && description !== 'No se pudo extraer información de la imagen proporcionada.') {
            form.setValue('description', description);
          }
          if (category) {
            form.setValue('category', category as any);
          }
          if (date) {
            form.setValue('dateString', date);
          }
          form.setValue('originalImage', base64String);

          toast({ 
            title: "¡Factura Analizada! ✓", 
            description: "Datos completados automáticamente. Revisa y guarda." 
          });
        } else {
          toast({ 
            title: "Aviso de la IA", 
            description: response.error || "No se detectaron todos los datos con claridad. Puedes completarlos a mano.", 
            variant: "destructive" 
          });
        }
      } catch (err: any) {
        console.error("Scan fetch error:", err);
        toast({ 
          title: "Error al Escanear", 
          description: err.message || "Error al procesar la imagen con el servidor.", 
          variant: "destructive" 
        });
      } finally {
        setIsScanning(false);
        if (inputElement) inputElement.value = '';
      }
    };

    // Lectura de imagen con FileReader + Canvas para alta resolución (1200x1600)
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const result = readerEvent.target?.result as string;
      if (!result) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1600;
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

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        processImage(compressedBase64);
      };

      img.onerror = () => {
        // Respaldo directo si canvas falla
        processImage(result);
      };

      img.src = result;
    };

    reader.onerror = () => {
      toast({ title: "Error", description: "No se pudo leer la imagen del dispositivo.", variant: "destructive" });
    };

    reader.readAsDataURL(file);
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
          const storage = getStorage(firebaseApp);
          const filename = `receipts/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          const storageRef = ref(storage, filename);
          await uploadString(storageRef, values.originalImage, 'data_url');
          imageUrl = await getDownloadURL(storageRef);
        } catch (uploadError: any) {
          console.warn("Storage upload warning (proceeding without image URL):", uploadError);
        }
      }

      let dateObj = new Date(values.dateString + 'T12:00:00');
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
      
      toast({ title: "Gasto Guardado con Éxito", description: "El comprobante se registró correctamente en contabilidad." });
      router.push('/contabilidad');
    } catch (error: any) {
      console.error("Database error:", error);
      toast({ title: "Error al guardar", description: `Fallo: ${error?.message || 'Error en base de datos'}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-20 mt-4 sm:mt-6 px-3 sm:px-4">
      <div className="flex items-center gap-3 mb-1">
        <Button variant="outline" size="icon" asChild className="rounded-xl">
          <Link href="/contabilidad"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">Registrar Gasto</h1>
          <p className="text-xs text-slate-500 font-medium">Captura facturas con IA o llena los datos manualmente</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-5 space-y-6">
          <Card className="border-blue-200 shadow-sm bg-blue-50/30 rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-blue-100 bg-white">
              <CardTitle className="text-xs sm:text-sm font-black text-blue-800 uppercase flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-blue-600" /> Escáner de Facturas con IA
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-normal">
                Toma una foto de la factura con tu celular para autocompletar el formulario
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 sm:gap-3">
                  <Button 
                    asChild
                    disabled={isScanning} 
                    className="h-16 sm:h-20 bg-blue-600 hover:bg-blue-700 shadow-lg cursor-pointer flex-1 rounded-xl"
                  >
                    <label>
                      <div className="flex flex-col items-center justify-center font-black uppercase text-[10px] sm:text-xs gap-1 text-white">
                        {isScanning ? (
                          <><Loader2 className="h-5 w-5 sm:h-7 sm:w-7 animate-spin" /> Analizando</>
                        ) : (
                          <><Camera className="h-5 w-5 sm:h-7 sm:w-7 mb-0.5" /> Tomar Foto</>
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
                    className="h-16 sm:h-20 bg-indigo-600 hover:bg-indigo-700 shadow-lg cursor-pointer flex-1 rounded-xl"
                  >
                    <label>
                      <div className="flex flex-col items-center justify-center font-black uppercase text-[10px] sm:text-xs gap-1 text-white">
                        {isScanning ? (
                          <><Loader2 className="h-5 w-5 sm:h-7 sm:w-7 animate-spin" /> Leyendo...</>
                        ) : (
                          <><ImagePlus className="h-5 w-5 sm:h-7 sm:w-7 mb-0.5" /> De Galería</>
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
                  <div className="mt-3 border-2 border-slate-200 rounded-xl overflow-hidden relative aspect-[4/3] bg-slate-100 shadow-inner">
                    <img src={previewImage} alt="Comprobante" className="w-full h-full object-contain bg-slate-900" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-7">
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b bg-slate-50 p-4 sm:p-5">
              <CardTitle className="text-xs sm:text-sm font-black uppercase text-slate-700">Detalles del Documento</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <FormField control={form.control} name="amount" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold uppercase text-xs text-slate-700">Monto Total (B/.) <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" className="font-black text-red-600 text-lg h-11 rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="dateString" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold uppercase text-xs text-slate-700">Fecha Factura <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input type="date" className="font-semibold uppercase h-11 rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="provider" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold uppercase text-xs text-slate-700">Nombre Proveedor <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input className="font-semibold uppercase h-11 rounded-xl" placeholder="Ej. Delta, Terpel, Riba Smith..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <FormField control={form.control} name="providerRuc" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold uppercase text-xs text-slate-700">RUC</FormLabel>
                        <FormControl>
                          <Input className="font-medium uppercase h-11 rounded-xl" placeholder="RUC" {...field} />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="providerDv" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold uppercase text-xs text-slate-700">DV</FormLabel>
                        <FormControl>
                          <Input className="font-medium uppercase h-11 rounded-xl" placeholder="DV" {...field} />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold uppercase text-xs text-slate-700">N° Factura / Recibo</FormLabel>
                      <FormControl>
                        <Input className="font-medium uppercase bg-amber-50/50 h-11 rounded-xl" placeholder="Ej. #00123" {...field} />
                      </FormControl>
                      <FormDescription className="text-[10px] font-medium text-amber-700">La IA extrae el número de factura para evitar registros duplicados.</FormDescription>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold uppercase text-xs text-slate-700">Categoría <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="font-semibold uppercase h-11 rounded-xl"><SelectValue /></SelectTrigger>
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
                      <FormLabel className="font-bold uppercase text-xs text-slate-700">Concepto / Descripción <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input className="font-medium h-11 rounded-xl" placeholder="Ej. Gasolina 95 octanos Auto 01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button 
                    type="submit" 
                    className="w-full h-12 sm:h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-wider gap-2 shadow-xl rounded-xl cursor-pointer" 
                    disabled={isSaving || isScanning}
                  >
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
