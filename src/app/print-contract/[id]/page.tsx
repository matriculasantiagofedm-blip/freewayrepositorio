'use client';

import { useParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useEffect, Suspense, useState } from 'react';
import { ContractView } from '@/components/contract-view';
import type { Contract } from '@/lib/types';
import { useDb, useFirebase, useUser } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { signInAnonymously } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Printer, Loader2 } from 'lucide-react';

function PrintContractContent() {
  const { id } = useParams();
  const db = useDb();
  const { auth } = useFirebase();
  const { user, isUserLoading } = useUser();
  const [isReady, setIsReady] = useState(false);

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
        setIsReady(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [contract, isLoading]);

  const handleManualPrint = () => {
    window.print();
  };

  if (isLoading || isUserLoading) {
    return <div className="flex h-screen items-center justify-center bg-white font-bold animate-pulse text-blue-600">CARGANDO DOCUMENTO...</div>;
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white p-8 text-center text-red-600 font-bold">
        <h1 className="text-2xl mb-2">ERROR DE ACCESO</h1>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex h-screen items-center justify-center bg-white font-bold">REGISTRO NO ENCONTRADO</div>
    );
  }

  return (
    <div className="bg-white font-serif min-h-screen">
        <style jsx global>{`
          @media print {
            @page {
              size: letter portrait;
              margin: 10mm;
            }
            body { background-color: white !important; }
            .print-ui-element { display: none !important; }
          }
        `}</style>

      <div className="print-ui-element p-4 sticky top-0 z-[100] bg-slate-50 border-b shadow-lg space-y-2">
        {!isReady ? (
            <div className="bg-amber-500 border border-amber-600 p-4 rounded-lg text-center text-white text-sm font-black uppercase animate-pulse flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                Renderizando contrato para Tablet...
            </div>
        ) : (
            <Button 
                onClick={handleManualPrint} 
                className="w-full h-20 text-xl font-black uppercase bg-blue-600 hover:bg-blue-700 shadow-xl border-4 border-blue-400 animate-bounce"
            >
                <Printer className="mr-4 h-8 w-8" />
                PULSAR AQUÍ PARA IMPRIMIR
            </Button>
        )}
        <p className="text-[10px] text-center text-slate-500 font-bold uppercase">Asegúrate de que la impresora esté encendida</p>
      </div>

      <ContractView contract={contract} />
    </div>
  );
}

export default function PrintContractPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-bold">INICIANDO...</div>}>
            <PrintContractContent />
        </Suspense>
    );
}
