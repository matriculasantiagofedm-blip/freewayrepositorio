'use client';

/**
 * PÁGINA DE LISTADO: CONTRATOS DE AMPLIACIONES
 * Esta página consulta la colección 'contracts' filtrando por type === 'Ampliaciones'.
 */

import { ContractCard } from '@/components/contract-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Repeat, Plus } from 'lucide-react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { cn } from '@/lib/utils';

export default function ContractsAmpliacionesPage() {
  const db = useDb();
  const { user } = useUser();

  // AQUÍ ES DONDE SE RECUPERAN LOS CONTRATOS GUARDADOS
  const contractsQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'contracts'),
      where('type', '==', 'Ampliaciones'),
      orderBy('folioNumber', 'desc')
    );
  }, [db, user]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Volver</span>
            </Link>
            </Button>
            <div className="flex flex-col">
                <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
                    <Repeat className="h-8 w-8 text-amber-600" />
                    Contratos de Ampliaciones
                </h1>
                <p className="text-muted-foreground text-sm font-medium">Historial de registros de categorías adicionales.</p>
            </div>
        </div>
        <Button asChild className="bg-amber-600 hover:bg-amber-700">
            <Link href="/contracts/new?type=Ampliaciones">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Ampliación
            </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center p-24 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-amber-600 opacity-20" />
            <p className="text-muted-foreground animate-pulse">Consultando base de datos...</p>
        </div>
      )}

      {!isLoading && contracts && contracts.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {contracts.map((contract) => (
            <Link key={contract.id} href={`/contracts/${contract.id}`} className="no-underline group">
                <div className="relative">
                    <div className="absolute top-2 left-2 z-10 bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">
                        FOLIO {String(contract.folioNumber).padStart(6, '0')}
                    </div>
                    <ContractCard contract={contract} />
                </div>
            </Link>
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-24 text-center">
              <Repeat className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-900">
                No hay contratos de Ampliaciones
              </h3>
              <p className="mt-2 text-sm text-slate-500 max-w-xs">
                Todos los contratos creados desde el formulario de Ampliaciones aparecerán listados aquí.
              </p>
              <Button asChild variant="outline" className="mt-6 border-amber-600 text-amber-600 hover:bg-amber-50">
                <Link href="/contracts/new?type=Ampliaciones">Comenzar primer registro</Link>
              </Button>
          </div>
        )
      )}
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("animate-spin", className)}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}
