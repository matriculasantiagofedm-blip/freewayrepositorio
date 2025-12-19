'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFormState } from 'react-dom';
import { State, createContract } from '@/lib/actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Separator } from './ui/separator';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const contractFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long.'),
  clientEmail: z.string().email('Please enter a valid email address.'),
  content: z.string().min(10, 'Contract content must be at least 10 characters long.'),
  deadlines: z.array(
    z.object({
      description: z.string().min(3, 'Deadline description is required.'),
      date: z.date({ required_error: 'A date is required.' }),
    })
  ).optional(),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

export function ContractForm() {
  const initialState: State = { message: null, errors: {} };
  const [state, dispatch] = useFormState(createContract, initialState);
  const { toast } = useToast();

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      title: '',
      clientEmail: '',
      content: '',
      deadlines: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'deadlines',
  });

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
            <CardTitle className="font-headline">Contract Details</CardTitle>
            <CardDescription>
              Fill out the main details of your agreement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Q4 Marketing Services" {...field} />
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
                  <FormLabel>Client Email</FormLabel>
                  <FormControl>
                    <Input placeholder="client@example.com" {...field} />
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
                  <FormLabel>Contract Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the terms of the contract..."
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Deadlines & Meetings</CardTitle>
            <CardDescription>
              Add important dates. Automated reminders will be sent for each deadline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-4 rounded-lg border p-4">
                <div className="flex items-start justify-between">
                    <h4 className="font-medium">Deadline #{index + 1}</h4>
                    <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Remove Deadline</span>
                    </Button>
                </div>
                <FormField
                  control={form.control}
                  name={`deadlines.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} name="deadline.description" placeholder="e.g., First Draft Due" />
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
                      <FormLabel>Date</FormLabel>
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
                              {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
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
                Add Deadline
            </Button>
          </CardContent>
        </Card>
        
        {state.errors?._form && (
            <p className="text-sm font-medium text-destructive">
                {state.errors._form.join(', ')}
            </p>
        )}

        <div className="flex justify-end">
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            Create Contract
          </Button>
        </div>
      </form>
    </Form>
  );
}
