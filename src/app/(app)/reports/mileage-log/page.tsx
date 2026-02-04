
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import type { MileageLog } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarIcon, ChevronsUpDown } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function MileageLogReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [reportDate, setReportDate] = useState<Date | null>(null);

  const logsQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    
    let q = query(
        collection(db, 'mileage_logs'),
        orderBy('date', 'desc')
    );

    if (reportDate) {
        const start = startOfDay(reportDate);
        const end = endOfDay(reportDate);
        q = query(q, where('date', '>=', Timestamp.fromDate(start)), where('date', '<=', Timestamp.fromDate(end)));
    }

    return q;
  }, [db, user, reportDate]);

  const { data: logs, isLoading } = useCollection<MileageLog>(logsQuery);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Cargando registros...</p>
        </div>
      );
    }
    
    if (!logs || logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                    No se encontraron registros
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    {reportDate ? "No hay registros para la fecha seleccionada." : "No se han guardado registros de kilometraje todavía."}
                </p>
            </div>
        );
    }

    return (
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Recorrido Total</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
            {logs.map((log) => {
              const logDate = toDate(log.date);
              return (
                <Collapsible asChild key={log.id}>
                  <tbody>
                  <TableRow>
                    <TableCell className="font-medium">
                      {!isNaN(logDate.getTime()) ? format(logDate, 'PPP', { locale: es }) : 'Fecha inválida'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {(log.totalDistance || 0).toFixed(1)} km
                    </TableCell>
                    <TableCell className="text-right">
                      <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                              Ver Detalle
                              <ChevronsUpDown className="h-4 w-4 ml-2" />
                          </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                      <tr>
                          <td colSpan={3} className="p-0">
                              <div className="p-4 bg-muted/50">
                                  <h4 className="font-semibold mb-2">Detalle por Vehículo</h4>
                                  <Table>
                                      <TableHeader>
                                          <TableRow>
                                              <TableHead>Vehículo</TableHead>
                                              <TableHead>Km. Inicial</TableHead>
                                              <TableHead>Km. Final</TableHead>
                                              <TableHead className="text-right">Recorrido</TableHead>
                                          </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {log.cars.map(car => (
                                              <TableRow key={car.name}>
                                                  <TableCell>{car.name}</TableCell>
                                                  <TableCell>{car.initialMileage}</TableCell>
                                                  <TableCell>{car.finalMileage}</TableCell>
                                                  <TableCell className="text-right">{car.distance.toFixed(1)} km</TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              </div>
                          </td>
                      </tr>
                  </CollapsibleContent>
                  </tbody>
                </Collapsible>
              );
            })}
        </Table>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold">Reporte de Kilometraje</h1>
        <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !reportDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reportDate ? format(reportDate, "PPP", { locale: es }) : <span>Filtrar por fecha...</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={reportDate}
                  onSelect={setReportDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {reportDate && <Button variant="ghost" onClick={() => setReportDate(null)}>Limpiar filtro</Button>}
        </div>
      </div>
      {renderContent()}
    </div>
  );
}

    