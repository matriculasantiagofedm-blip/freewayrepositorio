'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';

function ReceiptContent() {
    const searchParams = useSearchParams();

    const folio = searchParams.get('folio');
    const date = searchParams.get('date');
    const name = searchParams.get('name');
    const idNumber = searchParams.get('idNumber');
    const address = searchParams.get('address');
    const concept = searchParams.get('concept');
    const amount = searchParams.get('amount');

    useEffect(() => {
        // Automatically trigger print dialog
        const timer = setTimeout(() => {
          window.print();
        }, 500); // Small delay to ensure content renders

        const handleAfterPrint = () => {
          // Some browsers need a moment before closing is allowed.
          setTimeout(() => window.close(), 100);
        };
        window.addEventListener('afterprint', handleAfterPrint);
    
        return () => {
            clearTimeout(timer);
            window.removeEventListener('afterprint', handleAfterPrint);
        }
      }, []);

    return (
        <div className="w-full max-w-2xl mx-auto p-8 font-sans">
             <style jsx global>{`
                @page {
                    size: letter portrait;
                    margin: 0.5in;
                }
                body {
                    background-color: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            `}</style>
            <Card className="shadow-none border">
                <CardHeader className="text-center space-y-2">
                    <p className="text-sm">RUC: 155628022-2-2016 DV 2</p>
                    <p className="text-sm">La Chorrera, Vía Interamericana, Costa Verde, P.H. Green T, Plaza, Local #20</p>
                    <p className="text-sm">Tel: 345-6915 / Cel: 6741-5184</p>
                </CardHeader>
                <CardContent className="space-y-6 text-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg">Recibo de Pago</CardTitle>
                        </div>
                        <div className="text-right">
                            <p><strong>Recibo N°:</strong> {folio}</p>
                            <p><strong>Fecha:</strong> {date}</p>
                        </div>
                    </div>
                    
                    <div className="border rounded-lg p-4 space-y-1">
                        <h3 className="font-semibold mb-2 text-base">Información del Cliente</h3>
                        <p><strong>Nombre:</strong> {name}</p>
                        <p><strong>Cédula / Pasaporte:</strong> {idNumber}</p>
                        <p><strong>Dirección:</strong> {address}</p>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-2 text-base">Detalle del Pago</h3>
                        <div className="border-t border-b py-2">
                            <div className="flex justify-between">
                                <span>{concept}</span>
                                <span className="font-semibold">B/. {amount}</span>
                            </div>
                        </div>
                    </div>

                </CardContent>
                <CardFooter className="flex justify-end">
                     <div className="text-right space-y-1">
                        <p className="font-bold text-lg">TOTAL: B/. {amount}</p>
                     </div>
                </CardFooter>
            </Card>
            <div className="text-center text-xs text-muted-foreground mt-8">
                <p>GRACIAS POR SU PAGO</p>
            </div>
        </div>
    );
}

export default function PrintReceiptPage() {
    return (
        <Suspense fallback={<div>Cargando recibo...</div>}>
            <ReceiptContent />
        </Suspense>
    );
}
