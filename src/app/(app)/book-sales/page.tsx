'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { BookSalePayment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Printer, PlusCircle, BookOpen, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCurrentRole } from '@/hooks/use-current-role';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const books = [
    { id: 'compendio', title: 'Compendio de Conocimientos Viales', price: 5.00 },
    { id: 'guia', title: 'Guía Integral de Seguridad Vial', price: 15.00 },
];

const paymentMethodOptions = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'debit', label: 'Tarjeta Débito' },
    { value: 'credit', label: 'Tarjeta Crédito' },
    { value: 'bac', label: 'BAC' },
    { value: 'general', label: 'General' },
    { value: 'cheques', label: 'Cheque' },
];

export default function BookSalesPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const { role } = useCurrentRole();

  const [clientName, setClientName] = useState('');
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedBook, setSelectedBook] = useState<(typeof books)[0] | null>(null);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [savedPaymentData, setSavedPaymentData] = useState<Partial<BookSalePayment> | null>(null);
  
  const today = new Date();

  const resetFormState = () => {
    setClientName('');
    setStudentIdNumber('');
    setPaymentType('cash');
    setSelectedBook(null);
    setPaymentSaved(false);
    setSavedPaymentData(null);
    setIsSaving(false);
  };

  const handleSaveSale = async () => {
    if (!db || !user || !selectedBook) {
      toast({ variant: 'destructive', title: 'Datos Incompletos', description: 'Selecciona un libro.' });
      return;
    }
    if (!clientName || !studentIdNumber) {
      toast({ variant: 'destructive', title: 'Datos Incompletos', description: 'Completa el nombre y la cédula del cliente.' });
      return;
    }

    setIsSaving(true);
    try {
      const paymentDataToSave: Partial<BookSalePayment> = {};

      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'book_sale_folio');
        const counterDoc = await transaction.get(counterRef);
        
        let newBookSaleFolio;
        if (!counterDoc.exists()) {
          newBookSaleFolio = 1;
          transaction.set(counterRef, { count: newBookSaleFolio });
        } else {
          newBookSaleFolio = counterDoc.data().count + 1;
          transaction.update(counterRef, { count: newBookSaleFolio });
        }

        const paymentRef = doc(collection(db, 'book_sale_payments'));
        const paymentData = {
          amount: selectedBook.price,
          bookSaleFolio: newBookSaleFolio,
          bookTitle: selectedBook.title,
          clientName: clientName,
          studentIdNumber: studentIdNumber,
          paymentDate: serverTimestamp() as any,
          paymentType: paymentType,
          userId: user.uid,
          createdBy: role || undefined,
        };
        transaction.set(paymentRef, paymentData);

        Object.assign(paymentDataToSave, { ...paymentData, id: paymentRef.id, paymentDate: new Date() as any });
      });

      setSavedPaymentData(paymentDataToSave);
      toast({ title: 'Venta Registrada', description: `El pago de B/.${selectedBook.price.toFixed(2)} ha sido guardado.` });
      setPaymentSaved(true);

    } catch (error: any) {
      console.error("Error saving book sale:", error);
      toast({ variant: 'destructive', title: 'Error al Guardar', description: error.message || 'No se pudo registrar la venta. Inténtalo de nuevo.' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handlePrint = () => {
    if (!savedPaymentData || !selectedBook) return;
    
    const queryParams = new URLSearchParams({
        folio: String(savedPaymentData.bookSaleFolio).padStart(6, '0'),
        date: format(new Date(), 'PPP', { locale: es }),
        name: savedPaymentData.clientName || '',
        idNumber: savedPaymentData.studentIdNumber || '',
        address: '-',
        concept: `Venta de libro: ${selectedBook.title}`,
        amount: String(selectedBook.price.toFixed(2)),
    });

    const printUrl = `/print-receipt?${queryParams.toString()}`;
    window.open(printUrl, '_blank');
  };

  return (
    <div className="flex flex-col gap-8">
        <div className="flex flex-col">
          <h1 className="font-headline text-3xl font-bold">Venta de Libros</h1>
          <p className="text-muted-foreground">
            {format(today, "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>

        <Card className="animate-in fade-in-50 max-w-2xl mx-auto w-full shadow-md">
            <CardHeader>
                <CardTitle>Registrar Venta</CardTitle>
                <CardDescription>
                  Completa los datos del cliente y selecciona el libro vendido.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                   <div className="space-y-2">
                      <Label htmlFor="client-name" className="text-xs uppercase font-bold text-muted-foreground">Nombre del Cliente</Label>
                      <Input id="client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Introducir nombre" disabled={paymentSaved}/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student-id" className="text-xs uppercase font-bold text-muted-foreground">Cédula / Pasaporte</Label>
                      <Input id="student-id" value={studentIdNumber} onChange={(e) => setStudentIdNumber(e.target.value)} placeholder="Introducir cédula" disabled={paymentSaved} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Método de Pago</Label>
                    <Select 
                        onValueChange={setPaymentType} 
                        value={paymentType}
                        disabled={paymentSaved}
                    >
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder="Seleccionar método..." />
                        </SelectTrigger>
                        <SelectContent>
                            {paymentMethodOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Seleccionar Libro</Label>
                    <RadioGroup 
                        onValueChange={(value) => {
                            const book = books.find(b => b.id === value);
                            setSelectedBook(book || null);
                        }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        value={selectedBook?.id}
                        disabled={paymentSaved}
                    >
                        {books.map(book => (
                            <Label key={book.id} htmlFor={book.id} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                <RadioGroupItem value={book.id} id={book.id} className="sr-only" />
                                <BookOpen className="mb-3 h-6 w-6" />
                                <span className="text-base font-semibold text-center">{book.title}</span>
                                <span className="text-2xl font-bold mt-2">B/.{book.price.toFixed(2)}</span>
                            </Label>
                        ))}
                    </RadioGroup>
                </div>
            </CardContent>
            <CardFooter>
                {!paymentSaved ? (
                    <Button onClick={handleSaveSale} className="w-full md:w-auto h-11 px-8" disabled={isSaving || !selectedBook || !clientName || !studentIdNumber}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Registrar Venta
                    </Button>
                ) : (
                    <div className='flex flex-col sm:flex-row gap-2 w-full'>
                        <Button variant="outline" onClick={handlePrint} className="h-11 flex-1">
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir Recibo N° {String(savedPaymentData?.bookSaleFolio).padStart(6, '0')}
                        </Button>
                        <Button onClick={resetFormState} className="h-11 flex-1">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Nueva Venta
                        </Button>
                    </div>
                )}
            </CardFooter>
        </Card>
    </div>
  );
}
