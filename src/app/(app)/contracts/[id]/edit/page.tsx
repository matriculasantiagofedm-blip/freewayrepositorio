'use client';

import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import type { Contract } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { ContractForm } from '@/components/contract-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function EditContractPage() {
  const { id } = useParams();
  const db = useDb();
  const { user, isUserLoading } = useUser();
  
  const contractId = Array.isArray(id) ? id[0] : id;

  const contractRef = useMemoDoc(() => {
    if (!db || !contractId || isUserLoading || !user) return null;
    return doc(db, 'contracts', contractId);
  }, [db, contractId, user, isUserLoading]);

  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);

  if (isLoading || isUserLoading) {
    return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
            <p className="text-muted-foreground animate-pulse">Cargando datos del contrato...</p>
        </div>
    );
  }

  if (error || !contract) {
    return (
        <div className="p-8 text-center">
            <h1 className="text-2xl font-bold text-destructive">Error</h1>
            <p className="text-muted-foreground">{error?.message || 'Contrato no encontrado'}</p>
            <Button asChild className="mt-4"><Link href="/dashboard">Volver al Panel</Link></Button>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href={`/contracts/${contractId}`}>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Volver</span>
                </Link>
            </Button>
            <div className="flex flex-col">
                <h1 className="font-headline text-3xl font-bold">Modificar Contrato</h1>
                <p className="text-muted-foreground">Editando Folio: <span className="font-bold text-primary">{String(contract.folioNumber).padStart(6, '0')}</span></p>
            </div>
        </div>

        <Card className="max-w-5xl mx-auto w-full shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-bold font-headline">Freeway Escuela de Manejo, S.A.</CardTitle>
                <CardDescription>Actualiza los campos necesarios. Los cambios se guardarán sobre el folio actual.</CardDescription>
            </CardHeader>
            <CardContent>
                <ContractForm initialContract={contract} />
            </CardContent>
        </Card>
    </div>
  );
}
