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
import { Loader2, CalendarIcon, Banknote, Users } from 'lucide-react';
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

interface PaymentTypeRow {
  paymentType: string;
  transactions: number;
  total: number;
}

interface RoleRow {
  role: string;
  transactions: number;
  total: number;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const paymentTypeLabels: { [key: string]: string } = {
    cash: 'Efectivo',
    debit: 'T.Débito',
    credit: 'T.Crédito',
    bac: 'BAC',
    general: 'General',
    cheques: 'Cheques',
    desconocido: 'Desconocido'
};

export default function FinanceReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [view, setView] = useState('daily');
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [paymentTypeData, setPaymentTypeData] = useState<PaymentTypeRow[]>([]);
  const [roleData, setRoleData] = useState<RoleRow[]>([]);
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
        const paymentTypeAggregated: { [key: string]: { transactions: number; total: number } } = {};
        const roleAggregated: { [key: string]: { transactions: number; total: number } } = {};

        // Helper to aggregate data by concept
        const aggregate = (concept: string, amount: number) => {
          if (!aggregated[concept]) {
            aggregated[concept] = { transactions: 0, total: 0 };
          }
          aggregated[concept].transactions += 1;
          aggregated[concept].total += amount;
        };
        
        // Helper to aggregate data by payment type
        const aggregateByPaymentType = (paymentType: string, amount: number) => {
          if (!paymentTypeAggregated[paymentType]) {
            paymentTypeAggregated[paymentType] = { transactions: 0, total: 0 };
          }
          paymentTypeAggregated[paymentType].transactions += 1;
          paymentTypeAggregated[paymentType].total += amount;
        };

        // Helper to aggregate data by role (SALES VOLUME)
        const aggregateByRole = (role: string | undefined, amount: number) => {
          const roleName = role || 'Sin Asignar';
          if (!roleAggregated[roleName]) {
            roleAggregated[roleName] = { transactions: 0, total: 0 };
          }
          roleAggregated[roleName].transactions += 1;
          roleAggregated[roleName].total += amount;
        };

        // 1. Contract Processing
        contractsSnap.forEach((doc) => {
          const contract = doc.data() as Contract;
          if (contract.status === 'expired') return;

          const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
          
          let amountCollected = 0;
          let totalSaleValue = details?.courseValue || 0;
          let paymentType = 'desconocido';
          let concept = '';

          if (contract.type === 'Curso Deluxe') {
            concept = 'Matrícula Deluxe';
            amountCollected = 15.00;
            paymentType = contract.deluxeDetails?.paymentType || 'cash';
          } else {
            if (details) {
              concept = `Abono - ${contract.type}`;
              amountCollected = details.downPayment || 0;
              paymentType = (details as any).paymentType || 'cash';
            }
          }

          // Para el reporte de ingresos (recaudación efectiva)
          if (amountCollected > 0) {
            aggregate(concept, amountCollected);
            aggregateByPaymentType(paymentType, amountCollected);
          }
          
          // Para el reporte de ventas por rol (valor total del contrato)
          if (totalSaleValue > 0) {
            aggregateByRole(contract.createdBy, totalSaleValue);
          }
        });

        // 2. Cancellation/Balance payments
        cancellationsSnap.forEach((doc) => {
          const payment = doc.data() as Payment;
          // Contabilizar como ingreso
          aggregate('Abono/Cancelación de Saldo', payment.amount);
          aggregateByPaymentType(payment.paymentType || 'cash', payment.amount);
          
          // No sumamos a las ventas por rol para evitar duplicidad, 
          // ya que el contrato ya se contó al 100% en el paso 1.
        });

        // 3. Update payments
        updatesSnap.forEach((doc) => {
          const payment = doc.data() as Payment;
          aggregate('Actualización de Certificado', payment.amount);
          aggregateByPaymentType(payment.paymentType || 'cash', payment.amount);
          // Estas son ventas individuales, sí se cuentan para el rol
          aggregateByRole(payment.createdBy, payment.amount);
        });

        // 4. Book sale payments
        bookSalesSnap.forEach((doc) => {
          const payment = doc.data() as BookSalePayment;
          aggregate('Venta de Libros', payment.amount);
          aggregateByPaymentType(payment.paymentType || 'cash', payment.amount);
          // Estas son ventas individuales, sí se cuentan para el rol
          aggregateByRole(payment.createdBy, payment.amount);
        });

