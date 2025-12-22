'use client';
import { Suspense } from 'react';
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from 'next/dynamic';

// Carga dinámica del formulario para evitar errores de hidratación (hydration)
const ContractForm = dynamic(() => import('@/components/contract-form').then(mod => mod.ContractForm), {
    ssr: false,
    loading: () => <p>Cargando formulario...</p>
});


function NewContractPageContent() {
    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Volver</span>
                    </Link>
                </Button>
                <h1 className="font-headline text-3xl font-bold">Nuevo Contrato</h1>
            </div>
            <div className="max-w-4xl mx-auto w-full">
                <ContractForm />
            </div>
        </div>
    );
}


export default function NewContractPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <NewContractPageContent />
        </Suspense>
    );
}
