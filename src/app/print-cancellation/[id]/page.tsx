
'use client';

import { useParams } from 'next/navigation';
import { doc, Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { Contract } from '@/lib/types';
import { useDb, useUser } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { GanttChartSquare, ShieldCheck } from 'lucide-react';

function CancellationReceipt({ contract }: { contract: Contract }) {
    const cancellationDate = new Date();
    
    const getBalance = (c: Contract): number => {
        if (c.autoMotoDetails) return c.autoMotoDetails.balance || 0;
        if (c.deluxeDetails) return 0;
        if (c.ampliacionesDetails) return c.ampliacionesDetails.balance || 0;
        return 0;
    };

    const getStudentIdNumber = (c: Contract): string => {
        if (c.autoMotoDetails) return c.autoMotoDetails.studentIdNumber || '';
        if (c.deluxeDetails) return c.deluxeDetails.studentIdNumber || '';
        if (c.ampliacionesDetails) return c.ampliacionesDetails.studentIdNumber || '';
        return '';
    };

  return (
    <div className="w-full max-w-2xl mx-auto p-8 font-sans">
      <Card>
        <CardHeader className="text-center">
            <div className="flex flex-col items-center">
                <GanttChartSquare className="h-12 w-12 text-primary mb-2" />
                <h1 className="font-headline text-3xl font-bold">ContractTime</h1>
                <p className="text-lg text-muted-foreground">Freeway Escuela de Manejo, S.A.</p>
            </div>
            <CardTitle className="text-2xl font-bold pt-6">Comprobante de Anulación</CardTitle>
            <CardDescription>{format(cancellationDate, "d 'de' MMMM 'de' yyyy, h:mm a", { locale: es })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-center justify-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
                <ShieldCheck className="h-5 w-5" />
                <p className="font-semibold text-center">CONTRATO ANULADO OFICIALMENTE</p>
            </div>

            <div className="border-t border-b py-4 space-y-3">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">N° de Contrato:</span>
                    <span className="font-bold">{String(contract.folioNumber).padStart(6, '0')}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo de Contrato:</span>
                    <span className="font-medium">{contract.type}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Fecha de Creación:</span>
                    <span className="font-medium">{format(contract.createdAt.toDate(), "P", { locale: es })}</span>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="font-semibold">Información del Cliente</h3>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Nombre Original:</span>
                    <span className="font-medium">{contract.clientName}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Cédula / Pasaporte:</span>
                    <span className="font-medium">{getStudentIdNumber(contract)}</span>
                </div>
            </div>
             <div className="space-y-3">
                <h3 className="font-semibold">Detalles Financieros al Momento de Anulación</h3>
                 <div className="flex justify-between text-lg">
                    <span className="text-muted-foreground">Saldo Pendiente:</span>
                    <span className="font-bold text-destructive">B/. {getBalance(contract).toFixed(2)}</span>
                </div>
            </div>
        </CardContent>
        <CardFooter>
            <p className="text-xs text-muted-foreground text-center w-full">
                Este documento confirma que el contrato especificado ha sido anulado en nuestros registros.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}


export default function PrintCancellationPage() {
  const { id } = useParams();
  const db = useDb();
  const { user } = useUser();

  const contractId = Array.isArray(id) ? id[0] : id;

  const contractRef = useMemoDoc(() => {
    if (!db || !user || !contractId) return null;
    return doc(db, `contracts`, contractId);
  }, [db, user, contractId]);

  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);

  useEffect(() => {
    if (contract && !isLoading) {
      const style = document.createElement('style');
      style.id = 'print-styles-cancellation';
      style.innerHTML = `@page { size: portrait; margin: 0.5in; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;
      document.head.appendChild(style);

      const timer = setTimeout(() => {
        window.print();
      }, 500);

      return () => {
         clearTimeout(timer);
         const styleTag = document.getElementById('print-styles-cancellation');
         if (styleTag) {
            document.head.removeChild(styleTag);
         }
      };
    }
  }, [contract, isLoading]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><p>Cargando comprobante...</p></div>;
  }

  if (error) {
    return <div className="flex h-screen items-center justify-center"><p>Error al cargar el contrato: {error.message}</p></div>;
  }

  if (!contract) {
    return <div className="flex h-screen items-center justify-center"><p>Contrato no encontrado.</p></div>;
  }

  return (
    <div className="bg-white">
      <CancellationReceipt contract={contract} />
    </div>
  );
}
