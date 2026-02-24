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
import { Printer } from 'lucide-react';

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
        try {
            window.print();
        } catch (e) {
            console.error("Print failed", e);
        }
      }, 3500); // Aumentamos a 3.5s para contratos largos en tablet
      return () => clearTimeout(timer);
    }
  }, [contract, isLoading]);

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

      <div className="print-ui-element p-4 sticky top-0 z-[100] bg-slate-50 border-b shadow-sm space-y-2">
        {!isReady ? (
            <div className="bg-amber-100 border border-amber-300 p-3 rounded-lg text-center text-amber-800 text-xs font-black uppercase">
                Renderizando contrato para Tablet... Espere el diálogo de impresión.
            </div>
        ) : (
            <Button 
                onClick={() => window.print()} 
                className="w-full h-14 text-lg font-black uppercase bg-blue-600 hover:bg-blue-700 shadow-lg"
            >
                <Printer className="mr-3 h-6 w-6" />
                RE-INTENTAR IMPRESIÓN (PULSAR AQUÍ)
            </Button>
        )}
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
