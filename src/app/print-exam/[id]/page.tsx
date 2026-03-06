
'use client';

import React, { useEffect, Suspense, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download, AlertCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EXAMS } from '@/lib/exams-data';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function ExamPrintContent() {
    const { id } = useParams();
    const { toast } = useToast();
    const [isReady, setIsReady] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const exam = EXAMS.find(e => e.id === id);

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
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: `Examen_Teorico_${exam.id}_Freeway.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    letterRendering: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: 750 
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
        <div className="bg-white min-h-screen">
            <style jsx global>{`
                @media print {
                    @page { size: letter portrait; margin: 0; }
                    body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
                    .print-ui-element { display: none !important; }
                    .print-container-wrapper { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                }
            `}</style>

            <div className="print-ui-element p-4 sticky top-0 z-[100] bg-slate-50 border-b shadow-lg">
                <div className="max-w-4xl mx-auto flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-blue-800 bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-[10px] font-bold uppercase text-center w-full">Formato oficial de evaluación teórica Freeway.</p>
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

            <div id="exam-to-print" className="print-container-wrapper bg-white">
                <div className="max-w-[8.5in] mx-auto p-12 font-sans text-black">
                    {/* HEADER */}
                    <div className="text-center mb-8 border-b-2 border-black pb-4">
                        <h1 className="text-xl font-black uppercase tracking-tighter">FREEWAY ESCUELA DE MANEJO S.A.</h1>
                        <h2 className="text-lg font-bold uppercase mt-1">EXAMEN DE CONOCIMIENTOS TEÓRICOS PARA ASPIRANTE A LICENCIAS DE CONDUCIR</h2>
                    </div>

                    {/* STUDENT INFO */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 mb-8">
                        <div className="flex items-end gap-2">
                            <span className="font-bold text-[10pt] uppercase whitespace-nowrap">Nombre:</span>
                            <div className="flex-1 border-b border-black h-6"></div>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="font-bold text-[10pt] uppercase whitespace-nowrap">Cédula:</span>
                            <div className="flex-1 border-b border-black h-6"></div>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="font-bold text-[10pt] uppercase whitespace-nowrap">Fecha:</span>
                            <div className="flex-1 border-b border-black h-6 text-[10pt] font-medium text-center">
                                {format(new Date(), 'dd/MM/yyyy')}
                            </div>
                        </div>
                    </div>

                    <p className="font-black text-[10pt] mb-6 uppercase border-l-4 border-black pl-3 bg-slate-50 py-1 italic">
                        • ESCOJA LA LETRA DE LA RESPUESTA CORRECTA. Lea con atención las preguntas y las opciones de respuestas.
                    </p>

                    {/* QUESTIONS */}
                    <div className="grid grid-cols-1 gap-y-8">
                        {exam.questions.map((q, idx) => (
                            <div key={idx} className="space-y-2">
                                <p className="font-bold text-[11pt] leading-tight flex gap-3">
                                    <span className="bg-black text-white px-1.5 rounded-sm h-fit">{idx + 1}.</span>
                                    {q.q}
                                </p>
                                <div className="grid grid-cols-1 gap-1 pl-10">
                                    {q.options.map((opt, oIdx) => (
                                        <p key={oIdx} className="text-[10pt] font-medium">{opt}</p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* FOOTER FIRMAS */}
                    <div className="mt-20 pt-12 flex justify-between px-12">
                        <div className="text-center w-64">
                            <div className="border-t-2 border-black mb-1"></div>
                            <p className="text-[9pt] font-black uppercase">Firma del estudiante</p>
                        </div>
                        <div className="text-center w-64">
                            <div className="border-t-2 border-black mb-1"></div>
                            <p className="text-[9pt] font-black uppercase">Firma del instructor</p>
                        </div>
                    </div>

                    <div className="mt-12 text-center text-[7pt] text-slate-400 font-bold uppercase tracking-widest border-t pt-2">
                        Control de Calidad Académica Freeway • {exam.title}
                    </div>
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
