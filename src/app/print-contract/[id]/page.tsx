'use client';

import { useParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useEffect, Suspense, useState } from 'react';
import { ContractView } from '@/components/contract-view';
import type { Contract } from '@/lib/types';
import { useDb, useFirebase, useUser } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { signInAnonymously } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

function PrintContractContent() {
  const { id } = useParams();
  const db = useDb();
  const { auth } = useFirebase();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isReady, setIsReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const contractId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    if (auth && !auth.currentUser) {
      signInAnonymously(auth).catch(console.error);
    }
  }, [auth]);

  const contractRef = useMemoDoc(() => {
    if (!db || !contractId || !user || isUserLoading) return null;
    return doc(db, `contracts`, contractId);
  }, [db, contractId, user, isUserLoading]);

  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);

  useEffect(() => {
    if (contract && !isLoading) {
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [contract, isLoading]);

  const handleManualPrint = () => {
    // Android Chrome no soporta CSS Named Pages. Inyectamos @page portrait dinámicamente.
    const styleId = 'contract-print-override';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      @page {
        size: letter portrait !important;
        margin: 0 !important;
      }
      @media print {
        .print-ui-element { display: none !important; }
        body { background: white !important; margin: 0 !important; padding: 0 !important; }
      }
    `;
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      }, 2000);
    }, 150);
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('contract-to-print');
    if (!element || !contract) return;

    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      
      const opt = {
        margin: [0.3, 0.7, 0.3, 0.3], // Top, Left (0.7 is +40% from 0.5), Bottom, Right
        filename: `Contrato_${contract.folioNumber || 'S-N'}_${contract.clientName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 820 
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().from(element).set(opt).save();
      toast({ title: "PDF Generado", description: "El contrato se ha descargado correctamente." });
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading || isUserLoading) {
    return <div className="flex h-screen items-center justify-center bg-white font-bold animate-pulse text-blue-600">CARGANDO DOCUMENTO...</div>;
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white p-8 text-center text-red-600 font-bold">
        <h1 className="text-2xl mb-2">ERROR DE ACCESO</h1>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex h-screen items-center justify-center bg-white font-bold">REGISTRO NO ENCONTRADO</div>
    );
  }

  return (
    <div className="bg-white font-serif min-h-screen pb-10">
        <style jsx global>{`
          @media print {
            @page {
              size: letter portrait;
              margin: 0;
            }
            body { 
                background-color: white !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            .print-ui-element { display: none !important; }
            .print-container-wrapper {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }
          }
        `}</style>

      <div className="print-ui-element p-4 sticky top-0 z-[100] bg-slate-50 border-b shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
            <div className="flex items-center gap-2 text-blue-800 bg-blue-50 p-2 rounded-lg border border-blue-100">
                <AlertCircle className="h-4 w-4" />
                <p className="text-[10px] font-bold uppercase text-center w-full">Verifique los datos antes de imprimir o descargar.</p>
            </div>
            
            {!isReady ? (
                <div className="bg-slate-200 text-slate-500 p-4 rounded-xl text-center font-black uppercase text-sm flex items-center justify-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparando visualización (8s)...
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button 
                        onClick={handleManualPrint} 
                        className="h-16 text-lg font-black uppercase bg-slate-800 hover:bg-black shadow-md border-2 border-slate-600"
                    >
                        <Printer className="mr-2 h-6 w-6" />
                        Imprimir
                    </Button>
                    <Button 
                        onClick={handleDownloadPdf} 
                        disabled={isDownloading}
                        className="h-16 text-lg font-black uppercase bg-blue-600 hover:bg-blue-700 shadow-md border-2 border-blue-400"
                    >
                        {isDownloading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Download className="mr-2 h-6 w-6" />}
                        Descargar PDF
                    </Button>
                </div>
            )}
        </div>
      </div>

      <div id="contract-to-print" className="print-container-wrapper bg-white">
        <ContractView contract={contract} />
      </div>
    </div>
  );
}

export default function PrintContractPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-bold">INICIANDO...</div>}>
            <PrintContractContent />
        </Suspense>
    );
}
