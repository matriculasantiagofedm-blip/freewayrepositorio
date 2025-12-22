'use client';

import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  setDoc,
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
import type { Client, DeluxeContractDetails } from '@/lib/types';


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
    vehicleTransmission: z.enum(['Automático', 'Manual']).optional(),
    licenseCategory: z.enum(['A, C', 'A, C, D']).optional(),
    theoreticalClassSchedule: z.enum(['Lunes', 'Miércoles']).optional(),
    theoreticalClasses: z.array(z.string().optional()).optional(),
    classSchedules: z.array(z.object({
      date: z.string().optional(),
      time: z.string().optional(),
    })).optional(),
    paymentDetails: z.string().optional(),
    paymentInstallments: z.array(z.string().optional()).optional(),
    paymentAmount: z.number().optional(),
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
  const timeSlots = generateTimeSlots();

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      title: '',
      clientName: '',
      clientEmail: '',
      content: '',
      type: undefined,
      deadlines: [],
      deluxeDetails: {
        studentIdNumber: '',
        studentAddress: '',
        studentPhone1: '',
        studentPhone2: '',
        vehicleTransmission: undefined,
        licenseCategory: undefined,
        theoreticalClassSchedule: undefined,
        theoreticalClasses: Array(10).fill(''),
        classSchedules: [{ date: '', time: '' }],
        paymentDetails: '',
        paymentInstallments: Array(6).fill(''),
        paymentAmount: 33.50,
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

  useEffect(() => {
    if (contractType) {
        form.setValue('title', `Contrato de ${contractType}`);
    } else {
        form.setValue('title', '');
    }
  }, [contractType, form]);

  async function findOrCreateClient(clientName: string, clientEmail: string, userId: string): Promise<string> {
    const clientsRef = collection(firestore, 'clients');
    const q = query(clientsRef, where("email", "==", clientEmail), where("userId", "==", userId));
    
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        return querySnapshot.docs[0].id;
    } else {
        const newClientRef = doc(collection(firestore, 'clients'));
        const newClient: Omit<Client, 'id'> = {
            name: clientName,
            email: clientEmail,
            userId: userId,
            createdAt: serverTimestamp() as any
        };
        await setDoc(newClientRef, newClient);
        return newClientRef.id;
    }
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
      const clientId = await findOrCreateClient(data.clientName, data.clientEmail, user.uid);
      
      const contractsCollection = collection(firestore, 'clients', user.uid, 'contracts');
      
      const contractContent = data.type === 'Curso Deluxe' ? '' : data.content;

      const newContractData: any = {
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
      };

      if (data.type === 'Curso Deluxe' && data.deluxeDetails) {
          newContractData.deluxeDetails = {
            ...data.deluxeDetails,
            classSchedules: data.deluxeDetails.classSchedules?.map(cs => ({...cs, date: cs.date ? new Date(cs.date) : new Date() }))
          };
      }

      const newContractRef = await addDoc(contractsCollection, newContractData);
      const contractId = newContractRef.id;

      await setDoc(doc(firestore, 'clients', clientId), { id: clientId, name: data.clientName, email: data.clientEmail, userId: user.uid }, { merge: true });


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
        title: '¡Contrato Creado!',
        description: `El contrato "${data.title}" ha sido creado exitosamente.`,
      });

      router.push('/dashboard');

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
              Completa los detalles principales de tu acuerdo. Se creará un nuevo cliente si el email no existe.
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
            {contractType === 'Curso Deluxe' ? (
                <div className="space-y-6 pt-4">

                  {/* DATOS DEL ESTUDIANTE */}
                  <div className="space-y-4">
                     <h3 className="text-lg font-medium text-primary border-b pb-2">Datos del Estudiante</h3>
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
                    <FormField
                      control={form.control}
                      name="deluxeDetails.paymentDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Detalles Adicionales del Pago</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Describe los detalles del pago..." {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div>
                      <FormLabel>Plan de Pagos</FormLabel>
                      <p className="text-sm text-muted-foreground">
                          Seleccione el plan. El pago se realizará en 6 cuotas con fechas de pago establecidas cada dos semanas.
                      </p>
                      <FormField
                          control={form.control}
                          name="deluxeDetails.paymentAmount"
                          render={({ field }) => (
                              <FormItem className="pt-2">
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
                                          <FormLabel htmlFor="amount-45" className="font-normal">Deluxe 16 Hrs (B/.45.00)</FormLabel>
                                      </FormItem>
                                      <FormItem className="flex items-center space-x-2">
                                          <FormControl>
                                              <RadioGroupItem value="33.50" id="amount-33" />
                                          </FormControl>
                                          <FormLabel htmlFor="amount-33" className="font-normal">Deluxe 12 Hrs (B/.33.50)</FormLabel>
                                      </FormItem>
                                  </RadioGroup>
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                          />
                      <div className="space-y-4 pt-4">
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
                        clientName={allFormValues.clientName} 
                        clientEmail={allFormValues.clientEmail} 
                        deluxeDetails={allFormValues.deluxeDetails as DeluxeContractDetails}
                      />
                  </div>
                </div>
            ) : (
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
            )}
          </CardContent>
        </Card>

        {contractType !== 'Curso Deluxe' && (
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
            Crear Contrato
          </Button>
        </div>
      </form>
    </Form>
  );
}
