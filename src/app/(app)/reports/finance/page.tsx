'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CalendarIcon, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Contract, Payment, BookSalePayment } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ReportRow {
  concept: string;
  transactions: number;
  total: number;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export default function FinanceReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [view, setView] = useState('daily');
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db || !user) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      const start = view === 'daily' ? startOfDay(reportDate) : startOfMonth(reportDate);
      const end = view === 'daily' ? endOfDay(reportDate) : endOfMonth(reportDate);

      const contractQuery = query(
        collection(db, 'contracts'),
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<=', Timestamp.fromDate(end))
      );
      const cancellationQuery = query(
        collection(db, 'cancellation_payments'),
        where('paymentDate', '>=', Timestamp.fromDate(start)),
        where('paymentDate', '<=', Timestamp.fromDate(end))
      );
      const updateQuery = query(
        collection(db, 'update_payments'),
        where('paymentDate', '>=', Timestamp.fromDate(start)),
        where('paymentDate', '<=', Timestamp.fromDate(end))
      );
      const bookSaleQuery = query(
        collection(db, 'book_sale_payments'),
        where('paymentDate', '>=', Timestamp.fromDate(start)),
        where('paymentDate', '<=', Timestamp.fromDate(end))
      );

      try {
        const [
          contractsSnap,
          cancellationsSnap,
          updatesSnap,
          bookSalesSnap,
        ] = await Promise.all([
          getDocs(contractQuery),
          getDocs(cancellationQuery),
          getDocs(updateQuery),
          getDocs(bookSaleQuery),
        ]);

        const aggregated: { [key: string]: { transactions: number; total: number } } = {};

        // Helper to aggregate data
        const aggregate = (concept: string, amount: number) => {
          if (!aggregated[concept]) {
            aggregated[concept] = { transactions: 0, total: 0 };
          }
          aggregated[concept].transactions += 1;
          aggregated[concept].total += amount;
        };

        // 1. Contract down payments
        contractsSnap.forEach((doc) => {
          const contract = doc.data() as Contract;
          if (contract.status === 'expired') return;

          if (contract.type === 'Curso Deluxe') {
            // Matrícula for Deluxe
            aggregate('Matrícula Deluxe', 15.00);
          } else {
            const details = contract.autoMotoDetails || contract.ampliacionesDetails;
            if (details && details.downPayment && details.downPayment > 0) {
              const concept = `Abono - ${contract.type}`;
              aggregate(concept, details.downPayment);
            }
          }
        });

        // 2. Cancellation/Balance payments
        cancellationsSnap.forEach((doc) => {
          const payment = doc.data() as Payment;
          aggregate('Abono/Cancelación de Saldo', payment.amount);
        });

        // 3. Update payments
        updatesSnap.forEach((doc) => {
          const payment = doc.data() as Payment;
          aggregate('Actualización de Certificado', payment.amount);
        });

        // 4. Book sale payments
        bookSalesSnap.forEach((doc) => {
          const payment = doc.data() as BookSalePayment;
          aggregate('Venta de Libros', payment.amount);
        });

        const finalReport = Object.entries(aggregated).map(([concept, data]) => ({
          concept,
          ...data,
        })).sort((a, b) => b.total - a.total); // Sort by total amount

        setReportData(finalReport);
      } catch (error) {
        console.error("Error fetching financial data:", error);
        // Here you would normally use a toast notification
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [db, user, reportDate, view]);

  const totalIncome = useMemo(() => {
    return reportData.reduce((sum, row) => sum + row.total, 0);
  }, [reportData]);

  const chartData = useMemo(() => {
    return reportData.map(item => ({
      name: item.concept,
      Ingresos: item.total
    }));
  }, [reportData]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Banknote className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-headline text-3xl font-bold">Reporte Financiero</h1>
            <p className="text-muted-foreground">Desglose de ingresos por concepto y período.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs defaultValue="daily" onValueChange={setView} className="w-[200px]">
              <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="daily">Diario</TabsTrigger>
                  <TabsTrigger value="monthly">Mensual</TabsTrigger>
              </TabsList>
           </Tabs>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn("w-[280px] justify-start text-left font-normal", !reportDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {reportDate ? format(reportDate, view === 'daily' ? "PPP" : "LLLL yyyy", { locale: es }) : <span>Seleccionar fecha</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={reportDate}
                onSelect={(date) => setReportDate(date || new Date())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Generando reporte...</p>
        </div>
      ) : reportData.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
            <h3 className="mt-4 text-lg font-semibold text-foreground">
                No se encontraron ingresos
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
                No se registraron transacciones para el período seleccionado.
            </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>Desglose de Ingresos</CardTitle>
                    <CardDescription>
                        Total de ingresos para {view === 'daily' ? `el día ${format(reportDate, 'PPP', { locale: es })}` : `el mes de ${format(reportDate, 'LLLL yyyy', { locale: es })}`}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Concepto</TableHead>
                                <TableHead className="text-center"># Transacciones</TableHead>
                                <TableHead className="text-right">Total Ingresado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map((row) => (
                                <TableRow key={row.concept}>
                                    <TableCell className="font-medium">{row.concept}</TableCell>
                                    <TableCell className="text-center">{row.transactions}</TableCell>
                                    <TableCell className="text-right">{currencyFormatter.format(row.total)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold text-base">
                                <TableCell colSpan={2}>Total General</TableCell>
                                <TableCell className="text-right">{currencyFormatter.format(totalIncome)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Gráfico de Ingresos</CardTitle>
                     <CardDescription>
                        Distribución de ingresos por concepto.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                     <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(value) => currencyFormatter.format(value as number)} />
                            <YAxis dataKey="name" type="category" width={150} interval={0} tick={{ fontSize: 12 }}/>
                            <Tooltip formatter={(value) => currencyFormatter.format(value as number)} />
                            <Legend />
                            <Bar dataKey="Ingresos" fill="#8884d8" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}
