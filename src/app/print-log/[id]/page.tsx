'use client';

import React, { useEffect, Suspense, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download, AlertCircle, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn, toDate } from '@/lib/utils';
import { useDb } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { doc } from 'firebase/firestore';
import type { Contract } from '@/lib/types';

interface LogbookClass {
    number: number;
    content: string[];
    isEvaluation?: boolean;
}

function LogbookContent() {
    const { id } = useParams();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const db = useDb();
    const [isReady, setIsReady] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const contractId = Array.isArray(id) ? id[0] : id;
    const name = searchParams.get('name') || '';
    const idNumber = searchParams.get('id') || '';
    const type = searchParams.get('type') || 'manual-12h';
    const generalInstructor = searchParams.get('instructor') || '';

    const contractRef = useMemoDoc(() => {
        if (!db || !contractId) return null;
        return doc(db, 'contracts', contractId);
    }, [db, contractId]);

    const { data: contract, isLoading: isContractLoading } = useDoc<Contract>(contractRef);

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
        if (type === 'already-know') return 'BITÁCORA - YA SE MANEJAR';
        if (type.startsWith('moto-')) {
            const hours = type.split('-').pop()?.replace('h', '') + ' HORAS';
            return `BITÁCORA-MOTO MANUAL - CLASES PRÁCTICAS-${hours}`;
        }
        if (type.startsWith('auto-automatic-')) {
            const hours = type.split('-').pop()?.replace('h', '') + ' HORAS';
            return `BITÁCORA-AUTOMATICO - CLASES PRÁCTICAS-${hours}`;
        }
        const hours = type.split('-').pop()?.replace('h', '') + ' HORAS';
        return `BITÁCORA-MANUAL - CLASES PRÁCTICAS-${hours}`;
    };

    const getSessionInstructor = (index: number) => {
        if (!contract) return generalInstructor;
        const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
        let schedules: any[] = [];
        
        if (type.startsWith('moto-')) {
            schedules = contract.autoMotoDetails?.motoPracticalClassSchedules || [];
        } else if (contract.type === 'Curso Deluxe') {
            schedules = contract.deluxeDetails?.classSchedules || [];
        } else {
            schedules = contract.autoMotoDetails?.practicalClassSchedules || [];
        }
        
        const sessionInstructor = schedules[index]?.instructor;
        return sessionInstructor || details?.instructor || generalInstructor;
    };

    const getClasses = (): LogbookClass[] => {
        if (type === 'already-know') return [];
        // AUTO AUTOMATICO 12H
        if (type === 'auto-automatic-12h') {
            return [
                { number: 1, content: [
                    "Presentación del vehículo automático.",
                    "Chequeo rutinario (luces, líquidos, llantas, frenos).",
                    "Ajuste de asiento, espejos, cinturón de seguridad.",
                    "Encendido y funciones básicas del tablero.",
                    "Dominio inicial del timón y pedales (acelerador, freno).",
                    "Práctica de arranque, avance y frenado suave en línea recta."
                ]},
                { number: 2, content: [
                    "Revisión rápida del chequeo rutinario.",
                    "Dominio de cambios en automático (P, R, N, D).",
                    "Uso de direccionales.",
                    "Giros a la derecha e izquierda dentro del circuito.",
                    "Primer contacto con estacionamiento de frente."
                ]},
                { number: 3, content: [
                    "Estacionamientos de frente, lateral y reversa con mayor dominio.",
                    "Práctica de giros seguidos + uso de direccionales."
                ]},
                { number: 4, content: [
                    "Estacionamientos bajo presión de tiempo.",
                    "Mayor control en intersecciones.",
                    "Práctica de vueltas en U."
                ]},
                { number: 5, content: [
                    "Simulación de recorrido completo con varias maniobras.",
                    "Uso combinado de estacionamientos y cruces.",
                    "Dominio de subida y bajada."
                ]},
                { number: 6, content: [
                    "Repaso integral + evaluación práctica avanzada:",
                    "a. Arranque correcto, uso de direccionales, giros, estacionamientos, cruces, ceder el paso."
                ], isEvaluation: true}
            ];
        }

        // AUTO AUTOMATICO 10H
        if (type === 'auto-automatic-10h') {
            return [
                { number: 1, content: [
                    "Presentación del vehículo automático.",
                    "Chequeo rutinario (luces, líquidos, llantas, frenos).",
                    "Ajuste de asiento, espejos, cinturón de seguridad.",
                    "Encendido y funciones básicas del tablero.",
                    "Dominio del timón y pedales (acelerador, freno).",
                    "Práctica de arranque, avance y frenado suave en línea recta."
                ]},
                { number: 2, content: [
                    "Revisión rápida del chequeo rutinario.",
                    "Dominio de cambios en automático (P, R, N, D).",
                    "Uso de direccionales.",
                    "Giros a la derecha e izquierda dentro del circuito.",
                    "Primer contacto con estacionamiento de frente."
                ]},
                { number: 3, content: [
                    "Estacionamientos de frente, lateral y reversa con mayor dominio.",
                    "Práctica de giros seguidos + uso de direccionales."
                ]},
                { number: 4, content: [
                    "Simulación de maniobras en intersección con prioridad.",
                    "Frenado progresivo y de emergencia.",
                    "Circulación continua en el circuito."
                ]},
                { number: 5, content: [
                    "Repaso general de estacionamientos e intersecciones.",
                    "Corrección de errores comunes.",
                    "Evaluación práctica: maniobras, estacionamientos, intersecciones."
                ], isEvaluation: true}
            ];
        }

        // AUTO AUTOMATICO 8H
        if (type === 'auto-automatic-8h') {
            return [
                { number: 1, content: [
                    "Presentación del vehículo automático.",
                    "Chequeo rutinario (luces, líquidos, llantas, frenos).",
                    "Ajuste de asiento, espejos, cinturón de seguridad.",
                    "Encendido y funciones básicas del tablero.",
                    "Dominio del timón y pedales (acelerador, freno).",
                    "Práctica de arranque, avance y frenado suave en línea recta."
                ]},
                { number: 2, content: [
                    "Controles de mando y uso de direccionales.",
                    "Giros a la derecha e izquierda dentro del circuito.",
                    "Primer contacto con estacionamiento de frente."
                ]},
                { number: 3, content: [
                    "Estacionamientos de frente, lateral y reversa.",
                    "Uso correcto de los espejos retrovisores.",
                    "Práctica de cruces e intersecciones simples."
                ]},
                { number: 4, content: [
                    "Repaso general de estacionamientos y giros.",
                    "Circulación continua en el circuito respetando señales.",
                    "Evaluación práctica final del curso básico."
                ], isEvaluation: true}
            ];
        }

        // MOTO 8H
        if (type === 'moto-manual-8h') {
            return [
                { number: 1, content: [
                    "Presentación del circuito y normas de seguridad.",
                    "Artículos de seguridad obligatorios.",
                    "Chequeo rutinario del moto: Llantas, Frenos, Niveles, Luces / direccionales y Sonido del motor",
                    "Encendido seguro y apagado.",
                    "Dominio del timón y punto de equilibrio.",
                    "Aceleración ligera y uso del freno trasero y delantero.",
                    "Práctica: control a baja velocidad en línea recta."
                ]},
                { number: 2, content: [
                    "Explicación de la caja manual (1 abajo, 2-5 arriba).",
                    "Salida suave con embrague (punto de fricción).",
                    "Cambios de 1ra -> 2da -> 1ra dentro del circuito.",
                    "Frenado progresivo.",
                    "Práctica: a. Circuito básico (rectas + curvas amplias). b. Control del embrague a baja velocidad."
                ]},
                { number: 3, content: [
                    "Zig Zag: Dominio del timón, Balance con velocidad baja y Uso del embrague en maniobras",
                    "Circuito en 8: Trazado de curvas cerradas y Mirada anticipada",
                    "Práctica combinada: Zigzag + curvas en 8 + frenado controlado"
                ]},
                { number: 4, content: [
                    "Cómo cruzar una intersección dentro del circuito.",
                    "Ceder el paso (simulación de tráfico entre estudiantes).",
                    "Señalización con direccionales.",
                    "Retrovisores: revisión constante.",
                    "Práctica final: Recorrido completo del circuito y Zigzag + 8 + detención + arranque",
                    "Evaluación final del curso básico."
                ], isEvaluation: true}
            ];
        }

        // MOTO 10H
        if (type === 'moto-manual-10h') {
            return [
                { number: 1, content: [
                    "Presentación del circuito y normas de seguridad.",
                    "Chequeo rutinario inicial.",
                    "Dominio del timón y punto de equilibrio.",
                    "Uso del freno trasero y delantero.",
                    "Práctica: control a baja velocidad."
                ]},
                { number: 2, content: [
                    "Caja manual y embrague (punto de fricción).",
                    "Cambios 1ra -> 2da y reducciones.",
                    "Frenado progresivo controlado.",
                    "Práctica: Circuito básico (rectas + curvas)."
                ]},
                { number: 3, content: [
                    "Maniobras: Zig Zag y Circuito en 8.",
                    "Mirada anticipada y balance del cuerpo.",
                    "Uso del embrague en maniobras cerradas."
                ]},
                { number: 4, content: [
                    "Intersecciones y ceder el paso.",
                    "Señalización con direccionales.",
                    "Uso correcto de retrovisores.",
                    "Circulación continua en circuito simulado."
                ]},
                { number: 5, content: [
                    "Repaso general de maniobras.",
                    "Evaluación práctica: Circuito completo, zigzag y 8.",
                ], isEvaluation: true}
            ];
        }

        // MOTO 12H
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

        // AUTO 12H (Default Manual)
        if (type === 'manual-12h') {
            return [
                { number: 1, content: ["Presentación del vehículo.", "Chequeo rutinario.", "Ajuste de asiento y espejos.", "Encendido y funciones básicas.", "Explicación de controles.", "Arranque y frenado suave."] },
                { number: 2, content: ["Dominio de marchas.", "Giros simples.", "Estacionamiento de frente."] },
                { number: 3, content: ["Estacionamientos lateral y reversa.", "Uso de retrovisores.", "Cruces en intersecciones."] },
                { number: 4, content: ["Dominio de paradas.", "Arranque en pendiente.", "Frenado de emergencia."] },
                { number: 5, content: ["Perfeccionamiento de conducción.", "Cruces más complejos.", "Maniobras avanzadas de estacionamiento."] },
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
                { number: 2, content: ["Controles de mando.", "Giros.", "Estacionamiento frontal."] },
                { number: 3, content: ["Estacionamiento reversa/lateral.", "Cruces e intersecciones."] },
                { number: 4, content: ["Repaso de estacionamientos.", "Circulación en circuito.", "Evaluación práctica final."], isEvaluation: true }
            ];
        }

        return []; 
    };

    const AlreadyKnowTemplate = () => {
        const details = contract?.autoMotoDetails;
        const isCommercial = details?.licenseCategory === 'A, C, D';
        const isAutomatic = details?.vehicleTransmission === 'Automático';

        return (
            <div className="max-w-[8.5in] mx-auto p-12 font-sans text-black bg-white">
                <div className="text-center mb-8 border-b-2 border-black pb-4">
                    <h1 className="text-2xl font-black uppercase tracking-widest">FREEWAY ESCUELA DE MANEJO</h1>
                    <h2 className="text-xl font-bold uppercase mt-1">CLASES PRÁCTICAS - YA SE MANEJAR</h2>
                </div>

                <div className="space-y-6 text-[11pt]">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="flex border-b border-black pb-1">
                            <span className="font-black w-40">NOMBRE:</span>
                            <span className="font-bold uppercase flex-1">{name}</span>
                        </div>
                        <div className="flex border-b border-black pb-1">
                            <span className="font-black w-40">CÉDULA / PASS:</span>
                            <span className="font-bold flex-1">{idNumber}</span>
                        </div>
                        
                        <div className="flex items-center gap-8 py-2">
                            <span className="font-black w-32">CATEGORÍA:</span>
                            <div className="flex items-center gap-2">
                                <div className={cn("w-4 h-4 border border-black flex items-center justify-center", !isCommercial && "bg-black")}><span className="text-white text-[8pt]">{!isCommercial ? 'X' : ''}</span></div>
                                <span className="text-[10pt] font-bold">A, C (Particular)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={cn("w-4 h-4 border border-black flex items-center justify-center", isCommercial && "bg-black")}><span className="text-white text-[8pt]">{isCommercial ? 'X' : ''}</span></div>
                                <span className="text-[10pt] font-bold">A, C, D (Comercial)</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-8 py-2">
                            <span className="font-black w-32">TRANSMISIÓN:</span>
                            <div className="flex items-center gap-2">
                                <div className={cn("w-4 h-4 border border-black flex items-center justify-center", isAutomatic && "bg-black")}><span className="text-white text-[8pt]">{isAutomatic ? 'X' : ''}</span></div>
                                <span className="text-[10pt] font-bold uppercase">Automática</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={cn("w-4 h-4 border border-black flex items-center justify-center", !isAutomatic && "bg-black")}><span className="text-white text-[8pt]">{!isAutomatic ? 'X' : ''}</span></div>
                                <span className="text-[10pt] font-bold uppercase">Manual</span>
                            </div>
                        </div>

                        <div className="flex border-b border-black pb-1">
                            <span className="font-black w-40">HORARIO:</span>
                            <span className="font-bold flex-1 uppercase">{details?.theoreticalClassSchedule || 'PROGRAMADO'}</span>
                        </div>
                        <div className="flex border-b border-black pb-1">
                            <span className="font-black w-40">INSTRUCTOR:</span>
                            <span className="font-bold flex-1 uppercase">{generalInstructor}</span>
                        </div>
                    </div>

                    <div className="pt-8 space-y-6">
                        <div className="flex items-center gap-12">
                            <span className="font-black uppercase">¿USÓ EL CINTURÓN DE SEGURIDAD?</span>
                            <div className="flex gap-8">
                                <div className="flex items-center gap-2"><div className="w-5 h-5 border border-black"></div><span className="font-bold">SI</span></div>
                                <div className="flex items-center gap-2"><div className="w-5 h-5 border border-black"></div><span className="font-bold">NO</span></div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <span className="font-black uppercase underline">OBSERVACIÓN DEL INSTRUCTOR:</span>
                            <div className="space-y-6 pt-2">
                                <div className="border-b border-black border-dashed h-4"></div>
                                <div className="border-b border-black border-dashed h-4"></div>
                                <div className="border-b border-black border-dashed h-4"></div>
                                <div className="border-b border-black border-dashed h-4"></div>
                                <div className="border-b border-black border-dashed h-4"></div>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4">
                            <span className="font-black uppercase underline">TIEMPO DE ESTACIONAMIENTO:</span>
                            <div className="space-y-6 pt-2">
                                <div className="border-b border-black border-dashed h-4"></div>
                                <div className="border-b border-black border-dashed h-4"></div>
                                <div className="border-b border-black border-dashed h-4"></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-12 pt-6">
                            <div className="space-y-4">
                                <span className="font-black uppercase block">¿NECESITA AFIANZAMIENTO?</span>
                                <div className="flex gap-8">
                                    <div className="flex items-center gap-2"><div className="w-5 h-5 border border-black"></div><span className="font-bold">SI</span></div>
                                    <div className="flex items-center gap-2"><div className="w-5 h-5 border border-black"></div><span className="font-bold">NO</span></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <span className="font-black uppercase block text-xs">CANTIDAD DE HORAS RECOMENDADAS:</span>
                                <div className="border-b-2 border-black h-8"></div>
                            </div>
                        </div>

                        <div className="flex justify-center gap-24 pt-12">
                            <div className="flex items-center gap-3"><div className="w-8 h-8 border-2 border-black"></div><span className="font-black text-lg uppercase tracking-tighter">APROBADO</span></div>
                            <div className="flex items-center gap-3"><div className="w-8 h-8 border-2 border-black"></div><span className="font-black text-lg uppercase tracking-tighter">REPROBADO</span></div>
                        </div>

                        <div className="pt-24 flex justify-center">
                            <div className="w-80 text-center">
                                <div className="border-t-2 border-black mb-2"></div>
                                <span className="font-black uppercase text-xs">FIRMA DEL ESTUDIANTE</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const classes = getClasses();
    const isAuto = !type.startsWith('moto-');
    const isAlreadyKnow = type === 'already-know';
    const needsEvaluationSection = !isAlreadyKnow && ((isAuto && (type.endsWith('8h') || type.endsWith('10h'))) || (type === 'moto-manual-8h' || type === 'moto-manual-10h'));

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
                {isAlreadyKnow ? (
                    <AlreadyKnowTemplate />
                ) : (
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
                        <div className="space-y-4 mb-6">
                            <div className="flex items-end gap-4">
                                <div className="flex flex-1 items-end gap-2">
                                    <span className="font-black text-[9pt]">NOMBRE:</span>
                                    <div className="flex-1 border-b-2 border-black px-2 py-0.5 font-bold uppercase text-base h-7 leading-none">{name}</div>
                                </div>
                                <div className="flex items-end gap-2 w-1/3">
                                    <span className="font-black text-[9pt]">CÉDULA/PASS:</span>
                                    <div className="flex-1 border-b-2 border-black px-2 py-0.5 font-bold text-base h-7 leading-none">{idNumber}</div>
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="font-black text-[9pt]">INSTRUCTOR ASIGNADO:</span>
                                <div className="flex-1 border-b-2 border-black px-2 py-0.5 font-bold uppercase text-base h-7 leading-none">{generalInstructor}</div>
                            </div>
                        </div>

                        {/* TABLE */}
                        <table className="w-full border-2 border-black border-collapse">
                            <tbody>
                                {classes.map((cls, idx) => {
                                    const sessionInstructor = getSessionInstructor(idx);
                                    return (
                                        <React.Fragment key={cls.number}>
                                            <tr className="border-b-2 border-black h-28">
                                                <td className="border-r-2 border-black p-2 w-20 text-center font-black text-xs align-middle">Clase N°{cls.number}</td>
                                                <td className="border-r-2 border-black p-3 align-top leading-tight text-[8pt]">
                                                    <ol className={cn("space-y-0.5 list-decimal pl-4", cls.isEvaluation && "font-bold")}>
                                                        {cls.content.map((item, cIdx) => (
                                                            <li key={cIdx} dangerouslySetInnerHTML={{ __html: item.replace('Evaluación práctica:', '<strong>Evaluación práctica:</strong>').replace('Evaluación final del curso básico.', '<strong>Evaluación final del curso básico.</strong>').replace('Repaso integral + evaluación práctica avanzada:', '<strong>Repaso integral + evaluación práctica avanzada:</strong>') }} />
                                                        ))}
                                                    </ol>
                                                </td>
                                                <td className="p-2 align-top text-[7pt] font-bold text-slate-400 uppercase w-44 text-right">Observación</td>
                                            </tr>
                                            <tr className="border-b-2 last:border-b-0 border-black h-7 bg-slate-50">
                                                <td colSpan={2} className="px-3 text-[7.5pt] font-black uppercase">Asistencia del Estudiante: _________________________</td>
                                                <td className="px-3 text-[7.5pt] font-black uppercase">
                                                    Instructor: <span className="underline ml-1">{sessionInstructor || '_________________________'}</span>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* EVALUATION SECTION */}
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
                                        <div className="flex-1 border-b border-black border-dashed px-2 font-bold uppercase">{generalInstructor}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-10 text-[6pt] text-slate-400 font-bold uppercase text-center tracking-widest">
                            FREEWAY ESCUELA DE MANEJO • DOCUMENTO DE CONTROL INTERNO • PROHIBIDA SU REPRODUCCIÓN SIN AUTORIZACIÓN
                        </div>
                    </div>
                )}
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