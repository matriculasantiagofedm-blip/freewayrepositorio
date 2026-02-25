'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LogbookClass {
    number: number;
    content: string[];
    isEvaluation?: boolean;
}

function LogbookContent() {
    const { id } = useParams();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [isReady, setIsReady] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const name = searchParams.get('name') || '';
    const idNumber = searchParams.get('id') || '';
    const type = searchParams.get('type') || 'manual-12h';

    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 3000);
        return () => clearTimeout(timer);
    }, []);

    const handleManualPrint = () => window.print();

    const handleDownloadPdf = async () => {
        const element = document.getElementById('log-to-print');
        if (!element) return;

        setIsDownloading(true);
        try {
            // @ts-ignore
            const html2pdf = (await import('html2pdf.js')).default;
            
            const opt = {
                margin: [0.3, 0.7, 0.3, 0.3],
                filename: `Bitacora_${type}_${idNumber || 'S-N'}_${name.replace(/\s+/g, '_')}.pdf`,
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
            toast({ title: "PDF Generado", description: "La bitácora se ha descargado correctamente." });
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
        } finally {
            setIsDownloading(false);
        }
    };

    const getLogTitle = () => {
        const isMoto = type.startsWith('moto-');
        const vehicle = isMoto ? 'MOTO MANUAL' : 'MANUAL';
        const hours = type.split('-').pop()?.replace('h', '') + ' HORAS';
        return `BITÁCORA-${vehicle} - CLASES PRÁCTICAS-${hours}`;
    };

    const getClasses = (): LogbookClass[] => {
        if (type === 'moto-manual-12h') {
            return [
                { number: 1, content: [
                    "Presentación del circuito y normas de seguridad.",
                    "Artículos de seguridad obligatorios.",
                    "Chequeo rutinario del moto: Llantas, Frenos, Niveles, Luces / direccionales y Sonido del motor.",
                    "Encendido seguro y apagado.",
                    "Dominio del timón y punto de equilibrio.",
                    "Aceleración ligera y uso del freno trasero y delantero.",
                    "Práctica: control a baja velocidad en línea recta."
                ]},
                { number: 2, content: [
                    "Embrague, punto de fricción.",
                    "Cambios ascendentes y descendentes.",
                    "Coordinación aceleración-embrague.",
                    "Práctica: Recorrido usando 1ra-2da-3ra según circuito."
                ]},
                { number: 3, content: [
                    "Zigzag avanzado.",
                    "Circuito en 8 reducido.",
                    "Giro cerrado con control del cuerpo.",
                    "Frenado de emergencia básico."
                ]},
                { number: 4, content: [
                    "Explicación de cruce de intersecciones múltiples.",
                    "Señalización anticipada.",
                    "Jerarquía de paso (quién va primero).",
                    "Simulación de tráfico con los otros estudiantes."
                ]},
                { number: 5, content: [
                    "Circuito con: Zigzag, Circuito 8, Intersecciones, Curvas cerradas y Arranques en puntos amplios.",
                    "Análisis de errores comunes y práctica reforzada."
                ]},
                { number: 6, content: [
                    "Prueba completa del circuito.",
                    "Control del moto a baja y media velocidad.",
                    "Cambios fluidos.",
                    "Señalización correcta.",
                    "Dominio total de maniobras.",
                    "Retroalimentación final."
                ]}
            ];
        }

        // AUTO 12H (Default)
        if (type === 'manual-12h') {
            return [
                { number: 1, content: ["Presentación del vehículo manual.", "Chequeo rutinario.", "Ajuste de asiento y espejos.", "Encendido y funciones básicas.", "Explicación de pedales.", "Arranque en primera y frenado suave."] },
                { number: 2, content: ["Dominio de la palanca de cambios (1ª a 3ª).", "Giros simples con embrague.", "Estacionamiento de frente."] },
                { number: 3, content: ["Estacionamientos lateral y reversa.", "Uso de retrovisores.", "Cruces en intersecciones."] },
                { number: 4, content: ["Dominio de paradas.", "Arranque en pendiente con embrague.", "Frenado de emergencia."] },
                { number: 5, content: ["Perfeccionamiento de cambios.", "Cruces más complejos.", "Maniobras avanzadas de estacionamiento."] },
                { number: 6, content: ["Repaso integral.", "Evaluación avanzada: pendiente, dominio de marchas y cruces."] }
            ];
        }

        if (type === 'manual-10h') {
            return [
                { number: 1, content: ["Presentación del vehículo.", "Chequeo rutinario.", "Encendido y funciones básicas.", "Arranque en primera y frenado."] },
                { number: 2, content: ["Cambios de 1ª a 3ª.", "Giros y uso de direccionales.", "Estacionamiento de frente."] },
                { number: 3, content: ["Estacionamiento lateral y reversa.", "Uso de espejos.", "Cruces simples."] },
                { number: 4, content: ["Dominio de paradas.", "Arranque en pendiente.", "Frenado de emergencia."] },
                { number: 5, content: ["Recorrido completo en circuito.", "Evaluación práctica final."], isEvaluation: true }
            ];
        }

        if (type === 'manual-8h') {
            return [
                { number: 1, content: ["Presentación del vehículo.", "Chequeo rutinario.", "Encendido.", "Arranque y frenado."] },
                { number: 2, content: ["Palanca de cambios.", "Giros.", "Estacionamiento frontal."] },
                { number: 3, content: ["Estacionamiento reversa/lateral.", "Cruces e intersecciones."] },
                { number: 4, content: ["Repaso de estacionamientos.", "Cambios hasta 3ª.", "Evaluación práctica final."], isEvaluation: true }
            ];
        }

        return []; // Fallback empty
    };

    const classes = getClasses();
    const isMoto = type.startsWith('moto-');
    const needsEvaluationSection = !isMoto && (type === 'manual-8h' || type === 'manual-10h');

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
                        <p className="text-[10px] font-bold uppercase text-center w-full">Verifique los datos antes de imprimir o descargar.</p>
                    </div>
                    {!isReady ? (
                        <div className="bg-slate-200 text-slate-500 p-4 rounded-xl text-center font-black uppercase text-sm flex items-center justify-center gap-3">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Preparando visualización (3s)...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Button onClick={handleManualPrint} className="h-16 text-lg font-black uppercase bg-slate-800 hover:bg-black shadow-md border-2 border-slate-600">
                                <Printer className="mr-2 h-6 w-6" /> Imprimir
                            </Button>
                            <Button onClick={handleDownloadPdf} disabled={isDownloading} className="h-16 text-lg font-black uppercase bg-blue-600 hover:bg-blue-700 shadow-md border-2 border-blue-400">
                                {isDownloading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Download className="mr-2 h-6 w-6" />} Descargar PDF
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div id="log-to-print" className="print-container-wrapper bg-white">
                <div className="max-w-[8.5in] mx-auto p-10 font-sans text-[9pt] text-black">
                    {/* HEADER */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                                <span className="font-black text-2xl tracking-tighter leading-none">FW FREEWAY</span>
                                <span className="text-[7pt] font-bold uppercase tracking-[0.2em] -mt-1">Escuela de Manejo</span>
                            </div>
                        </div>
                        <div className="text-center flex-1">
                            <h1 className="font-black text-xl uppercase tracking-widest">{getLogTitle()}</h1>
                        </div>
                        <div className="w-24"></div>
                    </div>

                    {/* STUDENT INFO */}
                    <div className="flex items-end gap-4 mb-6">
                        <div className="flex flex-1 items-end gap-2">
                            <span className="font-black text-[9pt]">NOMBRE:</span>
                            <div className="flex-1 border-b-2 border-black px-2 py-0.5 font-bold uppercase text-base h-7 leading-none">{name}</div>
                        </div>
                        <div className="flex items-end gap-2 w-1/3">
                            <span className="font-black text-[9pt]">CÉDULA/PASS:</span>
                            <div className="flex-1 border-b-2 border-black px-2 py-0.5 font-bold text-base h-7 leading-none">{idNumber}</div>
                        </div>
                    </div>

                    {/* TABLE */}
                    <table className="w-full border-2 border-black border-collapse">
                        <tbody>
                            {classes.map((cls) => (
                                <React.Fragment key={cls.number}>
                                    <tr className="border-b-2 border-black h-28">
                                        <td className="border-r-2 border-black p-2 w-20 text-center font-black text-xs align-middle">Clase N°{cls.number}</td>
                                        <td className="border-r-2 border-black p-3 align-top leading-tight text-[8pt]">
                                            <ol className={cn("space-y-0.5 list-decimal pl-4", cls.isEvaluation && "font-bold")}>
                                                {cls.content.map((item, idx) => (
                                                    <li key={idx} dangerouslySetInnerHTML={{ __html: item.replace('Evaluación práctica:', '<strong>Evaluación práctica:</strong>') }} />
                                                ))}
                                            </ol>
                                        </td>
                                        <td className="p-2 align-top text-[7pt] font-bold text-slate-400 uppercase w-44 text-right">Observación</td>
                                    </tr>
                                    <tr className="border-b-2 last:border-b-0 border-black h-7 bg-slate-50">
                                        <td colSpan={2} className="px-3 text-[7.5pt] font-black uppercase">Asistencia del Estudiante: _________________________</td>
                                        <td className="px-3 text-[7.5pt] font-black uppercase">Instructor: _________________________</td>
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>

                    {/* EVALUATION SECTION (AUTO ONLY) */}
                    {needsEvaluationSection && (
                        <div className="mt-6 space-y-4">
                            <div className="space-y-2">
                                <h3 className="font-black text-[9pt] uppercase">PUNTOS A MEJORAR SOBRE EL ESTUDIANTE EN SU MANEJO:</h3>
                                <div className="border-b border-black border-dashed h-7"></div>
                                <div className="border-b border-black border-dashed h-7"></div>
                            </div>
                            <div className="pt-2">
                                <div className="flex items-end gap-2">
                                    <span className="font-black text-[9pt] uppercase">NOMBRE DEL INSTRUCTOR:</span>
                                    <div className="flex-1 border-b border-black border-dashed"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-10 text-[6pt] text-slate-400 font-bold uppercase text-center tracking-widest">
                        FREEWAY ESCUELA DE MANEJO • DOCUMENTO DE CONTROL INTERNO • PROHIBIDA SU REPRODUCCIÓN SIN AUTORIZACIÓN
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PrintLogPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-bold">INICIANDO GENERADOR...</div>}>
            <LogbookContent />
        </Suspense>
    );
}
