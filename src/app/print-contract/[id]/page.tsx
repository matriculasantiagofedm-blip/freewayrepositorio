'use client';

import { useParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useEffect } from 'react';

import { ContractView } from '@/components/contract-view';
import type { Contract } from '@/lib/types';
import { useDb, useUser } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';

export default function PrintContractPage() {
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
      // Small delay to ensure content is fully rendered before printing
      const timer = setTimeout(() => {
        window.print();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [contract, isLoading]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><p>Cargando contrato para imprimir...</p></div>;
  }

  if (error) {
    return <div className="flex h-screen items-center justify-center"><p>Error al cargar el contrato: {error.message}</p></div>;
  }

  if (!contract) {
    return <div className="flex h-screen items-center justify-center"><p>Contrato no encontrado.</p></div>;
  }

  return (
    <div className="bg-white font-serif text-xs">
        <style jsx global>{`
          @page {
            size: letter portrait;
            margin: 0.75in;
          }
          body {
            background-color: white !important;
          }
        `}</style>
      <ContractView contract={contract} />
    </div>
  );
}