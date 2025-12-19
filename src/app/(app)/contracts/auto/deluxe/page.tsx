'use client';
import { DeluxePremiumContractTemplatePreview } from '@/components/deluxe-premium-contract-template-preview';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Printer } from 'lucide-react';

export default function ContractsAutoDeluxePage() {
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/dashboard">
                            <ChevronLeft className="h-4 w-4" />
                            <span className="sr-only">Volver</span>
                        </Link>
                    </Button>
                    <h1 className="font-headline text-3xl font-bold">Plantilla: Curso Auto Deluxe</h1>
                </div>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir Plantilla
                </Button>
            </div>
            <div className="max-w-4xl mx-auto w-full">
               <DeluxePremiumContractTemplatePreview />
            </div>
        </div>
    );
}
