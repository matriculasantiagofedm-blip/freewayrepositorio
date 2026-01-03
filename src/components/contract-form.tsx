'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel as SelectLabelComponent,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, PlusCircle, Loader2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp, collection, query, where, getDocs, writeBatch, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Contract, ContractType, Client } from '@/lib/types';
import { DeluxePremiumContractTemplatePreview } from './deluxe-premium-contract-preview';
import { AutoMotoContractTemplatePreview } from './auto-moto-contract-preview';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { useCurrentRole } from '@/hooks/use-current-role';
import { AmpliacionesContractTemplate } from './ampliaciones-contract';
import { ContractView } from './contract-view';
import { useDb, useUser } from './firebase-provider';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';


// --- Esquemas de Validación con Zod ---

const classScheduleSchema = z.object({
    date: z.date().optional(),
    time: z.string().optional(),
});

const baseSchema = z.object({
  clientName: z.string().min(1, 'El nombre del cliente es requerido.'),
  clientEmail: z.string().email('Por favor, introduce una dirección de correo electrónico válida.'),
  contractType: z.custom<ContractType>(),
  folioNumber: z.number().optional(),
});

const autoMotoDetailsSchema = z.object({
  studentIdNumber: z.string().optional(),
  studentAddress: z.string().optional(),
  studentPhone1: z.string().optional(),
  studentPhone2: z.string().optional(),
  coursePlan: z.string().optional(),
  paidInFull: z.boolean().default(false),
  courseValue: z.number().optional(),
  downPayment: z.number().optional(),
  balance: z.number().optional(),
  paymentDeadline: z.date().optional().nullable(),
  vehicle: z.enum(['Spark', 'P. Blanco', 'P. Bronce', 'Moto']).optional(),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).optional(),
  licenseCategory: z.enum(['A, C', 'A, C, D', 'A, B']).optional(),
  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date().optional()).optional(),
  practicalClassSchedules: z.array(classScheduleSchema).optional(),
  motoPracticalClassSchedules: z.array(classScheduleSchema).optional(),
});

const deluxeDetailsSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  secondLastName: z.string().optional(),
  studentIdNumber: z.string().optional(),
  studentAddress: z.string().optional(),
  studentPhone1: z.string().optional(),
  studentPhone2: z.string().optional(),
  paymentDetails: z.enum(['Premium B/ 201.00', 'Deluxe B/ 270.00']).optional(),
  paymentAmount: z.number().optional(),
  paymentInstallments: z.array(z.date().optional()).optional(),
  vehicleTransmission: z.enum(['Automático', 'Manual']).optional(),
  licenseCategory: z.enum(['A, C', 'A, C, D']).optional(),
  theoreticalClassSchedule: z.enum(['Lunes', 'Miércoles']).optional(),
  theoreticalClasses: z.array(z.date().optional()).optional(),
  classSchedules: z.array(classScheduleSchema).optional(),
});

const ampliacionesDetailsSchema = z.object({
  studentIdNumber: z.string().optional(),
  studentAddress: z.string().optional(),
  studentPhone1: z.string().optional(),
  studentPhone2: z.string().optional(),
  selectedPlans: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
  courseValue: z.number().optional(),
  downPayment: z.number().optional(),
  balance: z.number().optional(),
  paymentDeadline: z.date().optional().nullable(),
  theoreticalClassDate: z.date().optional(),
  theoreticalClassTime: z.string().optional(),
});

const formSchema = baseSchema.extend({
  deluxeDetails: deluxeDetailsSchema.optional(),
  autoMotoDetails: autoMotoDetailsSchema.optional(),
  ampliacionesDetails: ampliacionesDetailsSchema.optional(),
});

type FormValues = z.infer<typeof formSchema>;

