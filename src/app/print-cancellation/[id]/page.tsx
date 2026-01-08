'use client';
import { useParams } from 'next/navigation';
import { doc, Timestamp } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useDb, useUser } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function CancellationReceiptTemplate({ contract, cancellationDate }: { contract: Contract, cancellationDate: Date }) {
  const getBalance = (contract: Contract): number => {
    if (contract.autoMotoDetails) return contract.autoMotoDetails.balance || 0;
    if (contract.deluxeDetails) return 0;
    if (contract.ampliacionesDetails) return contract.ampliacionesDetails.balance || 0;
    return 0;
  };
  
  return (
    <div className="p-8 bg-white font-sans text-black max-w-2xl mx-auto border-2 border-black">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold font-headline">Comprobante de Anulación de Contrato</h1>
        <p className="text-gray-600">Freeway Escuela de Manejo, S.A.</p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-500">Fecha de Anulación</p>
          <p className="font-semibold">{format(cancellationDate, "d 'de' MMMM 'de' yyyy, h:mm a", { locale: es })}</p>
        </div>

        <div className="border-t border-b border-gray-200 py-4 my-4">
          <h2 className="text-lg font-bold mb-2">Detalles del Contrato Anulado</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div>
              <p className="text-sm text-gray-500">N° de Contrato (Folio)</p>
              <p className="font-semibold">{String(contract.folioNumber).padStart(6, '0')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tipo de Contrato</p>
              <p className="font-semibold">{contract.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Nombre del Cliente</p>
              <p className="font-semibold">{contract.clientName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Cédula</p>
              <p className="font-semibold">{contract.studentIdNumber || 'N/A'}</p>
            </div>
             <div>
              <p className="text-sm text-gray-500">Saldo al Momento de Anular</p>
              <p className="font-semibold text-red-600">B/. {getBalance(contract).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
            <div className="inline-block border-t border-black px-12 pt-2">
                <p className="text-sm">Firma del Responsable</p>
            </div>
        </div>

        <div className="text-xs text-gray-400 text-center pt-8">
            <p>Este documento confirma que el contrato mencionado ha sido anulado en nuestros sistemas.</p>
        </div>
      </div>
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
      const timer = setTimeout(() => {
        window.print();
      }, 500);

      const style = document.createElement('style');
      style.id = 'print-styles';
      style.innerHTML = `@page { size: letter portrait; margin: 1in; }`;
      document.head.appendChild(style);

      return () => {
        clearTimeout(timer);
        const styleTag = document.getElementById('print-styles');
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
    return <div className="flex h-screen items-center justify-center"><p>Error al cargar el comprobante: {error.message}</p></div>;
  }

  if (!contract) {
    return <div className="flex h-screen items-center justify-center"><p>Contrato no encontrado.</p></div>;
  }

  return (
    <div className="bg-gray-100 p-4 print:bg-white print:p-0">
      <CancellationReceiptTemplate contract={contract} cancellationDate={new Date()} />
    </div>
  );
}
