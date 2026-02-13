'use client';
import { Suspense, useState, useEffect } from 'react';
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSearchParams } from 'next/navigation';
import { MotoContractForm } from '@/components/forms/moto-contract-form';
import { MixtoContractForm } from '@/components/forms/mixto-contract-form';
import { SoloPracticaContractForm } from '@/components/forms/solo-practica-contract-form';

function NewContractPageContent() {
    const searchParams = useSearchParams();
    const contractType = searchParams.get('type') || 'Curso Moto';
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    if (!mounted) return <div className="p-12 text-center">Iniciando...</div>;

    const renderForm = () => {
        switch(contractType) {
            case 'Curso Moto':
                return <MotoContractForm />;
            case 'Curso Mixto':
                return <MixtoContractForm />;
            case 'Curso Solo Practica':
                return <SoloPracticaContractForm />;
            default:
                return (
                    <div className="p-12 text-center border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">Seleccione un tipo de contrato válido.</p>
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4 print:hidden">
                <Button variant="outline" size="icon" asChild><Link href="/dashboard"><ChevronLeft className="h-4 w-4" /><span className="sr-only">Volver</span></Link></Button>
                <div className='flex flex-col'>
                    <h1 className="font-headline text-3xl font-bold">Nuevo Contrato</h1>
                     <p className="text-muted-foreground">Tipo: <span className="font-semibold text-primary">{contractType}</span></p>
                </div>
            </div>
             <Card className="max-w-5xl mx-auto w-full shadow-lg print:shadow-none print:border-none">
                <CardHeader className="print:hidden">
                    <CardTitle className="text-2xl font-bold font-headline">Freeway Escuela de Manejo, S.A.</CardTitle>
                    <CardDescription>Completa los campos para generar el contrato.</CardDescription>
                </CardHeader>
                <CardContent>
                    {renderForm()}
                </CardContent>
            </Card>
        </div>
    );
}

export default function NewContractPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center">Cargando...</div>}>
            <NewContractPageContent />
        </Suspense>
    );
}
