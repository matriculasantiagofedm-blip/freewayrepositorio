'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDb } from '@/firebase';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Receipt, ChevronLeft, Download, Filter, Camera } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function ContabilidadPage() {
  const db = useDb();
  
  // Consulta de gastos ordenados por fecha descendente
  const expensesQuery = useMemoQuery(() => (db ? query(collection(db, 'expenses'), orderBy('date', 'desc')) : null), [db]);
  const { data: expenses, isLoading } = useCollection<any>(expensesQuery);

  const totalGastos = expenses?.reduce((acc, current) => acc + (Number(current.amount) || 0), 0) || 0;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Combustible': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Alquiler': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Salarios': return 'bg-green-100 text-green-800 border-green-200';
      case 'Mantenimiento': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Insumos': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-white border rounded-xl shadow-sm gap-4 mt-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild><Link href="/dashboard"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Contabilidad</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Control de Gastos Operativos</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button asChild size="lg" className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest shadow-lg">
            <Link href="/contabilidad/nuevo">
              <Camera className="mr-2 h-5 w-5" /> Registrar Gasto
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 shadow-sm col-span-1 md:col-span-3 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-widest">Total Gastos Registrados</CardDescription>
            <CardTitle className="text-4xl font-black text-red-600">
              B/. {totalGastos.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 font-medium">Histórico general</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-500" /> Historial de Egresos
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-black uppercase text-[10px] tracking-wider text-slate-500 w-[100px]">Fecha</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-wider text-slate-500">Proveedor</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-wider text-slate-500">Concepto</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-wider text-slate-500">Categoría</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px] tracking-wider text-slate-500">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" />
                  </TableCell>
                </TableRow>
              ) : !expenses || expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Receipt className="h-8 w-8 mb-2 opacity-50" />
                      <p className="font-bold uppercase text-[11px] tracking-widest">No hay gastos registrados</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense) => (
                  <TableRow key={expense.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium text-xs">
                      {Intl.DateTimeFormat('es-PA', { dateStyle: 'short' }).format(toDate(expense.date))}
                    </TableCell>
                    <TableCell className="font-black uppercase text-sm">{expense.provider || 'N/A'}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{expense.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] uppercase font-black uppercase tracking-widest", getCategoryColor(expense.category))}>
                        {expense.category || 'Otros'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-black text-red-600 whitespace-nowrap">
                      - B/. {Number(expense.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