// Función auxiliar para convertir las fechas de los detalles a Timestamps de Firestore
const convertDetailsDatesToTimestamps = (details: any) => {
    if (!details) return details;
    const newDetails = { ...details };

    // Deluxe
    if (newDetails.paymentInstallments) {
        newDetails.paymentInstallments = newDetails.paymentInstallments.map((d: Date | undefined) => d ? Timestamp.fromDate(d) : null);
    }
    if (newDetails.theoreticalClasses) {
        newDetails.theoreticalClasses = newDetails.theoreticalClasses.map((d: Date | undefined) => d ? Timestamp.fromDate(d) : null);
    }
    if (newDetails.classSchedules) {
        newDetails.classSchedules = newDetails.classSchedules.map((s: { date?: Date, time?: string }) => ({
            ...s,
            date: s.date ? Timestamp.fromDate(s.date) : null,
        }));
    }

    // Auto/Moto
    if (newDetails.paymentDeadline) {
        newDetails.paymentDeadline = Timestamp.fromDate(newDetails.paymentDeadline);
    }
    if (newDetails.theoreticalClassDates) {
        newDetails.theoreticalClassDates = newDetails.theoreticalClassDates.map((d: Date | undefined) => d ? Timestamp.fromDate(d) : null);
    }
    if (newDetails.practicalClassSchedules) {
        newDetails.practicalClassSchedules = newDetails.practicalClassSchedules.map((s: { date?: Date, time?: string }) => ({
            ...s,
            date: s.date ? Timestamp.fromDate(s.date) : null,
        }));
    }
     if (newDetails.motoPracticalClassSchedules) {
        newDetails.motoPracticalClassSchedules = newDetails.motoPracticalClassSchedules.map((s: { date?: Date, time?: string }) => ({
            ...s,
            date: s.date ? Timestamp.fromDate(s.date) : null,
        }));
    }

    // Ampliaciones
    if (newDetails.paymentDeadline) {
        newDetails.paymentDeadline = Timestamp.fromDate(newDetails.paymentDeadline);
    }
    if (newDetails.theoreticalClassDate) {
        newDetails.theoreticalClassDate = Timestamp.fromDate(newDetails.theoreticalClassDate);
    }


    return newDetails;
};

// --- Componente del Formulario ---

