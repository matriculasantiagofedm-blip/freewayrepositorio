'use client';

import { useParams } from 'next/navigation';
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
import { MotoContractForm } from '@/components/forms/moto-contract-form';
import { AmpliacionesContractForm } from '@/components/forms/ampliaciones-contract-form';
import { SoloPracticaContractForm } from '@/components/forms/solo-practica-contract-form';
import { DeluxeContractForm } from '@/components/forms/deluxe-contract-form';

export default function EditContractPage() {
  const { id } = useParams();
  const db = useDb();
  const { user, isUserLoading } = useUser();
  const { role, isLoading: isRoleLoading } = useCurrentRole();
  const contractId = Array.isArray(id) ? id[0] : id;

  const contractRef = useMemoDoc(() => (db && contractId && !isUserLoading && user) ? doc(db, 'contracts', contractId) : null, [db, contractId, user, isUserLoading]);
  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);

  if (isLoading || isUserLoading || isRoleLoading) return <div className="p-24 text-center"><Loader2 className="animate-spin h-12 w-12 mx-auto" /></div>;

  if (role !== 'Administrador' && role !== 'Ventas' && role !== 'Ventas Externas') return <div className="p-12 text-center">Acceso restringido. Solo el Administrador o personal de Ventas pueden editar registros.</div>;

  if (error || !contract) return <div className="p-8 text-center">Error: Contrato no encontrado.</div>;

  const renderForm = () => {
    switch (contract.type) {
        case 'Curso Auto':
        case 'Curso Mixto':
            return <AutoContractForm contract={contract} />;
        case 'Curso Moto':
            return <MotoContractForm contract={contract} />;
        case 'Ampliaciones':
            return <AmpliacionesContractForm contract={contract} />;
        case 'Curso Solo Practica':
            return <SoloPracticaContractForm contract={contract} />;
        case 'Curso Deluxe':
            return <DeluxeContractForm contract={contract} />;
        default:
            return (
                <div className="p-12 text-center border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">No hay formularios de edición activos para el tipo: {contract.type}</p>
                </div>
            );
    }
  };

  return (
    <div className="flex flex-col gap-8">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild><Link href={`/contracts/${contractId}`}><ChevronLeft className="h-4 w-4" /></Link></Button>
            <div className="flex flex-col">
                <h1 className="font-headline text-3xl font-bold">Modificar Registro</h1>
                <p className="text-muted-foreground">Folio: <span className="font-bold text-primary">{String(contract.folioNumber).padStart(6, '0')}</span></p>
            </div>
        </div>
        <Card className="max-w-5xl mx-auto w-full shadow-lg">
            <CardHeader className="border-b bg-slate-50/50">
                <CardTitle className="text-xl font-bold">Edición de Documento</CardTitle>
                <CardDescription>Estás modificando un registro existente. Los cambios afectarán la impresión del contrato.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                {renderForm()}
            </CardContent>
        </Card>
    </div>
  );
}
