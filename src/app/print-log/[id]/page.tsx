'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
                margin: [0.3, 0.7, 0.3, 0.3], // Top, Left (40% extra), Bottom, Right
                filename: `Bitacora_${idNumber || 'S-N'}_${name.replace(/\s+/g, '_')}.pdf`,
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
                <div className="max-w-[8.5in] mx-auto p-10 font-sans text-[9.5pt] text-black">
                    {/* HEADER */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                                <span className="font-black text-2xl tracking-tighter leading-none">FW FREEWAY</span>
                                <span className="text-[7pt] font-bold uppercase tracking-[0.2em] -mt-1">Escuela de Manejo</span>
                            </div>
                        </div>
                        <div className="text-center flex-1">
                            <h1 className="font-black text-2xl uppercase tracking-widest">BITÁCORA-MANUAL</h1>
                            <p className="text-[10pt] font-bold uppercase">CLASES PRÁCTICAS-12 HORAS</p>
                        </div>
                        <div className="w-24"></div>
                    </div>

                    {/* STUDENT INFO */}
                    <div className="flex items-end gap-4 mb-6">
                        <div className="flex flex-1 items-end gap-2">
                            <span className="font-black text-[10pt]">NOMBRE:</span>
                            <div className="flex-1 border-b-2 border-black px-2 py-0.5 font-bold uppercase text-lg">{name}</div>
                        </div>
                        <div className="flex items-end gap-2 w-1/3">
                            <span className="font-black text-[10pt]">CÉDULA/PASS:</span>
                            <div className="flex-1 border-b-2 border-black px-2 py-0.5 font-bold text-lg">{idNumber}</div>
                        </div>
                    </div>

                    {/* TABLE */}
                    <table className="w-full border-2 border-black border-collapse">
                        <tbody>
                            {/* CLASE 1 */}
                            <tr className="border-b-2 border-black h-40">
                                <td className="border-r-2 border-black p-2 w-24 text-center font-black text-sm align-middle">Clase N°1</td>
                                <td className="border-r-2 border-black p-3 align-top leading-tight text-[9pt]">
                                    <ol className="space-y-0.5 list-decimal pl-4">
                                        <li>Presentación del vehículo manual.</li>
                                        <li>Chequeo rutinario (luces, líquidos, llantas, frenos).</li>
                                        <li>Ajuste de asiento, espejos, cinturón de seguridad.</li>
                                        <li>Encendido y funciones básicas del tablero.</li>
                                        <li>Explicación de pedales (embrague, freno, acelerador).</li>
                                        <li>Arranque en primera marcha y frenado suave.</li>
                                    </ol>
                                </td>
                                <td className="p-2 align-top text-xs font-bold text-slate-400 uppercase">Observación</td>
                            </tr>
                            <tr className="border-b-2 border-black h-8 bg-slate-50">
                                <td colSpan={2} className="px-3 text-[8pt] font-black uppercase">Asistencia del Estudiante: _________________________</td>
                                <td className="px-3 text-[8pt] font-black uppercase">Instructor: _________________________</td>
                            </tr>

                            {/* CLASE 2 */}
                            <tr className="border-b-2 border-black h-32">
                                <td className="border-r-2 border-black p-2 text-center font-black text-sm align-middle">Clase N°2</td>
                                <td className="border-r-2 border-black p-3 align-top leading-tight text-[9pt]">
                                    <ol className="space-y-0.5 list-decimal pl-4">
                                        <li>Dominio de la palanca de cambios (1ª a 3ª).</li>
                                        <li>Giros simples con embrague y direccionales.</li>
                                        <li>Primer contacto con estacionamiento de frente.</li>
                                    </ol>
                                </td>
                                <td className="p-2 align-top text-xs font-bold text-slate-400 uppercase">Observación</td>
                            </tr>
                            <tr className="border-b-2 border-black h-8 bg-slate-50">
                                <td colSpan={2} className="px-3 text-[8pt] font-black uppercase">Asistencia del Estudiante: _________________________</td>
                                <td className="px-3 text-[8pt] font-black uppercase">Instructor: _________________________</td>
                            </tr>

                            {/* CLASE 3 */}
                            <tr className="border-b-2 border-black h-32">
                                <td className="border-r-2 border-black p-2 text-center font-black text-sm align-middle">Clase N°3</td>
                                <td className="border-r-2 border-black p-3 align-top leading-tight text-[9pt]">
                                    <ol className="space-y-0.5 list-decimal pl-4">
                                        <li>Estacionamientos lateral y reversa.</li>
                                        <li>Uso de retrovisores.</li>
                                        <li>Cruces en intersecciones.</li>
                                    </ol>
                                </td>
                                <td className="p-2 align-top text-xs font-bold text-slate-400 uppercase">Observación</td>
                            </tr>
                            <tr className="border-b-2 border-black h-8 bg-slate-50">
                                <td colSpan={2} className="px-3 text-[8pt] font-black uppercase">Asistencia del Estudiante: _________________________</td>
                                <td className="px-3 text-[8pt] font-black uppercase">Instructor: _________________________</td>
                            </tr>

                            {/* CLASE 4 */}
                            <tr className="border-b-2 border-black h-32">
                                <td className="border-r-2 border-black p-2 text-center font-black text-sm align-middle">Clase N°4</td>
                                <td className="border-r-2 border-black p-3 align-top leading-tight text-[9pt]">
                                    <ol className="space-y-0.5 list-decimal pl-4">
                                        <li>Dominio de paradas.</li>
                                        <li>Arranque en pendiente con embrague.</li>
                                        <li>Frenado de emergencia.</li>
                                    </ol>
                                </td>
                                <td className="p-2 align-top text-xs font-bold text-slate-400 uppercase">Observación</td>
                            </tr>
                            <tr className="border-b-2 border-black h-8 bg-slate-50">
                                <td colSpan={2} className="px-3 text-[8pt] font-black uppercase">Asistencia del Estudiante: _________________________</td>
                                <td className="px-3 text-[8pt] font-black uppercase">Instructor: _________________________</td>
                            </tr>

                            {/* CLASE 5 */}
                            <tr className="border-b-2 border-black h-32">
                                <td className="border-r-2 border-black p-2 text-center font-black text-sm align-middle">Clase N°5</td>
                                <td className="border-r-2 border-black p-3 align-top leading-tight text-[9pt]">
                                    <ol className="space-y-0.5 list-decimal pl-4">
                                        <li>Perfeccionamiento de cambios (1ª a 3ª).</li>
                                        <li>Cruces más complejos (en "T" y 4 vías).</li>
                                        <li>Maniobras avanzadas de estacionamiento.</li>
                                    </ol>
                                </td>
                                <td className="p-2 align-top text-xs font-bold text-slate-400 uppercase">Observación</td>
                            </tr>
                            <tr className="border-b-2 border-black h-8 bg-slate-50">
                                <td colSpan={2} className="px-3 text-[8pt] font-black uppercase">Asistencia del Estudiante: _________________________</td>
                                <td className="px-3 text-[8pt] font-black uppercase">Instructor: _________________________</td>
                            </tr>

                            {/* CLASE 6 */}
                            <tr className="border-b-2 border-black h-32">
                                <td className="border-r-2 border-black p-2 text-center font-black text-sm align-middle">Clase N°6</td>
                                <td className="border-r-2 border-black p-3 align-top leading-tight text-[9pt]">
                                    <ol className="space-y-0.5 list-decimal pl-4">
                                        <li>
                                            <strong>Repaso integral + evaluación avanzada:</strong>
                                            <ul className="list-disc pl-4 mt-1">
                                                <li>Arranque en pendiente, dominio de marchas, estacionamientos y cruces.</li>
                                            </ul>
                                        </li>
                                    </ol>
                                </td>
                                <td className="p-2 align-top text-xs font-bold text-slate-400 uppercase">Observación</td>
                            </tr>
                            <tr className="h-8 bg-slate-50">
                                <td colSpan={2} className="px-3 text-[8pt] font-black uppercase">Asistencia del Estudiante: _________________________</td>
                                <td className="px-3 text-[8pt] font-black uppercase">Instructor: _________________________</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="mt-8 text-[7pt] text-slate-400 font-bold uppercase text-center tracking-widest">
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
