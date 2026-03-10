'use client';

import React from 'react';
import type { Contract } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ATTstandardTemplateProps {
    contract: Contract;
}

const EmptyBox = () => <div className="w-6 h-4 border border-slate-400 rounded-sm"></div>;

export function ATTstandardTemplate({ contract }: ATTstandardTemplateProps) {
    const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
    const studentName = contract.clientName || "";
    const studentId = details?.studentIdNumber || contract.studentIdNumber || "";
    const category = details?.licenseCategory || "";

    const recommendations = [
        "1. Uso el cinturón de seguridad.",
        "2. Dio el encendido del auto.",
        "3. Hizo los cambios de marcha.",
        "4. Hizo uso de los frenos correctamente.",
        "5. Aplico la maniobralidad en el timón.",
        "6. Hizo uso de los espejos retrovisores.",
        "7. Hizo uso de las luces direccionales.",
        "8. Mantuvo la distancia de seguimiento.",
        "9. Controló la velocidad.",
        "10. Respeto las señales de tránsito.",
        "11. Ejecutó la maniobra al estacionarse.",
        "12. Mantuvo la presección del riesgo.",
        "13. Mantuvo la calma y demostró confianza."
    ];

    return (
        <div className="w-[8.5in] h-[11in] bg-white p-[0.4in] font-sans text-black flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-start mb-1.5">
                <div className="flex flex-col">
                    <h1 className="font-black text-lg uppercase tracking-tighter leading-none text-black">FREEWAY</h1>
                    <p className="text-[5pt] font-bold text-black uppercase tracking-[0.2em] -mt-1">E S C U E L A D E M A N E J O</p>
                </div>
                <div className="text-center flex-1">
                    <h2 className="font-black text-[9pt] uppercase tracking-tight">FREEWAY ESCUELA DE MANEJO S.A.</h2>
                    <h3 className="font-bold text-[8pt] uppercase">Constancia de evaluación</h3>
                    <p className="text-[6pt] font-bold italic mt-0.5">Dando cumplimiento al Artículo Vigésimo Tercero del Resuelto #380 del 04 de diciembre de 2000</p>
                </div>
                <div className="w-16"></div>
            </div>

            {/* Datos Alumno */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3 mt-1.5">
                <div className="flex gap-1.5 border-b border-black pb-0.5">
                    <span className="text-[7pt] font-medium whitespace-nowrap">Nombre del estudiante:</span>
                    <span className="text-[7pt] font-bold uppercase flex-1 truncate">{studentName}</span>
                </div>
                <div className="flex gap-1.5 border-b border-black pb-0.5">
                    <span className="text-[7pt] font-medium whitespace-nowrap">Cédula:</span>
                    <span className="text-[7pt] font-bold flex-1">{studentId}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 col-span-2">
                    <div className="flex gap-1.5 border-b border-black pb-0.5">
                        <span className="text-[7pt] font-medium">Categoría:</span>
                        <span className="text-[7pt] font-bold flex-1">{category}</span>
                    </div>
                    <div className="flex gap-1.5 border-b border-black pb-0.5">
                        <span className="text-[7pt] font-medium">Tipo de vehículo:</span>
                        <span className="text-[7pt] font-bold flex-1">_________________</span>
                    </div>
                    <div className="flex gap-1.5 border-b border-black pb-0.5">
                        <span className="text-[7pt] font-medium">Placa:</span>
                        <span className="text-[7pt] font-bold flex-1">_________________</span>
                    </div>
                </div>
            </div>

            {/* Tabla Clases Teóricas */}
            <div className="mb-3">
                <p className="text-center font-black text-[6.5pt] uppercase mb-0.5">CLASES TEÓRICAS ASISTENCIA</p>
                <table className="w-full border-collapse border border-black text-[5.5pt]">
                    <thead>
                        <tr className="bg-slate-50 font-bold">
                            <th className="border border-black p-0.5 w-16">1° Semana</th>
                            <th className="border border-black p-0.5">LUNES</th>
                            <th className="border border-black p-0.5">MARTES</th>
                            <th className="border border-black p-0.5">MIÉRCOLES</th>
                            <th className="border border-black p-0.5">JUEVES</th>
                            <th className="border border-black p-0.5">VIERNES</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5 w-16 leading-tight">TOTAL DE HORAS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {['FECHA', 'HORARIO', 'HORAS POR DÍA', 'FIRMA'].map((label) => (
                            <tr key={label} className="h-5">
                                <td className="border border-black px-1.5 font-bold bg-slate-50">{label}</td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold border-t border-black">
                            <th className="border border-black p-0.5">2° Semana</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5 leading-tight">TOTAL DE HORAS</th>
                        </tr>
                        {['FECHA', 'HORARIO', 'HORAS POR DÍA', 'FIRMA'].map((label) => (
                            <tr key={`2-${label}`} className="h-5">
                                <td className="border border-black px-1.5 font-bold bg-slate-50">{label}</td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-3 border-b border-black pb-0.5 mb-3 max-w-xl">
                <span className="text-[7.5pt] font-medium">Instructor teórico:</span>
                <span className="text-[7.5pt] font-bold flex-1">__________________________________________________________________________</span>
            </div>

            {/* Actitud Evaluada */}
            <div className="flex justify-center gap-10 mb-3">
                <span className="font-black text-[7.5pt] uppercase">Actitud Evaluada</span>
                <div className="flex items-center gap-1.5">
                    <div className="w-8 h-4 border border-black"></div>
                    <span className="text-[7.5pt] font-bold uppercase">Aprobado</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-8 h-4 border border-black"></div>
                    <span className="text-[7.5pt] font-bold uppercase">Reprobado</span>
                </div>
            </div>

            {/* Recomendaciones */}
            <div className="grid grid-cols-2 gap-x-10 mb-3 px-3">
                <div className="space-y-0.5">
                    <p className="text-[6.5pt] font-bold italic mb-0.5">Recomendaciones</p>
                    {recommendations.slice(0, 7).map(rec => (
                        <div key={rec} className="flex items-center justify-between gap-3">
                            <span className="text-[7pt]">{rec}</span>
                            <div className="w-8 h-3.5 border border-slate-400"></div>
                        </div>
                    ))}
                </div>
                <div className="space-y-0.5 pt-4">
                    {recommendations.slice(7).map(rec => (
                        <div key={rec} className="flex items-center justify-between gap-3">
                            <span className="text-[7pt]">{rec}</span>
                            <div className="w-8 h-3.5 border border-slate-400"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabla Prácticas */}
            <div className="mt-auto">
                <p className="text-center font-black text-[6.5pt] uppercase mb-0.5">DÍAS DE CLASES PRACTICAS</p>
                <table className="w-full border-collapse border border-black text-[6pt]">
                    <thead>
                        <tr className="bg-slate-50 font-bold">
                            <th rowSpan={2} className="border border-black p-0.5 w-24"></th>
                            <th colSpan={2} className="border border-black p-0.5 text-center">FECHA</th>
                            <th colSpan={2} className="border border-black p-0.5 text-center">HORARIO</th>
                            <th rowSpan={2} className="border border-black p-0.5 w-16">HORAS</th>
                        </tr>
                        <tr className="bg-slate-50 font-bold">
                            <th className="border border-black p-0.5">1° SEMANA</th>
                            <th className="border border-black p-0.5">2° SEMANA</th>
                            <th className="border border-black p-0.5">1° SEMANA</th>
                            <th className="border border-black p-0.5">2° SEMANA</th>
                        </tr>
                    </thead>
                    <tbody>
                        {['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'].map(day => (
                            <tr key={day} className="h-4">
                                <td className="border border-black px-1.5 font-bold bg-slate-50">{day}</td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                            </tr>
                        ))}
                        <tr>
                            <td colSpan={5} className="border border-black px-1.5 text-right font-black uppercase bg-slate-50 p-0.5 text-[6pt]">EVALUACIÓN FINAL</td>
                            <td className="border border-black p-0.5"></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Firmas */}
            <div className="mt-5 space-y-5">
                <div className="flex gap-3 border-b border-black pb-0.5">
                    <span className="text-[7.5pt] font-medium whitespace-nowrap">Instructor Práctico:</span>
                    <span className="text-[7.5pt] font-bold flex-1">__________________________________________________________________________</span>
                </div>
                <div className="flex gap-3 border-b border-black pb-0.5">
                    <span className="text-[7.5pt] font-medium whitespace-nowrap">Firma del estudiante:</span>
                    <span className="text-[7.5pt] font-bold flex-1">__________________________________________________________________________</span>
                </div>
            </div>
        </div>
    );
}