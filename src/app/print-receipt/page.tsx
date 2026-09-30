'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download, Scissors } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SingleReceiptProps {
  copyTitle: string;
  folio: string | null;
  contractFolio?: string | null;
  date: string | null;
  name: string | null;
  idNumber: string | null;
  address: string | null;
  concept: string | null;
  amount: string | null;
}

function SingleReceiptCard({ copyTitle, folio, contractFolio, date, name, idNumber, address, concept, amount }: SingleReceiptProps) {
  return (
    <Card className="shadow-none border-2 border-slate-900 rounded-none p-3 bg-white">
      {/* Encabezado con Identificador de Copia */}
      <div className="flex justify-between items-center border-b border-slate-300 pb-1 mb-2 text-[9px] font-black uppercase text-slate-500">
        <span className="bg-slate-900 text-white px-2 py-0.5 tracking-wider">{copyTitle}</span>
        <span>FREEWAY ESCUELA DE MANEJO</span>
      </div>

      <CardHeader className="text-center space-y-0.5 p-0 pb-2 border-b border-slate-200">
        <h2 className="font-black text-lg uppercase tracking-tighter text-slate-900">FREEWAY ESCUELA DE MANEJO</h2>
        <p className="text-[9px] font-bold text-slate-600">RUC: 155628022-2-2016 DV 2</p>
        <p className="text-[9px] text-slate-500">La Chorrera, Costa Verde, P.H. Green Plaza, Local #20 • Tel: 345-6915 / Cel: 6741-5184</p>
      </CardHeader>

      <CardContent className="space-y-3 text-xs pt-3 p-0">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base font-black underline uppercase text-slate-900">RECIBO DE PAGO</CardTitle>
            {contractFolio && contractFolio !== '---' && (
              <p className="text-[10px] font-extrabold text-slate-600 uppercase mt-0.5">
                Ref. Contrato: <span className="text-slate-900">{contractFolio}</span>
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-black text-blue-700 text-base">RECIBO N° {folio}</p>
            <p className="text-[10px] font-bold text-slate-600">{date}</p>
          </div>
        </div>
        
        <div className="border border-slate-300 p-2.5 space-y-1 bg-slate-50/50 rounded-sm">
          <p><strong className="uppercase text-[9px] text-slate-500">Cliente:</strong> <span className="font-bold text-sm text-slate-900">{name}</span></p>
          <p><strong className="uppercase text-[9px] text-slate-500">Cédula / ID:</strong> <span className="font-bold text-slate-800">{idNumber}</span></p>
          <p><strong className="uppercase text-[9px] text-slate-500">Dirección:</strong> <span className="font-medium text-slate-700">{address || '---'}</span></p>
        </div>

        <div className="space-y-1">
          <h3 className="font-black uppercase text-[9px] text-slate-500">Concepto de Pago</h3>
          <div className="border-t-2 border-b-2 border-slate-900 py-2 flex justify-between items-center bg-slate-50 px-2">
            <span className="font-bold text-xs uppercase text-slate-900">{concept}</span>
            <span className="font-black text-base text-slate-900">B/. {amount}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between items-end pt-3 p-0">
        <div className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
          GRACIAS POR SU PREFERENCIA
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase text-slate-500">Total Pagado</p>
          <p className="font-black text-2xl text-slate-950">B/. {amount}</p>
        </div>
      </CardFooter>
    </Card>
  );
}

function ReceiptContent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [isReady, setIsReady] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const folio = searchParams.get('folio');
    const contractFolio = searchParams.get('contractFolio');
    const date = searchParams.get('date');
    const name = searchParams.get('name');
    const idNumber = searchParams.get('idNumber');
    const address = searchParams.get('address');
    const concept = searchParams.get('concept');
    const amount = searchParams.get('amount');

    useEffect(() => {
        const timer = setTimeout(() => {
          setIsReady(true);
        }, 1500); 
    
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
                margin: [0.3, 0.3, 0.3, 0.3],
                filename: `Recibo_${folio || 'S-N'}_${name?.replace(/\s+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    letterRendering: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: 720 
                },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            await html2pdf().from(element).set(opt).save();
            toast({ title: "PDF Generado", description: "El recibo en doble copia se ha descargado correctamente." });
        } catch (err) {
            console.error("Error generating PDF:", err);
            toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-4 md:p-6 font-sans bg-white">
             <style jsx global>{`
                @page {
                    size: letter portrait;
                    margin: 0.3in;
                }
                body {
                    background-color: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                @media print {
                    .print-ui-element { display: none !important; }
                    body { margin: 0; padding: 0; }
                }
            `}</style>
            
            <div className="print-ui-element space-y-4 mb-6">
                {!isReady ? (
                    <div className="bg-amber-500 border border-amber-600 p-4 rounded-xl text-center text-white text-sm font-bold animate-pulse flex items-center justify-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        PREPARANDO RECIBO DE PAGO...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Button 
                            onClick={handleManualPrint} 
                            size="lg" 
                            className="w-full h-16 text-lg font-black uppercase shadow-xl bg-slate-800 hover:bg-black border-2 border-slate-600 cursor-pointer"
                        >
                            <Printer className="mr-3 h-6 w-6" />
                            IMPRIMIR (2 COPIAS / CARTA)
                        </Button>
                        <Button 
                            onClick={handleDownloadPdf} 
                            disabled={isDownloading}
                            size="lg" 
                            className="w-full h-16 text-lg font-black uppercase shadow-xl bg-blue-600 hover:bg-blue-700 border-2 border-blue-400 cursor-pointer"
                        >
                            {isDownloading ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Download className="mr-3 h-6 w-6" />}
                            DESCARGAR PDF
                        </Button>
                    </div>
                )}
            </div>

            {/* Documento Imprimible: Dos Copias en Tamaño Carta */}
            <div id="receipt-to-print" className="space-y-4 bg-white p-2">
                {/* Copia 1: Original - Cliente */}
                <SingleReceiptCard 
                  copyTitle="ORIGINAL — CLIENTE"
                  folio={folio}
                  contractFolio={contractFolio}
                  date={date}
                  name={name}
                  idNumber={idNumber}
                  address={address}
                  concept={concept}
                  amount={amount}
                />

                {/* Línea Punteada de Corte */}
                <div className="relative py-2 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-dashed border-slate-400"></div>
                  </div>
                  <div className="relative bg-white px-4 text-[9px] font-black uppercase text-slate-500 flex items-center gap-1.5 tracking-widest border border-slate-300 rounded-full py-0.5">
                    <Scissors className="w-3.5 h-3.5 text-slate-600" />
                    <span>CORTAR AQUÍ</span>
                  </div>
                </div>

                {/* Copia 2: Copia - Expediente / Caja */}
                <SingleReceiptCard 
                  copyTitle="COPIA — EXPEDIENTE / CAJA"
                  folio={folio}
                  contractFolio={contractFolio}
                  date={date}
                  name={name}
                  idNumber={idNumber}
                  address={address}
                  concept={concept}
                  amount={amount}
                />
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