        const finalReport = Object.entries(aggregated).map(([concept, data]) => ({
          concept,
          ...data,
        })).sort((a, b) => b.total - a.total);

        const finalPaymentTypeReport = Object.entries(paymentTypeAggregated).map(([type, data]) => ({
          paymentType: type,
          ...data,
        })).sort((a, b) => b.total - a.total);

        const finalRoleReport = Object.entries(roleAggregated).map(([role, data]) => ({
          role,
          ...data,
        })).sort((a, b) => b.total - a.total);

        setReportData(finalReport);
        setPaymentTypeData(finalPaymentTypeReport);
        setRoleData(finalRoleReport);

      } catch (error) {
        console.error("Error fetching financial data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [db, user, reportDate, view]);

  const totalIncome = useMemo(() => {
    return reportData.reduce((sum, row) => sum + row.total, 0);
  }, [reportData]);

  const totalRoleSalesValue = useMemo(() => {
    return roleData.reduce((sum, row) => sum + row.total, 0);
  }, [roleData]);

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
            <p className="text-muted-foreground">Desglose de ingresos recaudados y volumen de ventas.</p>
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
                No se encontraron datos
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
                No se registraron transacciones para el período seleccionado.
            </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col gap-8">
                
                {/* Desglose por Rol (VALOR TOTAL DE VENTAS) */}
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            <CardTitle>Ventas por Rol de Usuario (Valor Total)</CardTitle>
                        </div>
                        <CardDescription>Monto total de los contratos y servicios vendidos (No abonos).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Rol de Usuario</TableHead>
                                    <TableHead className="text-center"># Transacciones</TableHead>
                                    <TableHead className="text-right">Monto de Venta</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roleData.map((row) => (
                                    <TableRow key={row.role}>
                                        <TableCell className="font-bold text-primary">{row.role}</TableCell>
                                        <TableCell className="text-center">{row.transactions}</TableCell>
                                        <TableCell className="text-right font-semibold">{currencyFormatter.format(row.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="font-bold text-base bg-transparent">
                                    <TableCell colSpan={2}>Volumen Total de Ventas</TableCell>
                                    <TableCell className="text-right">{currencyFormatter.format(totalRoleSalesValue)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                {/* Desglose por Concepto (RECAUDACIÓN) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Ingresos Reales Recaudados</CardTitle>
                        <CardDescription>
                            Dinero efectivamente ingresado (Abonos + Pagos de Saldo).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Concepto</TableHead>
                                    <TableHead className="text-center"># Transacciones</TableHead>
                                    <TableHead className="text-right">Monto Cobrado</TableHead>
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
                                    <TableCell colSpan={2}>Total Recaudado en Caja</TableCell>
                                    <TableCell className="text-right">{currencyFormatter.format(totalIncome)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
                
                {/* Desglose por Tipo de Pago */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recaudación por Método de Pago</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tipo de Pago</TableHead>
                                    <TableHead className="text-center"># Transacciones</TableHead>
                                    <TableHead className="text-right">Monto Recibido</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paymentTypeData.map((row) => (
                                    <TableRow key={row.paymentType}>
                                        <TableCell className="font-medium">{paymentTypeLabels[row.paymentType] || row.paymentType}</TableCell>
                                        <TableCell className="text-center">{row.transactions}</TableCell>
                                        <TableCell className="text-right">{currencyFormatter.format(row.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="font-bold text-base">
                                    <TableCell colSpan={2}>Total Recaudado</TableCell>
                                    <TableCell className="text-right">{currencyFormatter.format(totalIncome)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle>Gráfico de Recaudación</CardTitle>
                     <CardDescription>
                        Distribución de dinero ingresado por concepto.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                     <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(value) => currencyFormatter.format(value as number)} />
                            <YAxis dataKey="name" type="category" width={150} interval={0} tick={{ fontSize: 12 }}/>
                            <Tooltip formatter={(value) => currencyFormatter.format(value as number)} />
                            <Legend />
                            <Bar dataKey="Ingresos" fill="#8884d8" name="Monto Recaudado" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}
