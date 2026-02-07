'use client';

import { useParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useEffect, Suspense } from 'react';
import { ContractView } from '@/components/contract-view';
import type { Contract } from '@/lib/types';
import { useDb, useFirebase, useUser } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { signInAnonymously } from 'firebase/auth';

/**
 * Página de impresión de contrato.
 * DESBLOQUEADA: Acceso universal.
 * Asegura sesión anónima para evitar errores de permisos en Firestore.
 */
function PrintContractContent() {
  const { id } = useParams();
  const db = useDb();
  const { auth } = useFirebase();
  const { user, isUserLoading } = useUser();

  const contractId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    if (auth && !auth.currentUser) {
      signInAnonymously(auth).catch(console.error);
    }
  }, [auth]);

  const contractRef = useMemoDoc(() => {
    if (!db || !contractId || !user || isUserLoading) return null;
    return doc(db, `contracts`, contractId);
  }, [db, contractId, user, isUserLoading]);

  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);

  useEffect(() => {
    if (contract && !isLoading) {
      const timer = setTimeout(() => {
        window.print();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [contract, isLoading]);

  if (isLoading || isUserLoading) {
    return <div className="flex h-screen items-center justify-center bg-white"><p className="text-lg animate-pulse">Cargando documento...</p></div>;
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

export default function PrintContractPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center">Preparando impresión...</div>}>
            <PrintContractContent />
        </Suspense>
    );
}
