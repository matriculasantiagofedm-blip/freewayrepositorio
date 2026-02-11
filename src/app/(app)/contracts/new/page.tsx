'use client';
import { Suspense, useState, useEffect } from 'react';
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractForm } from '@/components/contract-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSearchParams } from 'next/navigation';

function NewContractPageContent() {
    const searchParams = useSearchParams();
    const contractType = searchParams.get('type') || 'Contrato';
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="flex flex-col gap-8">
                <div className="flex items-center gap-4 animate-pulse">
                    <div className="h-10 w-10 bg-muted rounded-md" />
                    <div className='flex flex-col gap-2'>
                        <div className="h-8 w-48 bg-muted rounded" />
                        <div className="h-4 w-32 bg-muted rounded" />
                    </div>
                </div>
                <Card className="max-w-5xl mx-auto w-full shadow-lg">
                    <CardHeader>
                        <div className="h-8 w-64 bg-muted rounded mb-2" />
                        <div className="h-4 w-48 bg-muted rounded" />
                    </CardHeader>
                    <CardContent className="h-96 flex items-center justify-center">
                        <p className="text-muted-foreground">Iniciando formulario...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4 print:hidden">
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
             <Card className="max-w-5xl mx-auto w-full shadow-lg print:shadow-none print:border-none">
                <CardHeader className="print:hidden">
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
        <Suspense fallback={<div className="flex justify-center items-center h-full p-12"><p>Cargando página...</p></div>}>
            <NewContractPageContent />
        </Suspense>
    );
}
