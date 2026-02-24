'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

function ReceiptContent() {
    const searchParams = useSearchParams();
    const [isReady, setIsReady] = useState(false);

    const folio = searchParams.get('folio');
    const date = searchParams.get('date');
    const name = searchParams.get('name');
    const idNumber = searchParams.get('idNumber');
    const address = searchParams.get('address');
    const concept = searchParams.get('concept');
    const amount = searchParams.get('amount');

    useEffect(() => {
        const timer = setTimeout(() => {
          setIsReady(true);
          // Intento de impresión automática con delay para Android
          try {
            window.print();
          } catch (e) {
            console.error("Auto-print failed", e);
          }
        }, 3000); 
    
        return () => clearTimeout(timer);
      }, []);

    return (
        <div className="w-full max-w-2xl mx-auto p-4 md:p-8 font-sans bg-white">
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
                @media print {
                    .print-ui-element { display: none !important; }
                }
            `}</style>
            
            <div className="print-ui-element space-y-4 mb-8">
                {!isReady ? (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center text-blue-800 text-sm font-bold animate-pulse">
                        PREPARANDO RECIBO PARA LA TABLET... POR FAVOR ESPERE.
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-center text-green-800 text-sm font-bold">
                            LISTO PARA IMPRIMIR
                        </div>
                        <Button 
                            onClick={() => window.print()} 
                            size="lg" 
                            className="w-full h-16 text-lg font-black uppercase shadow-xl bg-blue-600 hover:bg-blue-700 animate-bounce"
                        >
                            <Printer className="mr-3 h-6 w-6" />
                            PULSAR AQUÍ PARA IMPRIMIR
                        </Button>
                    </div>
                )}
            </div>

            <Card className="shadow-none border-2 border-slate-200 rounded-none p-4">
                <CardHeader className="text-center space-y-1 pb-4 border-b">
                    <h2 className="font-black text-xl uppercase tracking-tighter">FREEWAY ESCUELA DE MANEJO</h2>
                    <p className="text-[10px] font-bold">RUC: 155628022-2-2016 DV 2</p>
                    <p className="text-[10px]">La Chorrera, Costa Verde, P.H. Green Plaza, Local #20</p>
                    <p className="text-[10px]">Tel: 345-6915 / Cel: 6741-5184</p>
                </CardHeader>
                <CardContent className="space-y-6 text-sm pt-6">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-black underline">RECIBO DE PAGO</CardTitle>
                        <div className="text-right">
                            <p className="font-black text-blue-700">N° {folio}</p>
                            <p className="text-xs font-bold">{date}</p>
                        </div>
                    </div>
                    
                    <div className="border border-slate-300 p-4 space-y-2 bg-slate-50/50">
                        <p><strong className="uppercase text-[10px]">Cliente:</strong> <span className="font-bold text-base">{name}</span></p>
                        <p><strong className="uppercase text-[10px]">Cédula/ID:</strong> <span className="font-bold">{idNumber}</span></p>
                        <p><strong className="uppercase text-[10px]">Dirección:</strong> <span className="font-medium">{address}</span></p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-black uppercase text-[10px] text-slate-500">Concepto de Pago</h3>
                        <div className="border-t-2 border-b-2 border-black py-4 flex justify-between items-center">
                            <span className="font-bold text-base uppercase">{concept}</span>
                            <span className="font-black text-xl">B/. {amount}</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end pt-4">
                     <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Total Pagado</p>
                        <p className="font-black text-3xl">B/. {amount}</p>
                     </div>
                </CardFooter>
            </Card>
            <div className="text-center text-[10px] font-black uppercase text-slate-400 mt-12 tracking-[0.3em]">
                GRACIAS POR SU PREFERENCIA
            </div>
        </div>
    );
}

export default function PrintReceiptPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center font-bold">Cargando motor de recibos...</div>}>
            <ReceiptContent />
        </Suspense>
    );
}
