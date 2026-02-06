'use client';

import { useParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useEffect } from 'react';

import { ContractView } from '@/components/contract-view';
import type { Contract } from '@/lib/types';
import { useDb } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';

export default function PrintContractPage() {
  const { id } = useParams();
  const db = useDb();

  const contractId = Array.isArray(id) ? id[0] : id;

  const contractRef = useMemoDoc(() => {
    if (!db || !contractId) return null;
    // Desbloqueo: No dependemos de 'user' para evitar fallos de permisos al abrir pestaña
    return doc(db, `contracts`, contractId);
  }, [db, contractId]);

  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);

  useEffect(() => {
    if (contract && !isLoading) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [contract, isLoading]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-white"><p className="text-lg animate-pulse">Cargando documento para impresión...</p></div>;
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-2">Error de Acceso</h1>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Documento No Encontrado</h1>
        <p className="text-muted-foreground">El contrato solicitado no existe en la base de datos.</p>
      </div>
    );
  }

  return (
    <div className="bg-white font-serif text-xs min-h-screen">
        <style jsx global>{`
          @media print {
            @page {
              size: letter portrait;
              margin-top: 10mm;
              margin-bottom: 13mm;
              margin-left: 6.5mm;
              margin-right: 6.5mm;
            }
            body {
              background-color: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}</style>
      <ContractView contract={contract} />
    </div>
  );
}