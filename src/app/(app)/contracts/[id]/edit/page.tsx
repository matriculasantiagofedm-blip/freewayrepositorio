'use client';

import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import type { Contract } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCurrentRole } from '@/hooks/use-current-role';
import { AutoContractForm } from '@/components/forms/auto-contract-form';
import { AmpliacionesContractForm } from '@/components/forms/ampliaciones-contract-form';

export default function EditContractPage() {
  const { id } = useParams();
  const db = useDb();
  const { user, isUserLoading } = useUser();
  const { role, isLoading: isRoleLoading } = useCurrentRole();
  const contractId = Array.isArray(id) ? id[0] : id;

  const contractRef = useMemoDoc(() => (db && contractId && !isUserLoading && user) ? doc(db, 'contracts', contractId) : null, [db, contractId, user, isUserLoading]);
  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);

  if (isLoading || isUserLoading || isRoleLoading) return <div className="p-24 text-center"><Loader2 className="animate-spin h-12 w-12 mx-auto" /></div>;

  if (role !== 'Administrador') return <div className="p-12 text-center">Acceso restringido.</div>;

  if (error || !contract) return <div className="p-8 text-center">Error: Contrato no encontrado.</div>;

  const renderForm = () => {
    switch(contract.type) {
        case 'Ampliaciones':
            return <AmpliacionesContractForm initialContract={contract} />;
        default:
            return <AutoContractForm initialContract={contract} />;
    }
  };

  return (
    <div className="flex flex-col gap-8">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild><Link href={`/contracts/${contractId}`}><ChevronLeft className="h-4 w-4" /></Link></Button>
            <div className="flex flex-col">
                <h1 className="font-headline text-3xl font-bold">Modificar Contrato</h1>
                <p className="text-muted-foreground">Folio: <span className="font-bold text-primary">{String(contract.folioNumber).padStart(6, '0')}</span></p>
            </div>
        </div>
        <Card className="max-w-5xl mx-auto w-full shadow-lg">
            <CardHeader><CardTitle className="text-2xl font-bold">Edición de Documento</CardTitle></CardHeader>
            <CardContent>
                {renderForm()}
            </CardContent>
        </Card>
    </div>
  );
}
