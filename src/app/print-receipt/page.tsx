
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function ReceiptContent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [isReady, setIsReady] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

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
        }, 4000); 
    
        return () => clearTimeout(timer);
      }, []);

    const handleManualPrint = () => {
        window.print();
    };

    const handleDownloadPdf = async () => {
        const element = document.getElementById('receipt-to-print');
        if (!element) return;

        setIsDownloading(true);
        try {
            // @ts-ignore
            const html2pdf = (await import('html2pdf.js')).default;
            
            const opt = {
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: `Recibo_${folio || 'S-N'}_${name?.replace(/\s+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    letterRendering: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: 700 
                },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            await html2pdf().from(element).set(opt).save();
            toast({ title: "PDF Generado", description: "El recibo se ha descargado correctamente." });
        } catch (err) {
            console.error("Error generating PDF:", err);
            toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
        } finally {
            setIsDownloading(false);
        }
    };

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
                    <div className="bg-amber-500 border border-amber-600 p-4 rounded-xl text-center text-white text-sm font-bold animate-pulse flex items-center justify-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        PREPARANDO RECIBO (Espera 4s)...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Button 
                            onClick={handleManualPrint} 
                            size="lg" 
                            className="w-full h-20 text-xl font-black uppercase shadow-2xl bg-slate-800 hover:bg-black border-4 border-slate-600"
                        >
                            <Printer className="mr-4 h-8 w-8" />
                            IMPRIMIR
                        </Button>
                        <Button 
                            onClick={handleDownloadPdf} 
                            disabled={isDownloading}
                            size="lg" 
                            className="w-full h-20 text-xl font-black uppercase shadow-2xl bg-blue-600 hover:bg-blue-700 border-4 border-blue-400"
                        >
                            {isDownloading ? <Loader2 className="mr-4 h-8 w-8 animate-spin" /> : <Download className="mr-4 h-8 w-8" />}
                            DESCARGAR PDF
                        </Button>
                    </div>
                )}
            </div>

            <div id="receipt-to-print">
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
