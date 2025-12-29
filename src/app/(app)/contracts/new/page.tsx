'use client';
import { Suspense } from 'react';
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSearchParams } from 'next/navigation';

// Carga dinámica del formulario para evitar errores de hidratación (hydration)
const ContractForm = dynamic(() => import('@/components/contract-form').then(mod => mod.ContractForm), {
    ssr: false,
    loading: () => <p>Cargando formulario...</p>
});


function NewContractPageContent() {
    const searchParams = useSearchParams();
    const contractType = searchParams.get('type') || 'Contrato';

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Volver</span>
                    </Link>
                </Button>
                <div className='flex flex-col'>
                    <h1 className="font-headline text-3xl font-bold">Nuevo Contrato</h1>
                     <p className="text-muted-foreground">Creando un nuevo contrato de tipo: <span className="font-semibold text-primary">{contractType}</span></p>
                </div>
            </div>
             <Card className="max-w-5xl mx-auto w-full shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold font-headline">Freeway Escuela de Manejo, S.A.</CardTitle>
                    <CardDescription>Completa todos los campos para generar el nuevo contrato.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ContractForm />
                </CardContent>
            </Card>
        </div>
    );
}


export default function NewContractPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-full"><p>Cargando...</p></div>}>
            <NewContractPageContent />
        </Suspense>
    );
}
