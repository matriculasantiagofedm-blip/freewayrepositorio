'use client';

import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  runTransaction,
  query,
  orderBy,
  limit,
  getDocs,
  where,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { sendAutomatedDeadlineReminders } from '@/ai/flows/automated-deadline-reminders';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PlusCircle, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { DeluxePremiumContractTemplatePreview } from './deluxe-premium-contract-preview';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import type { Client, DeluxeContractDetails, ContractType, Contract, AutoMotoContractDetails } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { AutoMotoContractTemplatePreview } from './auto-moto-contract-preview';


const contractFormSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres.'),
  clientName: z.string().min(3, 'El nombre del cliente debe tener al menos 3 caracteres.'),
  clientEmail: z.string().email('Por favor, introduce una dirección de correo electrónico válida.'),
  content: z.string().optional().nullable(),
  type: z.enum([
    'Curso Auto', 
    'Curso Moto', 
    'Curso Mixto',
    'Curso Deluxe',
    'Ampliaciones',
  ], { required_error: 'Debes seleccionar un tipo de contrato.'}),
  deadlines: z.array(
    z.object({
      description: z.string().min(3, 'La descripción del plazo es obligatoria.'),
      date: z.string({ required_error: 'Se requiere una fecha.' }),
    })
  ).optional(),
  deluxeDetails: z.object({
    studentIdNumber: z.string().optional(),
    studentAddress: z.string().optional(),
    studentPhone1: z.string().optional(),
    studentPhone2: z.string().optional(),
    paymentDetails: z.string().optional(),
    paymentInstallments: z.array(z.string().optional()).optional(),
    paymentAmount: z.number().optional(),
    vehicleTransmission: z.enum(['Automático', 'Manual']).optional(),
    licenseCategory: z.enum(['A, C', 'A, C, D']).optional(),
    theoreticalClassSchedule: z.enum(['Lunes', 'Miércoles']).optional(),
    theoreticalClasses: z.array(z.string().optional()).optional(),
    classSchedules: z.array(z.object({
      date: z.string().optional(),
      time: z.string().optional(),
    })).optional(),
  }).optional(),
  autoMotoDetails: z.object({
    studentIdNumber: z.string().optional(),
    studentAddress: z.string().optional(),
    studentPhone: z.string().optional(),
    courseValue: z.number().optional(),
    downPayment: z.number().optional(),
    balance: z.number().optional(),
    paymentDeadline: z.string().optional(),
    vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).optional(),
    licenseCategory: z.enum(['A, C', 'A, C, D', 'A, B']).optional(),
    theoreticalClassSchedule: z.string().optional(),
    practicalClassSchedules: z.array(z.object({
      time: z.string().optional(),
    })).optional(),
  }).optional(),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

const generateTimeSlots = () => {
    return ['08:00 AM', '10:00 AM', '01:00 PM', '03:00 PM'];
};

