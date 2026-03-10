
'use client';

import React from 'react';
import type { Contract } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ATTstandardTemplateProps {
    contract: Contract;
}

export function ATTstandardTemplate({ contract }: ATTstandardTemplateProps) {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
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
        <div className="w-[8.5in] h-[11in] bg-white p-[0.3in] font-sans text-black flex flex-col overflow-hidden box-border">
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                    <h1 className="font-black text-xl uppercase tracking-tighter leading-none text-black">FREEWAY</h1>
                    <p className="text-[5pt] font-bold text-black uppercase tracking-[0.2em] -mt-0.5">E S C U E L A D E M A N E J O</p>
                </div>
                <div className="text-center flex-1 pt-0.5">
                    <h2 className="font-black text-[9.5pt] uppercase tracking-tight leading-none">FREEWAY ESCUELA DE MANEJO S.A.</h2>
                    <h3 className="font-bold text-[8pt] uppercase mt-1">Constancia de evaluación</h3>
                    <p className="text-[5.5pt] font-bold italic mt-1">Dando cumplimiento al Artículo Vigésimo Tercero del Resuelto #380 del 04 de diciembre de 2000</p>
                </div>
                <div className="w-16"></div>
            </div>

            {/* Datos Alumno */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3 mt-1">
                <div className="flex gap-1 border-b border-black pb-1">
                    <span className="text-[7.5pt] font-medium whitespace-nowrap">Estudiante:</span>
                    <span className="text-[7.5pt] font-bold uppercase flex-1 truncate">{studentName}</span>
                </div>
                <div className="flex gap-1 border-b border-black pb-1">
                    <span className="text-[7.5pt] font-medium whitespace-nowrap">Cédula:</span>
                    <span className="text-[7.5pt] font-bold flex-1">{studentId}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 col-span-2">
                    <div className="flex gap-1 border-b border-black pb-1">
                        <span className="text-[7.5pt] font-medium">Categoría:</span>
                        <span className="text-[7.5pt] font-bold flex-1">{category}</span>
                    </div>
                    <div className="flex gap-1 border-b border-black pb-1">
                        <span className="text-[7.5pt] font-medium">Vehículo:</span>
                        <span className="text-[7.5pt] font-bold flex-1">_________________</span>
                    </div>
                    <div className="flex gap-1 border-b border-black pb-1">
                        <span className="text-[7.5pt] font-medium">Placa:</span>
                        <span className="text-[7.5pt] font-bold flex-1">_________________</span>
                    </div>
                </div>
            </div>

            {/* Tabla Clases Teóricas */}
            <div className="mb-3">
                <p className="text-center font-black text-[6.5pt] uppercase mb-1">CLASES TEÓRICAS ASISTENCIA</p>
                <table className="w-full border-collapse border border-black text-[5.5pt]">
                    <thead>
                        <tr className="bg-slate-50 font-bold h-4">
                            <th className="border border-black p-1 w-16">1° Semana</th>
                            <th className="border border-black p-1">LUNES</th>
                            <th className="border border-black p-1">MARTES</th>
                            <th className="border border-black p-1">MIÉRCOLES</th>
                            <th className="border border-black p-1">JUEVES</th>
                            <th className="border border-black p-1">VIERNES</th>
                            <th className="border border-black p-1">SÁBADO</th>
                            <th className="border border-black p-1 w-14">TOTAL HRS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {['FECHA', 'HORARIO', 'HRS DÍA', 'FIRMA'].map((label) => (
                            <tr key={label} className="h-4">
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
                        <tr className="bg-slate-50 font-bold border-t border-black h-4">
                            <th className="border border-black p-1">2° Semana</th>
                            <th className="border border-black p-1">SÁBADO</th>
                            <th className="border border-black p-1">SÁBADO</th>
                            <th className="border border-black p-1">SÁBADO</th>
                            <th className="border border-black p-1">SÁBADO</th>
                            <th className="border border-black p-1">SÁBADO</th>
                            <th className="border border-black p-1">SÁBADO</th>
                            <th className="border border-black p-1">TOTAL HRS</th>
                        </tr>
                        {['FECHA', 'HORARIO', 'HRS DÍA', 'FIRMA'].map((label) => (
                            <tr key={`2-${label}`} className="h-4">
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

            <div className="flex gap-2 border-b border-black pb-1 mb-3 max-w-sm">
                <span className="text-[7.5pt] font-medium">Instructor teórico:</span>
                <span className="text-[7.5pt] font-bold flex-1">________________________________________</span>
            </div>

            {/* Actitud Evaluada */}
            <div className="flex justify-center gap-8 mb-3">
                <span className="font-black text-[7.5pt] uppercase">Actitud Evaluada</span>
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-4 border border-black rounded-sm"></div>
                    <span className="text-[7.5pt] font-bold uppercase">Aprobado</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-4 border border-black rounded-sm"></div>
                    <span className="text-[7.5pt] font-bold uppercase">Reprobado</span>
                </div>
            </div>

            {/* Recomendaciones */}
            <div className="grid grid-cols-2 gap-x-10 mb-3 px-2">
                <div className="space-y-1">
                    <p className="text-[6.5pt] font-bold italic mb-1 uppercase">Evaluación de Competencias</p>
                    {recommendations.slice(0, 7).map(rec => (
                        <div key={rec} className="flex items-center justify-between gap-3 border-b border-dotted border-slate-300">
                            <span className="text-[7pt]">{rec}</span>
                            <div className="w-6 h-3.5 border border-black rounded-sm"></div>
                        </div>
                    ))}
                </div>
                <div className="space-y-1 pt-4">
                    {recommendations.slice(7).map(rec => (
                        <div key={rec} className="flex items-center justify-between gap-3 border-b border-dotted border-slate-300">
                            <span className="text-[7pt]">{rec}</span>
                            <div className="w-6 h-3.5 border border-black rounded-sm"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabla Prácticas */}
            <div className="mt-1">
                <p className="text-center font-black text-[6.5pt] uppercase mb-1">DÍAS DE CLASES PRACTICAS</p>
                <table className="w-full border-collapse border border-black text-[6pt]">
                    <thead>
                        <tr className="bg-slate-50 font-bold h-4">
                            <th rowSpan={2} className="border border-black p-1 w-20"></th>
                            <th colSpan={2} className="border border-black p-1 text-center">FECHA</th>
                            <th colSpan={2} className="border border-black p-1 text-center">HORARIO</th>
                            <th rowSpan={2} className="border border-black p-1 w-16">HRS</th>
                        </tr>
                        <tr className="bg-slate-50 font-bold h-4">
                            <th className="border border-black p-1">1° SEMANA</th>
                            <th className="border border-black p-1">2° SEMANA</th>
                            <th className="border border-black p-1">1° SEMANA</th>
                            <th className="border border-black p-1">2° SEMANA</th>
                        </tr>
                    </thead>
                    <tbody>
                        {['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'].map(day => (
                            <tr key={day} className="h-4">
                                <td className="border border-black px-2 font-bold bg-slate-50">{day}</td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                            </tr>
                        ))}
                        <tr className="h-4">
                            <td colSpan={5} className="border border-black px-2 text-right font-black uppercase bg-slate-50 p-1 text-[6pt]">EVALUACIÓN FINAL PRÁCTICA</td>
                            <td className="border border-black p-1"></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Firmas */}
            <div className="mt-auto space-y-4 mb-4">
                <div className="flex gap-2 border-b border-black pb-1">
                    <span className="text-[7.5pt] font-medium whitespace-nowrap">Instructor Práctico:</span>
                    <span className="text-[7.5pt] font-bold flex-1">________________________________________</span>
                </div>
                <div className="flex gap-2 border-b border-black pb-1">
                    <span className="text-[7.5pt] font-medium whitespace-nowrap">Estudiante:</span>
                    <span className="text-[7.5pt] font-bold flex-1">________________________________________</span>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[6pt] text-slate-400 font-bold uppercase tracking-[0.2em] border-t pt-1.5">
                Control de Calidad Académica • Freeway Escuela de Manejo S.A.
            </div>
        </div>
    );
}