export function ContractForm() {
  const db = useDb();
  const { user } = useUser();
  const { role: currentUserRole } = useCurrentRole();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const contractTypeParam = searchParams.get('type') as ContractType | null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const contractType: ContractType = useMemo(() => contractTypeParam || 'Curso Auto', [contractTypeParam]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: '',
      clientEmail: '',
      contractType: contractType,
      deluxeDetails: {
        paymentInstallments: Array(6).fill(undefined),
        theoreticalClasses: Array(10).fill(undefined),
        classSchedules: Array(6).fill({ date: undefined, time: '' }),
      },
      autoMotoDetails: {
        theoreticalClassDates: Array(3).fill(undefined),
        practicalClassSchedules: Array(6).fill({ date: undefined, time: '' }),
        motoPracticalClassSchedules: Array(6).fill({ date: undefined, time: '' }),
        paidInFull: false,
      },
      ampliacionesDetails: {
        selectedPlans: [],
      }
    },
  });

  const { fields: practicalClassFields, append: appendPracticalClass, remove: removePracticalClass } = useFieldArray({
    control: form.control,
    name: "autoMotoDetails.practicalClassSchedules",
  });
  
  const { fields: motoPracticalClassFields, append: appendMotoPracticalClass, remove: removeMotoPracticalClass } = useFieldArray({
    control: form.control,
    name: "autoMotoDetails.motoPracticalClassSchedules",
  });

  const { fields: ampliacionesPlansFields, append: appendAmpliacionesPlan, remove: removeAmpliacionesPlan } = useFieldArray({
      control: form.control,
      name: "ampliacionesDetails.selectedPlans",
  });

  useEffect(() => {
    form.setValue('contractType', contractType);
    // Reset fields when type changes
    form.reset({
      clientName: form.getValues('clientName'),
      clientEmail: form.getValues('clientEmail'),
      contractType: contractType,
      deluxeDetails: {
        paymentInstallments: Array(6).fill(undefined),
        theoreticalClasses: Array(10).fill(undefined),
        classSchedules: Array(6).fill({ date: undefined, time: '' }),
      },
      autoMotoDetails: {
        theoreticalClassDates: Array(3).fill(undefined),
        practicalClassSchedules: Array(6).fill({ date: undefined, time: '' }),
        motoPracticalClassSchedules: Array(6).fill({ date: undefined, time: '' }),
        paidInFull: false,
      },
       ampliacionesDetails: {
        selectedPlans: [],
      }
    });
  }, [contractType, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
        if (name === 'ampliacionesDetails.selectedPlans') {
            const total = value.ampliacionesDetails?.selectedPlans?.reduce((sum, plan) => sum + (plan?.price || 0), 0) || 0;
            form.setValue('ampliacionesDetails.courseValue', total);
        }
        if (name === 'ampliacionesDetails.courseValue' || name === 'ampliacionesDetails.downPayment') {
            const total = value.ampliacionesDetails?.courseValue || 0;
            const downPayment = value.ampliacionesDetails?.downPayment || 0;
            form.setValue('ampliacionesDetails.balance', total - downPayment);
        }

        if (name === 'autoMotoDetails.courseValue' || name === 'autoMotoDetails.downPayment') {
            const courseValue = value.autoMotoDetails?.courseValue || 0;
            const downPayment = value.autoMotoDetails?.downPayment || 0;
            const paidInFull = value.autoMotoDetails?.paidInFull || false;
            if (paidInFull) {
                form.setValue('autoMotoDetails.downPayment', courseValue);
                form.setValue('autoMotoDetails.balance', 0);
            } else {
                form.setValue('autoMotoDetails.balance', courseValue - downPayment);
            }
        }
        if (name === 'autoMotoDetails.paidInFull') {
            const courseValue = value.autoMotoDetails?.courseValue || 0;
             if (value.autoMotoDetails?.paidInFull) {
                form.setValue('autoMotoDetails.downPayment', courseValue);
                form.setValue('autoMotoDetails.balance', 0);
            } else {
                 form.setValue('autoMotoDetails.downPayment', 0);
                 form.setValue('autoMotoDetails.balance', courseValue);
            }
        }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleSearchClient = async (searchTerm: string) => {
    if (!db || searchTerm.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const clientsRef = collection(db, 'clients');
      const nameQuery = query(clientsRef, where('name', '>=', searchTerm), where('name', '<=', searchTerm + '\uf8ff'));
      const idQuery = query(clientsRef, where('idNumber', '>=', searchTerm), where('idNumber', '<=', searchTerm + '\uf8ff'));

      const [nameSnapshot, idSnapshot] = await Promise.all([getDocs(nameQuery), getDocs(idQuery)]);
      
      const combinedResults: { [id: string]: Client } = {};

      nameSnapshot.forEach(doc => {
          combinedResults[doc.id] = { id: doc.id, ...doc.data() } as Client;
      });
      idSnapshot.forEach(doc => {
          combinedResults[doc.id] = { id: doc.id, ...doc.data() } as Client;
      });

      setSearchResults(Object.values(combinedResults));
    } catch (error) {
      console.error("Error searching clients:", error);
      toast({
        variant: 'destructive',
        title: 'Error de Búsqueda',
        description: 'No se pudieron buscar los clientes.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectClient = (client: Client) => {
      form.setValue('clientName', client.name);
      form.setValue('clientEmail', client.email);
      setSearchResults([]);
      // You can also pre-fill other fields if they exist on the client object
  };

  async function onSubmit(values: FormValues) {
    if (!db || !user) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se ha podido conectar con la base de datos o el usuario no está autenticado.',
        });
        return;
    }
    setIsSubmitting(true);
    
    // Combine names for deluxe contract
    if (contractType === 'Curso Deluxe' && values.deluxeDetails) {
        values.clientName = [values.deluxeDetails.firstName, values.deluxeDetails.middleName, values.deluxeDetails.lastName, values.deluxeDetails.secondLastName].filter(Boolean).join(' ');
    }
    
    try {
        await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, 'counters', 'contract_folio');
            const counterDoc = await transaction.get(counterRef);

            if (!counterDoc.exists()) {
                throw new Error("El contador de folios no existe. Por favor, inicialízalo en la base de datos.");
            }

            const newFolioNumber = counterDoc.data().count + 1;
            transaction.update(counterRef, { count: newFolioNumber });
            
            const batch = writeBatch(db);

            // 1. Check for existing client or create a new one
            const clientsRef = collection(db, 'clients');
            const q = query(clientsRef, where("email", "==", values.clientEmail));
            const clientSnapshot = await getDocs(q);

            let clientId: string;
            let clientData: Partial<Client>;

            if (clientSnapshot.empty) {
                // Create new client
                const newClientRef = doc(clientsRef);
                clientId = newClientRef.id;
                clientData = {
                    id: clientId,
                    name: values.clientName,
                    email: values.clientEmail,
                    userId: user.uid,
                    createdAt: serverTimestamp() as Timestamp,
                };
                batch.set(newClientRef, clientData);
            } else {
                // Use existing client
                clientId = clientSnapshot.docs[0].id;
            }

            // 2. Create the contract
            const newContractRef = doc(collection(db, 'contracts'));
            
            const contractData: Partial<Contract> = {
                id: newContractRef.id,
                folioNumber: newFolioNumber,
                title: values.contractType,
                clientName: values.clientName,
                clientEmail: values.clientEmail,
                clientId: clientId,
                type: values.contractType,
                status: 'active',
                userId: user.uid,
                createdAt: serverTimestamp() as Timestamp,
                createdBy: currentUserRole,
                content: '',
                deadlines: [], // Add logic for deadlines if needed
            };

            if (values.contractType === 'Curso Deluxe') {
                 contractData.deluxeDetails = convertDetailsDatesToTimestamps(values.deluxeDetails);
            } else if (values.contractType === 'Ampliaciones') {
                contractData.ampliacionesDetails = convertDetailsDatesToTimestamps(values.ampliacionesDetails);
            }
            else {
                contractData.autoMotoDetails = convertDetailsDatesToTimestamps(values.autoMotoDetails);
            }
            
            batch.set(newContractRef, contractData);

            // Commit the batch
            await batch.commit();

            toast({
                title: 'Contrato Generado Exitosamente',
                description: `El contrato N° ${String(newFolioNumber).padStart(6, '0')} para ${values.clientName} ha sido creado.`,
            });
            router.push(`/contracts/${newContractRef.id}`);
        });
    } catch (e: any) {
        console.error("Error al crear contrato: ", e);
        // This is a generic error handler.
        // For permission errors, the FirebaseErrorListener will throw a more specific error.
        if (e.name !== 'FirestorePermissionError') {
             toast({
                variant: 'destructive',
                title: 'Error al Guardar',
                description: e.message || 'No se pudo crear el contrato. Revisa los permisos de Firestore.',
            });
        }
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const handlePrintPreview = () => {
    const printUrl = `/print-contract/preview`; // A dummy URL for preview
    // Store form data in sessionStorage to be picked up by the preview page
    sessionStorage.setItem('contractPreviewData', JSON.stringify(form.getValues()));
    window.open(printUrl, '_blank');
  };

  const renderPreview = () => {
    const values = form.getValues();
    const createdBy = currentUserRole;

    const baseProps = {
        clientName: values.clientName,
        clientEmail: values.clientEmail,
        createdBy: createdBy,
        folioNumber: form.getValues('folioNumber'),
    };
    
    switch (contractType) {
        case 'Curso Deluxe':
            return <DeluxePremiumContractTemplatePreview {...baseProps} deluxeDetails={values.deluxeDetails} />;
        case 'Curso Auto':
        case 'Curso Moto':
        case 'Curso Mixto':
             return <AutoMotoContractTemplatePreview {...baseProps} type={contractType} autoMotoDetails={values.autoMotoDetails} />;
        case 'Ampliaciones':
            // The template for 'Ampliaciones' needs to be created
            return <p>Vista previa para Ampliaciones no disponible.</p>;
        default:
             return <p>Seleccione un tipo de contrato para ver la vista previa.</p>;
    }
  };

  const ampliacionesPlans = [
    { name: 'Teórico B', price: 20 },
    { name: 'Teórico C', price: 20 },
    { name: 'Teórico D', price: 25 },
    { name: 'Teórico E, F', price: 30 },
    { name: 'Teórico G, H, I', price: 35 },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 print:p-0">
        
        {/* --- Sección de Búsqueda y Datos del Cliente --- */}
        <Card className="print:hidden">
            <CardHeader>
                <CardTitle>Datos del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <FormLabel htmlFor="client-search">Buscar Cliente Existente</FormLabel>
                        <div className="flex gap-2">
                             <Input 
                                id="client-search"
                                placeholder="Buscar por nombre o cédula..."
                                onChange={(e) => handleSearchClient(e.target.value)}
                              />
                             {isSearching && <Loader2 className="h-6 w-6 animate-spin" />}
                        </div>
                        {searchResults.length > 0 && (
                            <div className="border rounded-md mt-2 max-h-40 overflow-y-auto">
                                {searchResults.map(client => (
                                    <div key={client.id} className="p-2 hover:bg-muted cursor-pointer" onClick={() => handleSelectClient(client)}>
                                        <p className="font-semibold">{client.name}</p>
                                        <p className="text-sm text-muted-foreground">{client.email}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                     <FormField
                        control={form.control}
                        name="clientEmail"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Correo Electrónico</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: john.doe@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </div>
                {contractType !== 'Curso Deluxe' && (
                     <FormField
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nombre Completo del Cliente</FormLabel>
                        <FormControl>
                            <Input placeholder="Ej: John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                )}
            </CardContent>
        </Card>


        {/* --- Acordeón para Detalles del Contrato --- */}
        <Accordion type="single" collapsible defaultValue="item-1" className="w-full print:hidden">
            <AccordionItem value="item-1">
                <AccordionTrigger>
                    <h3 className="font-semibold text-lg">Detalles Específicos del Contrato</h3>
                </AccordionTrigger>
                <AccordionContent>
                    {/* Renderizado condicional de los campos del formulario */}
                    {contractType === 'Curso Deluxe' && (
                        <div className="space-y-4 p-4 border rounded-md">
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.firstName"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Primer Nombre</FormLabel>
                                        <FormControl><Input placeholder="John" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.middleName"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Segundo Nombre</FormLabel>
                                        <FormControl><Input placeholder="Fitzgerald" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.lastName"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Primer Apellido</FormLabel>
                                        <FormControl><Input placeholder="Kennedy" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.secondLastName"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Segundo Apellido</FormLabel>
                                        <FormControl><Input placeholder="" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.studentIdNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Cédula o Pasaporte</FormLabel>
                                        <FormControl><Input placeholder="Ej: 8-123-456" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.studentAddress"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Dirección</FormLabel>
                                        <FormControl><Input placeholder="Dirección completa" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.studentPhone1"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Teléfono 1</FormLabel>
                                        <FormControl><Input placeholder="Ej: 6123-4567" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.studentPhone2"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Teléfono 2 (Opcional)</FormLabel>
                                        <FormControl><Input placeholder="Ej: 345-6789" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="deluxeDetails.paymentDetails"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Plan de Pago</FormLabel>
                                    <Select onValueChange={(value) => {
                                        field.onChange(value);
                                        const amount = value === 'Premium B/ 201.00' ? 33.50 : 45.00;
                                        form.setValue('deluxeDetails.paymentAmount', amount);
                                    }} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="Premium B/ 201.00">Premium - 6 cuotas de B/. 33.50</SelectItem>
                                            <SelectItem value="Deluxe B/ 270.00">Deluxe - 6 cuotas de B/. 45.00</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    </FormItem>
                                )}
                            />
                            <div>
                                <FormLabel>Fechas de Pago (6 Cuotas Quincenales)</FormLabel>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                     {Array.from({ length: 6 }).map((_, index) => (
                                        <FormField
                                            key={index}
                                            control={form.control}
                                            name={`deluxeDetails.paymentInstallments.${index}`}
                                            render={({ field }) => (
                                            <FormItem className='flex flex-col'>
                                                <FormLabel className='text-xs'>Cuota {index + 1}</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(field.value, "P", { locale: es }) : <span>Seleccionar</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                    </PopoverContent>
                                                </Popover>
                                            </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.vehicleTransmission"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Transmisión de Vehículo</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Automático">Automático</SelectItem>
                                                <SelectItem value="Manual">Manual</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.licenseCategory"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Categoría de Licencia</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="A, C">A, C</SelectItem>
                                                <SelectItem value="A, C, D">A, C, D</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
                             <div>
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.theoreticalClassSchedule"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Horario Teórico</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccione el horario..."/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Lunes">Lunes (8:00am - 10:00am)</SelectItem>
                                                <SelectItem value="Miércoles">Miércoles (7:00pm - 9:00pm)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                                    {Array.from({ length: 10 }).map((_, index) => (
                                        <FormField
                                            key={index}
                                            control={form.control}
                                            name={`deluxeDetails.theoreticalClasses.${index}`}
                                            render={({ field }) => (
                                            <FormItem className='flex flex-col'>
                                                <FormLabel className='text-xs'>Semana {index + 1}</FormLabel>
                                                 <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal text-xs h-8", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(field.value, "P", { locale: es }) : <span>Fecha</span>}
                                                            <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                                                        </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                    </PopoverContent>
                                                </Popover>
                                            </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                             <div>
                                <FormLabel>Clases Prácticas (6 clases)</FormLabel>
                                <div className="space-y-2 mt-2 text-sm text-muted-foreground">
                                    Las fechas y horas de las clases prácticas se completarán a mano en el contrato impreso.
                                </div>
                            </div>
                        </div>
                    )}

                    {(contractType === 'Curso Auto' || contractType === 'Curso Moto' || contractType === 'Curso Mixto') && (
                        <div className="space-y-4 p-4 border rounded-md">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="autoMotoDetails.studentIdNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Cédula o Pasaporte</FormLabel>
                                        <FormControl><Input placeholder="Ej: 8-123-456" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="autoMotoDetails.studentAddress"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Dirección</FormLabel>
                                        <FormControl><Input placeholder="Dirección completa" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="autoMotoDetails.studentPhone1"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Teléfono 1</FormLabel>
                                        <FormControl><Input placeholder="Ej: 6123-4567" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="autoMotoDetails.studentPhone2"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Teléfono 2 (Opcional)</FormLabel>
                                        <FormControl><Input placeholder="Ej: 345-6789" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <FormField
                                    control={form.control}
                                    name="autoMotoDetails.courseValue"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Valor del Curso (B/.)</FormLabel>
                                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="autoMotoDetails.paidInFull"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-start space-x-2 pb-2">
                                            <FormControl>
                                                <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormLabel className='mb-0'>Pagado por completo</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="autoMotoDetails.downPayment"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Abono (B/.)</FormLabel>
                                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} disabled={form.watch('autoMotoDetails.paidInFull')} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="autoMotoDetails.balance"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Saldo Pendiente (B/.)</FormLabel>
                                        <FormControl><Input type="number" {...field} readOnly className="bg-muted" /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="autoMotoDetails.paymentDeadline"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                        <FormLabel>Fecha Límite de Pago</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={form.watch('autoMotoDetails.paidInFull')}>
                                                        {field.value ? format(field.value, "P", { locale: es }) : <span>Seleccionar fecha</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        </FormItem>
                                    )}
                                />
                            </div>

                             <div className="grid grid-cols-2 gap-4">
                                {contractType !== 'Curso Moto' && (
                                    <FormField
                                        control={form.control}
                                        name="autoMotoDetails.vehicleTransmission"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Transmisión</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Automático">Automático</SelectItem>
                                                    <SelectItem value="Manual">Manual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            </FormItem>
                                        )}
                                    />
                                )}
                                <FormField
                                    control={form.control}
                                    name="autoMotoDetails.licenseCategory"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Categoría de Licencia</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {contractType === 'Curso Moto' ? (
                                                     <SelectItem value="A, B">A, B</SelectItem>
                                                ) : (
                                                    <>
                                                        <SelectItem value="A, C">A, C</SelectItem>
                                                        <SelectItem value="A, C, D">A, C, D</SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
                             <div>
                                <FormField
                                    control={form.control}
                                    name="autoMotoDetails.theoreticalClassSchedule"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Horario Teórico</FormLabel>
                                        <FormControl><Input {...field} placeholder="Ej: Lunes, Miércoles y Viernes de 8am a 10am" /></FormControl>
                                    </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                     {Array.from({ length: 3 }).map((_, index) => (
                                        <FormField
                                            key={index}
                                            control={form.control}
                                            name={`autoMotoDetails.theoreticalClassDates.${index}`}
                                            render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel className="text-xs">Clase Teórica {index + 1}</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(field.value, "P", { locale: es }) : <span>Seleccionar</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                    </PopoverContent>
                                                </Popover>
                                            </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                            
                            {contractType === 'Curso Mixto' ? (
                                <>
                                <div>
                                    <FormLabel>Clases Prácticas de Auto ({practicalClassFields.length})</FormLabel>
                                    <div className="space-y-2 mt-2">
                                        {practicalClassFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-3 gap-2 items-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.date`}
                                                    render={({ field: dateField }) => <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "P", { locale: es }) : <span>Fecha {index + 1}</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} /></PopoverContent></Popover></FormItem>}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.time`}
                                                    render={({ field: timeField }) => <FormItem><FormControl><Input placeholder={`Hora ${index+1}`} {...timeField} /></FormControl></FormItem>}
                                                />
                                                <Button type="button" variant="ghost" size="sm" onClick={() => removePracticalClass(index)}>Eliminar</Button>
                                            </div>
                                        ))}
                                    </div>
                                    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => appendPracticalClass({ date: undefined, time: '' })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase de Auto
                                    </Button>
                                </div>
                                <div>
                                    <FormLabel>Clases Prácticas de Moto ({motoPracticalClassFields.length})</FormLabel>
                                    <div className="space-y-2 mt-2">
                                        {motoPracticalClassFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-3 gap-2 items-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.motoPracticalClassSchedules.${index}.date`}
                                                    render={({ field: dateField }) => <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "P", { locale: es }) : <span>Fecha {index + 1}</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} /></PopoverContent></Popover></FormItem>}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.motoPracticalClassSchedules.${index}.time`}
                                                    render={({ field: timeField }) => <FormItem><FormControl><Input placeholder={`Hora ${index+1}`} {...timeField} /></FormControl></FormItem>}
                                                />
                                                <Button type="button" variant="ghost" size="sm" onClick={() => removeMotoPracticalClass(index)}>Eliminar</Button>
                                            </div>
                                        ))}
                                    </div>
                                    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => appendMotoPracticalClass({ date: undefined, time: '' })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase de Moto
                                    </Button>
                                </div>
                                </>
                            ) : (
                                <div>
                                    <FormLabel>Clases Prácticas ({practicalClassFields.length})</FormLabel>
                                    <div className="space-y-2 mt-2">
                                        {practicalClassFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-3 gap-2 items-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.date`}
                                                    render={({ field: dateField }) => <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "P", { locale: es }) : <span>Fecha {index + 1}</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} /></PopoverContent></Popover></FormItem>}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.time`}
                                                    render={({ field: timeField }) => <FormItem><FormControl><Input placeholder={`Hora ${index+1}`} {...timeField} /></FormControl></FormItem>}
                                                />
                                                <Button type="button" variant="ghost" size="sm" onClick={() => removePracticalClass(index)}>Eliminar</Button>
                                            </div>
                                        ))}
                                    </div>
                                     <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => appendPracticalClass({ date: undefined, time: '' })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase
                                    </Button>
                                </div>
                            )}

                        </div>
                    )}
                    
                    {contractType === 'Ampliaciones' && (
                        <div className="space-y-4 p-4 border rounded-md">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="ampliacionesDetails.studentIdNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Cédula o Pasaporte</FormLabel>
                                        <FormControl><Input placeholder="Ej: 8-123-456" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ampliacionesDetails.studentAddress"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Dirección</FormLabel>
                                        <FormControl><Input placeholder="Dirección completa" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ampliacionesDetails.studentPhone1"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Teléfono 1</FormLabel>
                                        <FormControl><Input placeholder="Ej: 6123-4567" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ampliacionesDetails.studentPhone2"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Teléfono 2 (Opcional)</FormLabel>
                                        <FormControl><Input placeholder="Ej: 345-6789" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                             <div>
                                <FormLabel>Planes de Ampliación</FormLabel>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                                    {ampliacionesPlans.map(plan => (
                                        <div key={plan.name} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`plan-${plan.name}`}
                                                onCheckedChange={(checked) => {
                                                    const currentPlans = form.getValues('ampliacionesDetails.selectedPlans') || [];
                                                    if (checked) {
                                                        form.setValue('ampliacionesDetails.selectedPlans', [...currentPlans, plan]);
                                                    } else {
                                                        form.setValue('ampliacionesDetails.selectedPlans', currentPlans.filter(p => p.name !== plan.name));
                                                    }
                                                }}
                                            />
                                            <label htmlFor={`plan-${plan.name}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                {plan.name} (B/.{plan.price})
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                 <FormField
                                    control={form.control}
                                    name="ampliacionesDetails.courseValue"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Valor Total (B/.)</FormLabel>
                                        <FormControl><Input type="number" {...field} readOnly className="bg-muted" /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ampliacionesDetails.downPayment"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Abono (B/.)</FormLabel>
                                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ampliacionesDetails.balance"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Saldo (B/.)</FormLabel>
                                        <FormControl><Input type="number" {...field} readOnly className="bg-muted" /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ampliacionesDetails.paymentDeadline"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                        <FormLabel>Fecha Límite de Saldo</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "P", { locale: es }) : <span>Seleccionar</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        </FormItem>
                                    )}
                                />
                            </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="ampliacionesDetails.theoreticalClassDate"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                        <FormLabel>Fecha de Clase Teórica</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "P", { locale: es }) : <span>Seleccionar</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ampliacionesDetails.theoreticalClassTime"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Hora de Clase Teórica</FormLabel>
                                            <FormControl><Input placeholder="Ej: 9:00 AM" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
        

        {/* --- Botones de Acción --- */}
        <div className="flex justify-between items-center print:hidden">
            <Button type="button" variant="outline" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? 'Ocultar Vista Previa' : 'Mostrar Vista Previa'}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Guardando...' : 'Guardar Contrato'}
            </Button>
        </div>

        {/* --- Vista Previa del Contrato --- */}
        {showPreview && (
            <div className="print:block">
                <h3 className="text-lg font-semibold my-4 print:hidden">Vista Previa del Contrato</h3>
                <div className="border rounded-lg p-4 bg-gray-50 print:border-none print:p-0 print:bg-white">
                    <ContractView contract={form.getValues() as unknown as Contract} />
                </div>
            </div>
        )}
      </form>
    </Form>
  );
}