export function ContractForm() {
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const timeSlots = generateTimeSlots();
  const { role } = useCurrentRole();
  const [balance, setBalance] = useState<string>('0.00');

  
  const contractTypeParam = searchParams.get('type') as ContractType | null;

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      title: '',
      clientName: '',
      clientEmail: '',
      content: '',
      type: contractTypeParam || undefined,
      deadlines: [],
      deluxeDetails: {
        studentIdNumber: '',
        studentAddress: '',
        studentPhone1: '',
        studentPhone2: '',
        paymentDetails: 'El valor total del curso es de B/201.00, mas una matricula de B/15.00',
        paymentInstallments: Array(6).fill(''),
        paymentAmount: 33.50,
        vehicleTransmission: undefined,
        licenseCategory: undefined,
        theoreticalClassSchedule: undefined,
        theoreticalClasses: Array(10).fill(''),
        classSchedules: [{ date: '', time: '' }],
      },
      autoMotoDetails: {
        studentIdNumber: '',
        studentAddress: '',
        studentPhone: '',
        courseValue: undefined,
        downPayment: undefined,
        balance: 0,
        paymentDeadline: '',
        vehicleTransmission: undefined,
        licenseCategory: undefined,
        theoreticalClassSchedule: '',
        practicalClassSchedules: Array(4).fill({ time: '' }),
      }
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'deadlines',
  });

  const { fields: classFields, append: appendClass, remove: removeClass } = useFieldArray({
    control: form.control,
    name: 'deluxeDetails.classSchedules',
  });

  const contractType = form.watch('type');
  const allFormValues = form.watch();
  const paymentAmount = form.watch('deluxeDetails.paymentAmount');
  const courseValue = form.watch('autoMotoDetails.courseValue');
  const downPayment = form.watch('autoMotoDetails.downPayment');

  useEffect(() => {
    if (contractType) {
        form.setValue('title', `Contrato de ${contractType}`);
    } else {
        form.setValue('title', '');
    }
  }, [contractType, form]);

  useEffect(() => {
    if (paymentAmount === 45.00) {
      form.setValue('deluxeDetails.paymentDetails', 'El valor total del curso es de B/270.00, mas una matricula de B/15.00');
    } else if (paymentAmount === 33.50) {
      form.setValue('deluxeDetails.paymentDetails', 'El valor total del curso es de B/201.00, mas una matricula de B/15.00');
    }
  }, [paymentAmount, form]);
  
  useEffect(() => {
    const cv = courseValue || 0;
    if (cv > 0) {
      const half = cv / 2;
      const newBalance = cv - half;
      form.setValue('autoMotoDetails.downPayment', parseFloat(half.toFixed(2)));
      form.setValue('autoMotoDetails.balance', parseFloat(newBalance.toFixed(2)));
      setBalance(newBalance.toFixed(2));
    } else {
      form.setValue('autoMotoDetails.downPayment', undefined);
      form.setValue('autoMotoDetails.balance', 0);
      setBalance('0.00');
    }
  }, [courseValue, form]);


  async function findOrCreateClient(clientName: string, clientEmail: string, userId: string): Promise<string> {
    const clientRef = doc(firestore, 'clients', userId);
    const clientSnap = await getDoc(clientRef);

    if (!clientSnap.exists()) {
        const newClient: Omit<Client, 'id'> = {
            id: userId,
            name: clientName,
            email: clientEmail,
            userId: userId,
            createdAt: serverTimestamp() as any
        };
        await setDoc(clientRef, newClient);
    }
    return userId;
}

  async function getNextFolio(userId: string): Promise<string> {
    const year = new Date().getFullYear();
    const folioPrefix = `CT-${year}-`;
  
    const contractsCollection = collection(firestore, `clients/${userId}/contracts`);
    
    // Create a query to find contracts for the current year, ordered by folio descending
    const q = query(
      contractsCollection, 
      where('folio', '>=', folioPrefix),
      where('folio', '<', `CT-${year+1}-`),
      orderBy('folio', 'desc'),
      limit(1)
    );
  
    const querySnapshot = await getDocs(q);
  
    let lastFolioNumber = 0;
    if (!querySnapshot.empty) {
      const lastContract = querySnapshot.docs[0].data() as Contract;
      // Check if the last contract is from the current year
      if (lastContract.folio && lastContract.folio.startsWith(folioPrefix)) {
        const lastNumberStr = lastContract.folio.split('-').pop();
        if (lastNumberStr) {
          lastFolioNumber = parseInt(lastNumberStr, 10);
        }
      }
    }
    
    const nextNumber = (lastFolioNumber + 1).toString().padStart(4, '0');
    
    return `${folioPrefix}${nextNumber}`;
  }


  async function onSubmit(data: ContractFormValues) {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error de autenticación',
        description: 'Debes iniciar sesión para crear un contrato.',
      });
      return;
    }

    try {
      const folio = await getNextFolio(user.uid);
      const clientId = await findOrCreateClient(data.clientName, data.clientEmail, user.uid);
      
      const contractsCollection = collection(firestore, 'clients', user.uid, 'contracts');
      
      const contractContent = (data.type === 'Curso Deluxe' || data.type === 'Curso Auto' || data.type === 'Curso Moto' || data.type === 'Curso Mixto' ) ? '' : data.content;

      const newContractData: any = {
          folio: folio,
          title: data.title,
          content: contractContent,
          type: data.type,
          deadlines: data.deadlines?.map(d => ({...d, date: new Date(d.date)})) || [],
          clientId: clientId,
          clientEmail: data.clientEmail,
          clientName: data.clientName,
          userId: user.uid,
          status: 'active',
          createdAt: serverTimestamp(),
          createdBy: role,
      };

      if (data.type === 'Curso Deluxe' && data.deluxeDetails) {
          const sanitizedDeluxeDetails = Object.fromEntries(
            Object.entries(data.deluxeDetails).map(([key, value]) => [key, value === undefined ? null : value])
          );
          
          newContractData.deluxeDetails = {
            ...sanitizedDeluxeDetails,
            classSchedules: data.deluxeDetails.classSchedules?.map(cs => ({...cs, date: cs.date ? new Date(cs.date) : new Date() }))
          };
      }
      
      if ((data.type === 'Curso Auto' || data.type === 'Curso Moto') && data.autoMotoDetails) {
          newContractData.autoMotoDetails = data.autoMotoDetails;
      }

      const newContractRef = await addDoc(contractsCollection, newContractData);
      const contractId = newContractRef.id;
      
      await updateDoc(newContractRef, { id: contractId });


      if (data.deadlines && data.deadlines.length > 0) {
        await sendAutomatedDeadlineReminders({
          contractId,
          clientEmail: data.clientEmail,
          userEmail: user.email || 'legaleagle@example.com', 
          deadlines: data.deadlines.map(d => ({
              ...d,
              date: d.date // Date is already a string in YYYY-MM-DD format
          })),
        });
      }

      toast({
        title: '¡Contrato Guardado!',
        description: `El contrato "${data.title}" ha sido creado exitosamente con el folio ${folio}.`,
      });
      
      router.push(`/contracts/${contractId}?print=true`);

    } catch (error) {
      console.error('Error creating contract:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      toast({
        variant: 'destructive',
        title: 'Error al crear el contrato',
        description: errorMessage,
      });
    }
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Detalles del Contrato</CardTitle>
            <CardDescription>
              Completa los detalles principales de tu acuerdo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Contrato</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo de contrato" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Curso Auto">Curso Auto</SelectItem>
                      <SelectItem value="Curso Moto">Curso Moto</SelectItem>
                      <SelectItem value="Curso Mixto">Curso Mixto</SelectItem>
                      <SelectItem value="Curso Deluxe">Curso Deluxe</SelectItem>
                      <SelectItem value="Ampliaciones">Ampliaciones</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título del Contrato</FormLabel>
                  <FormControl>
                    <Input placeholder="ej., Contrato de Curso Auto" {...field} readOnly />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
           
            {(contractType === 'Curso Auto' || contractType === 'Curso Moto') && (
              <div className="space-y-6 pt-4">
                 <div className="space-y-4">
                   <h3 className="text-lg font-medium text-primary border-b pb-2">Datos del Estudiante</h3>
                    <FormField
                      control={form.control}
                      name="clientName"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Nombre del Estudiante</FormLabel>
                              <FormControl>
                                  <Input placeholder="ej., Juan Pérez" {...field} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                    />
                    <FormField
                        control={form.control}
                        name="clientEmail"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email del Estudiante</FormLabel>
                                <FormControl>
                                    <Input placeholder="estudiante@ejemplo.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="autoMotoDetails.studentIdNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cédula/Pasaporte</FormLabel>
                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="autoMotoDetails.studentAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Domicilio</FormLabel>
                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="autoMotoDetails.studentPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teléfono</FormLabel>
                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                          </FormItem>
                        )}
                      />
                 </div>

                 <div className="space-y-4">
                    <h3 className="text-lg font-medium text-primary border-b pb-2">Cláusula Primera: Valor y Forma de Pago</h3>
                    <div className="grid grid-cols-3 gap-4">
                       <FormField
                          control={form.control}
                          name="autoMotoDetails.courseValue"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Valor Total del Curso (B/.)</FormLabel>
                                  <FormControl>
                                      <Input 
                                          type="number" 
                                          step="0.01"
                                          {...field} 
                                          value={field.value ?? ''}
                                          onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                          placeholder="0.00"
                                      />
                                  </FormControl>
                              </FormItem>
                          )}
                        />
                        <FormField
                            control={form.control}
                            name="autoMotoDetails.downPayment"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Abono (B/.)</FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            step="0.01"
                                            {...field} 
                                            value={field.value?.toFixed(2) ?? ''}
                                            readOnly
                                            className="bg-muted"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                         <FormItem>
                            <FormLabel>Saldo (B/.)</FormLabel>
                            <FormControl>
                                <Input 
                                    type="number" 
                                    step="0.01"
                                    value={balance}
                                    readOnly
                                    className="bg-muted"
                                />
                            </FormControl>
                        </FormItem>
                    </div>
                     <FormField
                        control={form.control}
                        name="autoMotoDetails.paymentDeadline"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Fecha Límite de Pago del Saldo</FormLabel>
                                <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl>
                            </FormItem>
                        )}
                      />
                 </div>
                 
                 <div className="space-y-4">
                    <h3 className="text-lg font-medium text-primary border-b pb-2">Cláusula Segunda: Detalles del Curso</h3>
                    <FormField
                      control={form.control}
                      name="autoMotoDetails.vehicleTransmission"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transmisión del Vehículo</FormLabel>
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Automático" id="auto" /></FormControl><FormLabel htmlFor="auto" className="font-normal">Automático</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Manual" id="manual" /></FormControl><FormLabel htmlFor="manual" className="font-normal">Manual</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Moto" id="moto" /></FormControl><FormLabel htmlFor="moto" className="font-normal">Moto</FormLabel></FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="autoMotoDetails.licenseCategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoría de Licencia a Aplicar</FormLabel>
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="A, C" id="ac" /></FormControl><FormLabel htmlFor="ac" className="font-normal">A, C</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="A, C, D" id="acd" /></FormControl><FormLabel htmlFor="acd" className="font-normal">A, C, D</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="A, B" id="ab" /></FormControl><FormLabel htmlFor="ab" className="font-normal">A, B</FormLabel></FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                        control={form.control}
                        name="autoMotoDetails.theoreticalClassSchedule"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Horario para clases teóricas</FormLabel>
                                <FormControl><Input {...field} value={field.value || ''} placeholder="Ej: Lunes, 8-10 AM" /></FormControl>
                            </FormItem>
                        )}
                    />
                    <div>
                        <h4 className="font-medium text-base mb-2">Horario para clases prácticas</h4>
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <FormField
                                    key={index}
                                    control={form.control}
                                    name={`autoMotoDetails.practicalClassSchedules.${index}.time`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Hora Clase {index + 1}</FormLabel>
                                            <FormControl><Input {...field} value={field.value || ''} placeholder="Ej: 10:00 AM" /></FormControl>
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                 </div>


                  <div className="mt-6">
                      <h3 className="text-lg font-medium mb-2">Vista Previa del Contrato</h3>
                      <AutoMotoContractTemplatePreview 
                        folio={"CT-XXXX-XXXX"}
                        clientName={allFormValues.clientName}
                        clientEmail={allFormValues.clientEmail}
                        autoMotoDetails={allFormValues.autoMotoDetails as AutoMotoContractDetails}
                        createdBy={role}
                      />
                  </div>
              </div>
            )}
            
            {contractType === 'Curso Deluxe' ? (
                <div className="space-y-6 pt-4">

                  {/* DATOS DEL ESTUDIANTE */}
                  <div className="space-y-4">
                     <h3 className="text-lg font-medium text-primary border-b pb-2">Datos del Estudiante</h3>
                     <FormField
                        control={form.control}
                        name="clientName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nombre del Estudiante</FormLabel>
                                <FormControl>
                                    <Input placeholder="ej., Juan Pérez" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                      />
                      <FormField
                          control={form.control}
                          name="clientEmail"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Email del Estudiante</FormLabel>
                                  <FormControl>
                                      <Input placeholder="estudiante@ejemplo.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                     <FormField
                        control={form.control}
                        name="deluxeDetails.studentIdNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cédula/Pasaporte del Estudiante</FormLabel>
                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="deluxeDetails.studentAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Domicilio del Estudiante</FormLabel>
                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="deluxeDetails.studentPhone1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Teléfono 1</FormLabel>
                              <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="deluxeDetails.studentPhone2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Teléfono 2</FormLabel>
                              <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                   </div>

                  {/* CLAUSULA SEGUNDA */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-primary border-b pb-2">Cláusula Segunda: Valor, Matrícula y Forma de Pago</h3>
                    <div>
                      <FormLabel>Plan de Pagos</FormLabel>
                      <p className="text-sm text-muted-foreground pb-2">
                          Seleccione el plan. El pago se realizará en 6 cuotas con fechas de pago establecidas cada dos semanas.
                      </p>
                      <FormField
                        control={form.control}
                        name="deluxeDetails.paymentDetails"
                        render={({ field }) => (
                            <FormItem className='p-4 border border-dashed rounded-md min-h-16'>
                                <FormControl>
                                    <Input {...field} className="border-none p-0 h-auto bg-transparent" readOnly/>
                                </FormControl>
                            </FormItem>
                        )}
                        />
                      <FormField
                          control={form.control}
                          name="deluxeDetails.paymentAmount"
                          render={({ field }) => (
                              <FormItem className="pt-4">
                                  <FormControl>
                                  <RadioGroup
                                      onValueChange={(value) => field.onChange(parseFloat(value))}
                                      defaultValue={field.value?.toString()}
                                      className="flex gap-4"
                                  >
                                      <FormItem className="flex items-center space-x-2">
                                          <FormControl>
                                              <RadioGroupItem value="45.00" id="amount-45" />
                                          </FormControl>
                                          <FormLabel htmlFor="amount-45" className="font-normal">Deluxe 16 Hrs (Total B/.270.00)</FormLabel>
                                      </FormItem>
                                      <FormItem className="flex items-center space-x-2">
                                          <FormControl>
                                              <RadioGroupItem value="33.50" id="amount-33" />
                                          </FormControl>
                                          <FormLabel htmlFor="amount-33" className="font-normal">Deluxe 12 Hrs (Total B/.201.00)</FormLabel>
                                      </FormItem>
                                  </RadioGroup>
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                          />
                      <div className="space-y-4 pt-4">
                          <h4 className="font-medium text-base">Fechas de Cuotas</h4>
                          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                              {[1, 2, 3].map(i => (
                                  <React.Fragment key={i}>
                                      <FormField
                                          control={form.control}
                                          name={`deluxeDetails.paymentInstallments.${i - 1}`}
                                          render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel>Fecha Cuota {i}</FormLabel>
                                                  <FormControl>
                                                      <Input type="date" {...field} value={field.value || ''} />
                                                  </FormControl>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                      <FormField
                                          control={form.control}
                                          name={`deluxeDetails.paymentInstallments.${i + 2}`}
                                          render={({ field }) => (
                                              <FormItem>
                                                  <FormLabel>Fecha Cuota {i + 3}</FormLabel>
                                                  <FormControl>
                                                      <Input type="date" {...field} value={field.value || ''} />
                                                  </FormControl>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                  </React.Fragment>
                              ))}
                          </div>
                      </div>
                    </div>
                  </div>

                  {/* CLAUSULA TERCERA */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-primary border-b pb-2">Cláusula Tercera: Detalles del Curso</h3>
                    <FormField
                      control={form.control}
                      name="deluxeDetails.vehicleTransmission"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transmisión del Vehículo</FormLabel>
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                              <FormItem className="flex items-center space-x-2">
                                <FormControl><RadioGroupItem value="Automático" id="auto" /></FormControl>
                                <FormLabel htmlFor="auto" className="font-normal">Automático</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2">
                                <FormControl><RadioGroupItem value="Manual" id="manual" /></FormControl>
                                <FormLabel htmlFor="manual" className="font-normal">Manual</FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deluxeDetails.licenseCategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoría de Licencia a Aplicar</FormLabel>
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                              <FormItem className="flex items-center space-x-2">
                                <FormControl><RadioGroupItem value="A, C" id="ac" /></FormControl>
                                <FormLabel htmlFor="ac" className="font-normal">A, C</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2">
                                <FormControl><RadioGroupItem value="A, C, D" id="acd" /></FormControl>
                                <FormLabel htmlFor="acd" className="font-normal">A, C, D</FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                   {/* CLAUSULA CUARTA */}
                   <div className="space-y-4">
                    <h3 className="text-lg font-medium text-primary border-b pb-2">Cláusula Cuarta: Horario de Capacitación</h3>
                    <div>
                      <h4 className="font-medium text-base mb-2">Capacitación Teórica</h4>
                      <FormField
                        control={form.control}
                        name="deluxeDetails.theoreticalClassSchedule"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Horario de Clases Teóricas</FormLabel>
                            <FormControl>
                              <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl><RadioGroupItem value="Lunes" id="lunes" /></FormControl>
                                  <FormLabel htmlFor="lunes" className="font-normal">Lunes de 8:00 AM a 10:00 AM</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl><RadioGroupItem value="Miércoles" id="miercoles" /></FormControl>
                                  <FormLabel htmlFor="miercoles" className="font-normal">Miércoles de 7:00 PM a 9:00 PM</FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-4">
                          {Array.from({ length: 10 }).map((_, i) => (
                              <FormField
                                  key={i}
                                  control={form.control}
                                  name={`deluxeDetails.theoreticalClasses.${i}`}
                                  render={({ field }) => (
                                      <FormItem>
                                          <FormLabel>Fecha Semana {i + 1}</FormLabel>
                                          <FormControl>
                                              <Input type="date" {...field} value={field.value || ''} />
                                          </FormControl>
                                          <FormMessage />
                                      </FormItem>
                                  )}
                              />
                          ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-base mb-2 pt-4">Capacitación Práctica</h4>
                      <div className="space-y-4 pt-2">
                        {classFields.map((field, index) => (
                          <div key={field.id} className="space-y-4 rounded-lg border p-4 relative">
                            <div className="flex items-start justify-between mb-4">
                                <h4 className="font-medium pt-1">Clase Práctica #{index + 1}</h4>
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeClass(index)} className="absolute top-1 right-1">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    <span className="sr-only">Eliminar Clase</span>
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name={`deluxeDetails.classSchedules.${index}.date`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Fecha</FormLabel>
                                    <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                  control={form.control}
                                  name={`deluxeDetails.classSchedules.${index}.time`}
                                  render={({ field }) => (
                                      <FormItem>
                                          <FormLabel>Hora</FormLabel>
                                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                                              <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una hora" /></SelectTrigger></FormControl>
                                              <SelectContent>
                                                  {timeSlots.map(time => (<SelectItem key={time} value={time}>{time}</SelectItem>))}
                                              </SelectContent>
                                          </Select>
                                          <FormMessage />
                                      </FormItem>
                                  )}
                              />
                            </div>
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => appendClass({ date: '', time: '' })} className="mt-4">
                            <PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase Práctica
                        </Button>
                      </div>
                    </div>
                   </div>
                  
                  <div className="mt-6">
                      <h3 className="text-lg font-medium mb-2">Vista Previa del Contrato</h3>
                      <DeluxePremiumContractTemplatePreview 
                        folio={"CT-XXXX-XXXX"}
                        clientName={allFormValues.clientName} 
                        clientEmail={allFormValues.clientEmail} 
                        deluxeDetails={allFormValues.deluxeDetails as DeluxeContractDetails}
                        createdBy={role}
                      />
                  </div>
                </div>
            ) : (contractType !== 'Curso Auto' && contractType !== 'Curso Moto' && contractType !== 'Curso Mixto') && (
              <>
                 <FormField
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre del Cliente</FormLabel>
                            <FormControl>
                                <Input placeholder="ej., Innovate Corp" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="clientEmail"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email del Cliente</FormLabel>
                            <FormControl>
                                <Input placeholder="cliente@ejemplo.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contenido del Contrato</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe los términos del contrato..."
                          className="min-h-32"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </CardContent>
        </Card>

        {(contractType !== 'Curso Deluxe' && contractType !== 'Curso Auto' && contractType !== 'Curso Moto' && contractType !== 'Curso Mixto') && (
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Vencimientos y Reuniones</CardTitle>
              <CardDescription>
                Añade fechas importantes. Se enviarán recordatorios automáticos para cada vencimiento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                      <h4 className="font-medium">Vencimiento #{index + 1}</h4>
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Eliminar Vencimiento</span>
                      </Button>
                  </div>
                  <FormField
                    control={form.control}
                    name={`deadlines.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ej., Entrega del Primer Borrador" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`deadlines.${index}.date`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
              <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => append({ description: '', date: '' })}
                  >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Vencimiento
              </Button>
            </CardContent>
          </Card>
        )}
        
        <div className="flex justify-end">
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            Guardar e Imprimir
          </Button>
        </div>
      </form>
    </Form>
  );
}
