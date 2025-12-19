'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { State, createContract } from '@/lib/actions';
import { useActionState, useEffect } from 'react';

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
import { CalendarIcon, PlusCircle, Save, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { DeluxePremiumContractPreview } from './deluxe-premium-contract-preview';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const contractFormSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres.'),
  clientName: z.string().min(3, 'El nombre del cliente debe tener al menos 3 caracteres.'),
  clientEmail: z.string().email('Por favor, introduce una dirección de correo electrónico válida.'),
  content: z.string().optional(),
  type: z.enum([
    'Curso Auto', 
    'Curso Moto', 
    'Curso Auto Básico', 
    'Curso Auto Plus', 
    'Curso Auto Premium', 
    'Curso Auto Deluxe',
    'Curso Moto Básico',
    'Curso Moto Plus',
    'Curso Moto Premium'
  ], { required_error: 'Debes seleccionar un tipo de contrato.'}),
  deadlines: z.array(
    z.object({
      description: z.string().min(3, 'La descripción del plazo es obligatoria.'),
      date: z.date({ required_error: 'Se requiere una fecha.' }),
    })
  ).optional(),
  deluxeDetails: z.object({
    studentIdNumber: z.string().optional(),
    studentAddress: z.string().optional(),
    studentPhone1: z.string().optional(),
    studentPhone2: z.string().optional(),
    vehicleTransmission: z.enum(['Automático', 'Manual']).optional(),
    licenseCategory: z.enum(['A, C', 'A, C, D']).optional(),
    classSchedules: z.array(z.object({
      date: z.date().optional(),
      time: z.string().optional(),
    })).optional(),
    paymentDetails: z.string().optional(),
  }).optional(),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

export function ContractForm() {
  const initialState: State = { message: null, errors: {} };
  const [state, dispatch] = useActionState(createContract, initialState);
  const { toast } = useToast();

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      title: 'Contrato de Curso de Manejo',
      clientName: '',
      clientEmail: '',
      deadlines: [],
      deluxeDetails: {
        classSchedules: [{ date: undefined, time: '' }],
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
  const clientName = form.watch('clientName');
  const clientEmail = form.watch('clientEmail');
  const deluxeDetails = form.watch('deluxeDetails');


  useEffect(() => {
    if (state.message) {
      if (state.errors) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: state.message,
        });
      }
    }
  }, [state, toast]);

  return (
    <Form {...form}>
      <form action={dispatch} className="space-y-8">
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título del Contrato</FormLabel>
                  <FormControl>
                    <Input placeholder="ej., Servicios de Marketing Q4" {...field} />
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
                      <SelectItem value="Curso Auto Básico">Curso Auto - Básico</SelectItem>
                      <SelectItem value="Curso Auto Plus">Curso Auto - Plus</SelectItem>
                      <SelectItem value="Curso Auto Premium">Curso Auto - Premium</SelectItem>
                      <SelectItem value="Curso Auto Deluxe">Curso Auto - Deluxe</SelectItem>
                      <SelectItem value="Curso Moto">Curso Moto</SelectItem>
                      <SelectItem value="Curso Moto Básico">Curso Moto - Básico</SelectItem>
                      <SelectItem value="Curso Moto Plus">Curso Moto - Plus</SelectItem>
                      <SelectItem value="Curso Moto Premium">Curso Moto - Premium</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {contractType === 'Curso Auto Deluxe' ? (
                <div className="space-y-6 pt-4">
                  <FormField
                    control={form.control}
                    name="deluxeDetails.studentIdNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cédula/Pasaporte del Estudiante</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="deluxeDetails.studentAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Domicilio del Estudiante</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
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
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="deluxeDetails.studentPhone2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono 2</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="deluxeDetails.vehicleTransmission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transmisión del Vehículo</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex gap-4"
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="Automático" id="auto" />
                              </FormControl>
                              <FormLabel htmlFor="auto" className="font-normal">Automático</FormLabel>
                            </FormItem>
                             <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="Manual" id="manual" />
                              </FormControl>
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
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex gap-4"
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="A, C" id="ac" />
                              </FormControl>
                              <FormLabel htmlFor="ac" className="font-normal">A, C</FormLabel>
                            </FormItem>
                             <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="A, C, D" id="acd" />
                              </FormControl>
                              <FormLabel htmlFor="acd" className="font-normal">A, C, D</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                     <FormLabel>Horario de Capacitación</FormLabel>
                     <div className="space-y-4 pt-2">
                      {classFields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-3 gap-2 items-center">
                           <FormField
                            control={form.control}
                            name={`deluxeDetails.classSchedules.${index}.date`}
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant={'outline'}
                                        className={cn(
                                          'w-full justify-start text-left font-normal',
                                          !field.value && 'text-muted-foreground'
                                        )}
                                      >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Clase #{index + 1}</span>}
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={es} />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`deluxeDetails.classSchedules.${index}.time`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input type="time" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                           <Button variant="ghost" size="icon" onClick={() => removeClass(index)} className="col-start-4">
                              <Trash2 className="h-4 w-4 text-destructive" />
                           </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => appendClass({ date: undefined, time: '' })}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase
                      </Button>
                     </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="deluxeDetails.paymentDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor, Matrícula y Forma de Pago</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe los detalles del pago..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="mt-6">
                      <h3 className="text-lg font-medium mb-2">Vista Previa del Contrato</h3>
                      <DeluxePremiumContractPreview 
                        clientName={clientName} 
                        clientEmail={clientEmail} 
                        deluxeDetails={deluxeDetails} 
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {contractType !== 'Curso Auto Deluxe' && (
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
                      <Button variant="ghost" size="icon" onClick={() => remove(index)}>
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
                          <Input {...field} name="deadline.description" placeholder="ej., Entrega del Primer Borrador" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`deadlines.${index}.date`}
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha</FormLabel>
                          <input type="hidden" name="deadline.date" value={field.value?.toISOString() ?? ''} />
                          <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={'outline'}
                                className={cn(
                                  'w-full justify-start text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                              locale={es}
                            />
                          </PopoverContent>
                        </Popover>
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
                  onClick={() => append({ description: '', date: new Date() })}
                  >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Vencimiento
              </Button>
            </CardContent>
          </Card>
        )}
        
        {state.errors?._form && (
            <p className="text-sm font-medium text-destructive">
                {state.errors._form.join(', ')}
            </p>
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
