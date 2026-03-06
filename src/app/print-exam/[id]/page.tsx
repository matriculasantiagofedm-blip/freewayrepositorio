'use client';

import React, { useEffect, Suspense, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EXAMS } from '@/lib/exams-data';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function ExamPrintContent() {
    const params = useParams();
    const id = params?.id;
    const examId = Array.isArray(id) ? id[0] : id;
    
    const { toast } = useToast();
    const [isReady, setIsReady] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const exam = EXAMS.find(e => e.id === examId);

    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 3000);
        return () => clearTimeout(timer);
    }, []);

    const handleManualPrint = () => window.print();

    const handleDownloadPdf = async () => {
        const element = document.getElementById('exam-to-print');
        if (!element || !exam) return;

        setIsDownloading(true);
        try {
            // @ts-ignore
            const html2pdf = (await import('html2pdf.js')).default;
            
            const opt = {
                margin: 0,
                filename: `Examen_Teorico_${exam.id}_Freeway.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    letterRendering: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: 816 // 8.5in * 96dpi
                },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            await html2pdf().from(element).set(opt).save();
            toast({ title: "PDF Generado", description: "El examen se ha descargado correctamente." });
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
        } finally {
            setIsDownloading(false);
        }
    };

    if (!exam) {
        return <div className="p-12 text-center font-bold">EXAMEN NO ENCONTRADO</div>;
    }

    return (
        <div className="bg-slate-100 min-h-screen">
            <style dangerouslySetInnerHTML={{ __html: `
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
                    #exam-to-print {
                        width: 8.5in !important;
                        height: 11in !important;
                        padding: 0.5in !important;
                        overflow: hidden !important;
                        page-break-after: avoid !important;
                    }
                }
            `}} />

            <div className="print-ui-element p-4 sticky top-0 z-[100] bg-white border-b shadow-lg">
                <div className="max-w-4xl mx-auto flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-blue-800 bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-[10px] font-bold uppercase text-center w-full">Formato optimizado para UNA SOLA PÁGINA tamaño carta.</p>
                    </div>
                    {!isReady ? (
                        <div className="bg-slate-200 text-slate-500 p-4 rounded-xl text-center font-black uppercase text-sm flex items-center justify-center gap-3">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Preparando Examen (3s)...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Button onClick={handleManualPrint} className="h-16 text-lg font-black uppercase bg-slate-800 hover:bg-black shadow-md border-2 border-slate-600">
                                <Printer className="mr-2 h-6 w-6" /> Imprimir
                            </Button>
                            <Button onClick={handleDownloadPdf} disabled={isDownloading} className="h-16 text-lg font-black uppercase bg-blue-600 hover:bg-blue-700 shadow-md border-2 border-blue-400">
                                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Descargar PDF
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div id="exam-to-print" className="print-container-wrapper bg-white mx-auto shadow-2xl my-8 print:my-0 print:shadow-none w-[8.5in] h-[11in] p-[0.6in] flex flex-col font-sans text-black overflow-hidden">
                <div className="text-center mb-4 border-b-2 border-black pb-2">
                    <h1 className="text-lg font-black uppercase tracking-tighter">FREEWAY ESCUELA DE MANEJO S.A.</h1>
                    <h2 className="text-[10pt] font-bold uppercase">EXAMEN DE CONOCIMIENTOS TEÓRICOS</h2>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 text-[9pt]">
                    <div className="col-span-1 flex items-end gap-1">
                        <span className="font-bold uppercase whitespace-nowrap">Nombre:</span>
                        <div className="flex-1 border-b border-black h-5"></div>
                    </div>
                    <div className="col-span-1 flex items-end gap-1">
                        <span className="font-bold uppercase whitespace-nowrap">Cédula:</span>
                        <div className="flex-1 border-b border-black h-5"></div>
                    </div>
                    <div className="col-span-1 flex items-end gap-1">
                        <span className="font-bold uppercase whitespace-nowrap">Fecha:</span>
                        <div className="flex-1 border-b border-black h-5 text-center font-medium">
                            {format(new Date(), 'dd/MM/yyyy')}
                        </div>
                    </div>
                </div>

                <p className="font-black text-[8.5pt] mb-4 uppercase border-l-4 border-black pl-2 bg-slate-50 py-1 italic">
                    • ESCOJA LA LETRA DE LA RESPUESTA CORRECTA.
                </p>

                <div className="flex-1 grid grid-cols-1 gap-y-3 overflow-hidden">
                    {exam.questions.map((q, idx) => (
                        <div key={idx} className="space-y-1">
                            <p className="font-bold text-[9.5pt] leading-tight flex gap-2">
                                <span className="bg-black text-white px-1 rounded-sm h-fit text-[8pt]">{idx + 1}</span>
                                {q.q}
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pl-7">
                                {q.options.map((opt, oIdx) => (
                                    <p key={oIdx} className="text-[8.5pt] font-medium leading-none">{opt}</p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 flex justify-around">
                    <div className="text-center w-56">
                        <div className="border-t border-black mb-1"></div>
                        <p className="text-[8pt] font-black uppercase">Firma del estudiante</p>
                    </div>
                    <div className="text-center w-56">
                        <div className="border-t border-black mb-1"></div>
                        <p className="text-[8pt] font-black uppercase">Firma del instructor</p>
                    </div>
                </div>

                <div className="mt-4 text-center text-[6.5pt] text-slate-400 font-bold uppercase tracking-widest border-t pt-1">
                    Control de Calidad Académica Freeway • {exam.title} • Página 1/1
                </div>
            </div>
        </div>
    );
}

export default function ExamPrintPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-bold">CARGANDO MOTOR DE EXÁMENES...</div>}>
            <ExamPrintContent />
        </Suspense>
    );
}
