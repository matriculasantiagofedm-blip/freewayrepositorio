'use client';

import React, { useEffect, Suspense, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download, AlertCircle } from 'lucide-react';
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
                margin: 0,
                filename: `Bitacora_${type}_${idNumber || 'S-N'}_${name.replace(/\s+/g, '_')}.pdf`,
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

    const getClasses = (): LogbookClass[] => {
        if (type === 'already-know') return [];
        
        // AUTO AUTOMATICO 12H
        if (type === 'auto-automatic-12h') {
            return [
                { number: 1, content: ["Presentación del vehículo automático.", "Chequeo rutinario (luces, líquidos, llantas, frenos).", "Ajuste de asiento, espejos, cinturón de seguridad.", "Encendido y funciones básicas del tablero.", "Dominio inicial del timón y pedales (acelerador, freno).", "Práctica de arranque, avance y frenado suave en línea recta."] },
                { number: 2, content: ["Revisión rápida del chequeo rutinario.", "Dominio de cambios en automático (P, R, N, D).", "Uso de direccionales.", "Giros a la derecha e izquierda dentro del circuito.", "Primer contacto con estacionamiento de frente."] },
                { number: 3, content: ["Estacionamientos de frente, lateral y reversa con mayor dominio.", "Práctica de giros seguidos + uso de direccionales."] },
                { number: 4, content: ["Estacionamientos bajo presión de tiempo.", "Mayor control en intersecciones.", "Práctica de vueltas en U."] },
                { number: 5, content: ["Simulación de recorrido completo con varias maniobras.", "Uso combinado de estacionamientos y cruces.", "Dominio de subida y bajada."] },
                { number: 6, content: ["Repaso integral + evaluación práctica avanzada:", "a. Arranque correcto, uso de direccionales, giros, estacionamientos, cruces, ceder el paso."], isEvaluation: true }
            ];
        }

        // AUTO AUTOMATICO 10H
        if (type === 'auto-automatic-10h') {
            return [
                { number: 1, content: ["Presentación del vehículo automático.", "Chequeo rutinario (luces, líquidos, llantas, frenos).", "Ajuste de asiento, espejos, cinturón de seguridad.", "Encendido y funciones básicas del tablero.", "Dominio inicial del timón y pedales (acelerador, freno).", "Práctica de arranque, avance y frenado suave en línea recta."] },
                { number: 2, content: ["Revisión rápida del chequeo rutinario.", "Dominio de cambios en automático (P, R, N, D).", "Uso de direccionales.", "Giros a la derecha e izquierda dentro del circuito.", "Primer contacto con estacionamiento de frente."] },
                { number: 3, content: ["Estacionamientos de frente, lateral y reversa con mayor dominio.", "Práctica de giros seguidos + uso de direccionales."] },
                { number: 4, content: ["Simulación de maniobras en intersección con prioridad.", "Frenado progresivo y de emergencia.", "Circulación continua en el circuito."] },
                { number: 5, content: ["Repaso general de estacionamientos e intersecciones.", "Corrección de errores comunes.", "Evaluación práctica: maniobras, estacionamientos, intersecciones."], isEvaluation: true }
            ];
        }

        // AUTO AUTOMATICO 8H
        if (type === 'auto-automatic-8h') {
            return [
                { number: 1, content: ["Presentación del vehículo automático.", "Chequeo rutinario (luces, líquidos, llantas, frenos).", "Ajuste de asiento, espejos, cinturón de seguridad.", "Encendido y funciones básicas del tablero.", "Dominio inicial del timón y pedales (acelerador, freno).", "Práctica de arranque, avance y frenado suave en línea recta."] },
                { number: 2, content: ["Revisión rápida del chequeo rutinario.", "Dominio de cambios en automático (P, R, N, D).", "Uso de direccionales.", "Giros a la derecha e izquierda dentro del circuito.", "Primer contacto con estacionamiento de frente."] },
                { number: 3, content: ["Práctica de estacionamiento lateral y en reversa.", "Uso correcto de retrovisores.", "Ceder el paso en intersección simulada.", "Práctica de cruces en “T” o intersección simple."] },
                { number: 4, content: ["Repaso de estacionamientos.", "Práctica de giros + intersecciones con ceder el paso.", "Simulación de recorrido dentro del circuito.", "Evaluación práctica: arranque, giro, estacionamiento y cruce."], isEvaluation: true}
            ];
        }

        // MOTO 12H
        if (type === 'moto-manual-12h') {
            return [
                { number: 1, content: ["Presentación del circuito y normas de seguridad.", "Artículos de seguridad obligatorios.", "Chequeo rutinario del moto: Llantas, Frenos, Niveles, Luces / direccionales y Sonido del motor", "Encendido seguro y apagado.", "Dominio del timón y punto de equilibrio.", "Aceleración ligera y uso del freno trasero y delantero.", "Práctica: control a baja velocidad en línea recta."] },
                { number: 2, content: ["Embrague, punto de fricción.", "Cambios ascendentes y descendentes.", "Coordinación aceleración–embrague.", "Práctica: Recorrido usando 1ra–2da–3ra según circuito."] },
                { number: 3, content: ["Zigzag avanzado.", "Circuito en 8 reducido.", "Giro cerrado con control del cuerpo.", "Frenado de emergencia básico."] },
                { number: 4, content: ["Explicación de cruce de intersecciones múltiples.", "Señalización anticipada.", "Jerarquía de paso (quién va primero).", "Simulación de tráfico con los otros estudiantes."] },
                { number: 5, content: ["Circuito con: Zigzag, Circuito 8, Intersecciones, Curvas cerradas y Arranques en puntos amplios", "Análisis de errores comunes y práctica reforzada."] },
                { number: 6, content: ["Evaluación final práctica integral del curso Premium.", "Firma de aprobación de competencias."], isEvaluation: true }
            ];
        }

        // MOTO 10H
        if (type === 'moto-manual-10h') {
            return [
                { number: 1, content: ["Presentación del circuito y normas de seguridad.", "Artículos de seguridad obligatorios.", "Chequeo rutinario del moto: Llantas, Frenos, Niveles, Luces / direccionales y Sonido del motor", "Encendido seguro y apagado.", "Dominio del timón y punto de equilibrio.", "Aceleración ligera y uso del freno trasero y delantero.", "Práctica: control a baja velocidad en línea recta."] },
                { number: 2, content: ["Embrague, punto de fricción.", "Cambios ascendentes y descendentes.", "Coordinación aceleración–embrague.", "Práctica: Recorrido usando 1ra–2da–3ra según circuito."] },
                { number: 3, content: ["Zigzag avanzado.", "Circuito en 8 con menos diámetro.", "Dominio del freno trasero para estabilidad.", "Práctica combinada."] },
                { number: 4, content: ["Cómo cruzar intersecciones internas.", "Ceder el paso en entornos simulados.", "Señalización obligatoria.", "Práctica: Intersección + cambios + frenado."] },
                { number: 5, content: ["Recorrido completo del circuito con todos los elementos: Zigzag, Circuito en 8, Intersecciones, Cambios ascendentes/descendentes y Paradas y arranques correctos", "Corrección de errores.", "Evaluación final del curso PLUS."], isEvaluation: true}
            ];
        }

        // MOTO 8H
        if (type === 'moto-manual-8h') {
            return [
                { number: 1, content: ["Presentación del circuito y normas de seguridad.", "Artículos de seguridad obligatorios.", "Chequeo rutinario del moto: Llantas, Frenos, Niveles, Luces / direccionales y Sonido del motor", "Encendido seguro y apagado.", "Dominio del timón y punto de equilibrio.", "Aceleración ligera y uso del freno trasero y delantero.", "Práctica: control a baja velocidad en línea recta."] },
                { number: 2, content: ["Explicación de la caja manual (1 abajo, 2–5 arriba).", "Salida suave con embrague (punto de fricción).", "Cambios de 1ra → 2da → 1ra dentro del circuito.", "Frenado progresivo.", "Práctica: a. Circuito básico (rectas + curvas amplias). b. Control del embrague a baja velocidad."] },
                { number: 3, content: ["Zig Zag: Dominio del timón, Balance con velocidad baja y Uso del embrague en maniobras", "Circuito en 8: Trazado de curvas cerradas y Mirada anticipada", "Práctica combinada: Zigzag + curvas en 8 + frenado controlado"] },
                { number: 4, content: ["Cómo cruzar una intersección dentro del circuito.", "Ceder el paso (simulación de tráfico entre estudiantes).", "Señalización con direccionales.", "Retrovisores: revisión constante.", "Práctica final: Recorrido completo del circuito y Zigzag + 8 + detención + arranque", "Evaluación final del curso básico"], isEvaluation: true}
            ];
        }

        // MANUAL 12H
        if (type === 'manual-12h') {
            return [
                { number: 1, content: ["Presentación del vehículo manual.", "Chequeo rutinario (luces, líquidos, llantas, frenos).", "Ajuste de asiento, espejos, cinturón de seguridad.", "Encendido y funciones básicas del tablero.", "Explicación de pedales (embrague, freno, acelerador).", "Arranque en primera marcha y frenado suave."] },
                { number: 2, content: ["Dominio de la palanca de cambios (1ª a 3ª).", "Giros simples con embrague y direccionales.", "Primer contacto con estacionamiento de frente."] },
                { number: 3, content: ["Estacionamientos lateral y reversa.", "Uso de retrovisores.", "Cruces en intersecciones."] },
                { number: 4, content: ["Dominio de paradas y arranques en pendiente.", "Frenado de emergencia y control de tracción.", "Retroceso en línea recta."] },
                { number: 5, content: ["Perfeccionamiento de conducción en circuito.", "Cruces complejos y prioridad de paso.", "Maniobras de precisión en espacios reducidos."] },
                { number: 6, content: ["Repaso integral de maniobras y estacionamiento.", "Evaluación avanzada de habilidades prácticas.", "Resultados y recomendaciones finales."], isEvaluation: true }
            ];
        }

        // MANUAL 10H
        if (type === 'manual-10h') {
            return [
                { number: 1, content: ["Presentación del vehículo manual.", "Chequeo rutinario (luces, líquidos, llantas, frenos).", "Ajuste de asiento, espejos, cinturón de seguridad.", "Encendido y funciones básicas del tablero.", "Explicación de pedales (embrague, freno, acelerador).", "Arranque en primera marcha y frenado suave."] },
                { number: 2, content: ["Dominio de la palanca de cambios (1ª a 3ª).", "Giros simples con embrague y direccionales.", "Primer contacto con estacionamiento de frente."] },
                { number: 3, content: ["Estacionamiento lateral y en reversa.", "Uso de espejos en maniobras de giro.", "Cruces simples e intersecciones."] },
                { number: 4, content: ["Control de paradas y arranque en pendiente.", "Frenado de emergencia.", "Circulación continua en el circuito."] },
                { number: 5, content: ["Recorrido completo integrando todas las maniobras.", "Evaluación práctica final.", "Firma de aprobación de competencias."], isEvaluation: true }
            ];
        }

        // MANUAL 8H
        if (type === 'manual-8h') {
            return [
                { number: 1, content: ["Presentación del vehículo manual.", "Chequeo rutinario (luces, líquidos, llantas, frenos).", "Ajuste de asiento, espejos, cinturón de seguridad.", "Encendido y funciones básicas del tablero.", "Explicación de pedales (embrague, freno, acelerador).", "Arranque en primera marcha y frenado suave."] },
                { number: 2, content: ["Dominio de la palanca de cambios (1ª a 3ª).", "Giros simples con embrague y direccionales.", "Primer contacto con estacionamiento de frente."] },
                { number: 3, content: ["Estacionamientos lateral y reversa.", "Uso de retrovisores.", "Cruces en intersecciones."] },
                { number: 4, content: ["Repaso de estacionamientos.", "Cambios hasta 3ª marcha con fluidez.", "Evaluación práctica: arranque, estacionar, giros e intersecciones."], isEvaluation: true }
            ];
        }

        return []; 
    };

    const AlreadyKnowTemplate = () => {
        const details = contract?.autoMotoDetails;
        const isCommercial = details?.licenseCategory === 'A, C, D';
        const isAutomatic = details?.vehicleTransmission === 'Automático';

        return (
            <div className="w-[8.5in] h-[11in] mx-auto p-10 font-sans text-black bg-white flex flex-col overflow-hidden">
                <div className="text-center mb-6 border-b-2 border-black pb-3">
                    <h1 className="text-xl font-black uppercase tracking-widest">FREEWAY ESCUELA DE MANEJO</h1>
                    <h2 className="text-lg font-bold uppercase mt-1">BITÁCORA - YA SE MANEJAR</h2>
                </div>

                <div className="space-y-4 text-[10pt] flex-1">
                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex border-b border-black pb-1">
                            <span className="font-black w-36">NOMBRE:</span>
                            <span className="font-bold uppercase flex-1">{name}</span>
                        </div>
                        <div className="flex border-b border-black pb-1">
                            <span className="font-black w-36">CÉDULA / PASS:</span>
                            <span className="font-bold flex-1">{idNumber}</span>
                        </div>
                        <div className="flex border-b border-black pb-1">
                            <span className="font-black w-36 text-blue-700">INSTRUCTOR ASIGNADO:</span>
                            <span className="font-bold flex-1 uppercase text-primary">{generalInstructor}</span>
                        </div>
                        
                        <div className="flex items-center gap-8 py-1">
                            <span className="font-black w-32">CATEGORÍA:</span>
                            <div className="flex items-center gap-2">
                                <div className={cn("w-4 h-4 border border-black flex items-center justify-center", !isCommercial && "bg-black")}><span className="text-white text-[8pt]">{!isCommercial ? 'X' : ''}</span></div>
                                <span className="text-[9pt] font-bold">A, C (Particular)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={cn("w-4 h-4 border border-black flex items-center justify-center", isCommercial && "bg-black")}><span className="text-white text-[8pt]">{isCommercial ? 'X' : ''}</span></div>
                                <span className="text-[9pt] font-bold">A, C, D (Comercial)</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-8 py-1">
                            <span className="font-black w-32">TRANSMISIÓN:</span>
                            <div className="flex items-center gap-2">
                                <div className={cn("w-4 h-4 border border-black flex items-center justify-center", isAutomatic && "bg-black")}><span className="text-white text-[8pt]">{isAutomatic ? 'X' : ''}</span></div>
                                <span className="text-[9pt] font-bold uppercase">Automática</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={cn("w-4 h-4 border border-black flex items-center justify-center", !isAutomatic && "bg-black")}><span className="text-white text-[8pt]">{!isAutomatic ? 'X' : ''}</span></div>
                                <span className="text-[9pt] font-bold uppercase">Manual</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 space-y-4">
                        <div className="flex items-center gap-8">
                            <span className="font-black uppercase">¿USÓ EL CINTURÓN DE SEGURIDAD?</span>
                            <div className="flex gap-6">
                                <div className="flex items-center gap-2"><div className="w-4 h-4 border border-black"></div><span className="font-bold">SI</span></div>
                                <div className="flex items-center gap-2"><div className="w-4 h-4 border border-black"></div><span className="font-bold">NO</span></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <span className="font-black uppercase underline text-[9pt]">OBSERVACIÓN DEL INSTRUCTOR:</span>
                            <div className="space-y-5 pt-1">
                                <div className="border-b border-black border-dashed h-4"></div>
                                <div className="border-b border-black border-dashed h-4"></div>
                                <div className="border-b border-black border-dashed h-4"></div>
                                <div className="border-b border-black border-dashed h-4"></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <span className="font-black uppercase underline text-[9pt]">TIEMPO DE ESTACIONAMIENTO:</span>
                            <div className="space-y-5 pt-1">
                                <div className="border-b border-black border-dashed h-4"></div>
                                <div className="border-b border-black border-dashed h-4"></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 pt-4">
                            <div className="space-y-2">
                                <span className="font-black uppercase block text-[9pt]">¿NECESITA AFIANZAMIENTO?</span>
                                <div className="flex gap-6">
                                    <div className="flex items-center gap-2"><div className="w-4 h-4 border border-black"></div><span className="font-bold">SI</span></div>
                                    <div className="flex items-center gap-2"><div className="w-4 h-4 border border-black"></div><span className="font-bold">NO</span></div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="font-black uppercase block text-[8pt]">HORAS RECOMENDADAS:</span>
                                <div className="border-b-2 border-black h-6"></div>
                            </div>
                        </div>

                        <div className="flex justify-center gap-16 pt-8">
                            <div className="flex items-center gap-2"><div className="w-6 h-6 border-2 border-black"></div><span className="font-black text-[11pt] uppercase">APROBADO</span></div>
                            <div className="flex items-center gap-2"><div className="w-6 h-6 border-2 border-black"></div><span className="font-black text-[11pt] uppercase">REPROBADO</span></div>
                        </div>

                        <div className="pt-16 flex justify-around">
                            <div className="w-56 text-center">
                                <div className="border-t-2 border-black mb-1"></div>
                                <span className="font-black uppercase text-[7pt]">Firma del Estudiante</span>
                            </div>
                            <div className="w-56 text-center">
                                <div className="border-t-2 border-black mb-1"></div>
                                <span className="font-black uppercase text-[7pt]">Firma del Instructor</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="text-[6pt] text-slate-400 font-bold uppercase text-center mt-4">FREEWAY ESCUELA DE MANEJO • PÁGINA 1/1</div>
            </div>
        );
    };

    const classes = getClasses();
    const needsEvaluationSection = (type.includes('8h') || type.includes('10h') || type.includes('12h'));

    return (
        <div className="bg-white min-h-screen">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: letter portrait; margin: 0; }
                    body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
                    .print-ui-element { display: none !important; }
                    .print-container-wrapper { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                    #log-to-print {
                        width: 8.5in !important;
                        height: 11in !important;
                        padding: 0.4in !important;
                        display: flex !important;
                        flex-direction: column !important;
                        overflow: hidden !important;
                        page-break-after: avoid !important;
                    }
                }
            `}} />

            <div className="print-ui-element p-4 sticky top-0 z-[100] bg-slate-50 border-b shadow-lg">
                <div className="max-w-4xl mx-auto flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-blue-800 bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-[10px] font-bold uppercase text-center w-full">Formato optimizado para UNA SOLA PÁGINA tamaño carta.</p>
                    </div>
                    {!isReady ? (
                        <div className="bg-slate-200 text-slate-500 p-4 rounded-xl text-center font-black uppercase text-sm flex items-center justify-center gap-3">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Optimizando Bitácora (3s)...
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

            <div id="log-to-print" className="print-container-wrapper bg-white mx-auto w-[8.5in] h-[11in] p-8 flex flex-col overflow-hidden">
                {type === 'already-know' ? (
                    <AlreadyKnowTemplate />
                ) : (
                    <>
                        <div className="text-center mb-4 border-b-2 border-black pb-2">
                            <h1 className="text-lg font-black uppercase tracking-tighter">FREEWAY ESCUELA DE MANEJO S.A.</h1>
                            <h2 className="text-[10pt] font-bold uppercase">{getLogTitle()}</h2>
                        </div>

                        <div className="space-y-1 mb-4 text-[9pt]">
                            <div className="flex border-b border-black pb-0.5">
                                <span className="font-black w-24">NOMBRE:</span>
                                <span className="font-bold uppercase flex-1">{name}</span>
                            </div>
                            <div className="flex border-b border-black pb-0.5">
                                <span className="font-black w-24">ID/PASS:</span>
                                <span className="font-bold flex-1">{idNumber}</span>
                            </div>
                            <div className="flex border-b border-black pb-0.5">
                                <span className="font-black w-36 text-blue-700">INSTRUCTOR ASIGNADO:</span>
                                <span className="font-bold flex-1 uppercase text-primary">{generalInstructor}</span>
                            </div>
                        </div>

                        <table className="w-full border-2 border-black border-collapse flex-1">
                            <tbody>
                                {classes.map((cls) => (
                                    <React.Fragment key={cls.number}>
                                        <tr className="border-b-2 border-black">
                                            <td className="border-r-2 border-black p-1.5 w-16 text-center font-black text-[8pt] align-middle bg-slate-50">Sesión {cls.number}</td>
                                            <td className="border-r-2 border-black p-2 align-top leading-tight text-[7.5pt]">
                                                <ul className={cn("space-y-0.5 list-disc pl-4", cls.isEvaluation && "font-black")}>
                                                    {cls.content.map((item, cIdx) => <li key={cIdx}>{item}</li>)}
                                                </ul>
                                            </td>
                                            <td className="p-1 align-top text-[6pt] font-black text-slate-300 uppercase w-32 text-right">ESPACIO PARA OBSERVACIÓN</td>
                                        </tr>
                                        <tr className="border-b-2 last:border-b-0 border-black h-7 bg-slate-50/50">
                                            <td colSpan={2} className="px-2 text-[7.5pt] font-bold uppercase italic">Firma Alumno: _________________________</td>
                                            <td className="px-2 text-[7.5pt] font-bold uppercase italic text-right">Firma Inst: __________</td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>

                        {needsEvaluationSection && (
                            <div className="mt-3 border-t-2 border-black pt-2">
                                <h3 className="font-black text-[8pt] uppercase mb-1">OBSERVACIONES FINALES / RECOMENDACIONES:</h3>
                                <div className="border-b border-black border-dashed h-5"></div>
                                <div className="border-b border-black border-dashed h-5"></div>
                            </div>
                        )}

                        <div className="mt-4 text-[6pt] text-slate-400 font-bold uppercase text-center tracking-[0.2em] border-t pt-1">
                            FREEWAY ESCUELA DE MANEJO • DOCUMENTO DE CONTROL INTERNO • PÁGINA 1/1
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function PrintLogPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-bold">INICIANDO...</div>}>
            <LogbookContent />
        </Suspense>
    );
}
