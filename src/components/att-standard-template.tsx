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
        <div className="w-[8.5in] h-[11in] bg-white p-[0.25in] font-sans text-black flex flex-col overflow-hidden box-border">
            {/* Header */}
            <div className="flex justify-between items-start mb-1">
                <div className="flex flex-col">
                    <h1 className="font-black text-lg uppercase tracking-tighter leading-none text-black">FREEWAY</h1>
                    <p className="text-[4.5pt] font-bold text-black uppercase tracking-[0.2em] -mt-0.5">E S C U E L A D E M A N E J O</p>
                </div>
                <div className="text-center flex-1 pt-0.5">
                    <h2 className="font-black text-[8.5pt] uppercase tracking-tight leading-none">FREEWAY ESCUELA DE MANEJO S.A.</h2>
                    <h3 className="font-bold text-[7pt] uppercase mt-0.5">Constancia de evaluación</h3>
                    <p className="text-[5pt] font-bold italic mt-0.5">Dando cumplimiento al Artículo Vigésimo Tercero del Resuelto #380 del 04 de diciembre de 2000</p>
                </div>
                <div className="w-12"></div>
            </div>

            {/* Datos Alumno */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-1.5 mt-0.5">
                <div className="flex gap-1 border-b border-black pb-0.5">
                    <span className="text-[6.5pt] font-medium whitespace-nowrap">Estudiante:</span>
                    <span className="text-[6.5pt] font-bold uppercase flex-1 truncate">{studentName}</span>
                </div>
                <div className="flex gap-1 border-b border-black pb-0.5">
                    <span className="text-[6.5pt] font-medium whitespace-nowrap">Cédula:</span>
                    <span className="text-[6.5pt] font-bold flex-1">{studentId}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 col-span-2">
                    <div className="flex gap-1 border-b border-black pb-0.5">
                        <span className="text-[6.5pt] font-medium">Categoría:</span>
                        <span className="text-[6.5pt] font-bold flex-1">{category}</span>
                    </div>
                    <div className="flex gap-1 border-b border-black pb-0.5">
                        <span className="text-[6.5pt] font-medium">Vehículo:</span>
                        <span className="text-[6.5pt] font-bold flex-1">_________________</span>
                    </div>
                    <div className="flex gap-1 border-b border-black pb-0.5">
                        <span className="text-[6.5pt] font-medium">Placa:</span>
                        <span className="text-[6.5pt] font-bold flex-1">_________________</span>
                    </div>
                </div>
            </div>

            {/* Tabla Clases Teóricas */}
            <div className="mb-1.5">
                <p className="text-center font-black text-[5.5pt] uppercase mb-0.5">CLASES TEÓRICAS ASISTENCIA</p>
                <table className="w-full border-collapse border border-black text-[4.5pt]">
                    <thead>
                        <tr className="bg-slate-50 font-bold h-3">
                            <th className="border border-black p-0.5 w-14">1° Semana</th>
                            <th className="border border-black p-0.5">LUNES</th>
                            <th className="border border-black p-0.5">MARTES</th>
                            <th className="border border-black p-0.5">MIÉRCOLES</th>
                            <th className="border border-black p-0.5">JUEVES</th>
                            <th className="border border-black p-0.5">VIERNES</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5 w-12">TOTAL HRS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {['FECHA', 'HORARIO', 'HRS DÍA', 'FIRMA'].map((label) => (
                            <tr key={label} className="h-3">
                                <td className="border border-black px-1 font-bold bg-slate-50">{label}</td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold border-t border-black h-3">
                            <th className="border border-black p-0.5">2° Semana</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5">SÁBADO</th>
                            <th className="border border-black p-0.5">TOTAL HRS</th>
                        </tr>
                        {['FECHA', 'HORARIO', 'HRS DÍA', 'FIRMA'].map((label) => (
                            <tr key={`2-${label}`} className="h-3">
                                <td className="border border-black px-1 font-bold bg-slate-50">{label}</td>
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

            <div className="flex gap-2 border-b border-black pb-0.5 mb-1.5 max-w-sm">
                <span className="text-[6.5pt] font-medium">Instructor teórico:</span>
                <span className="text-[6.5pt] font-bold flex-1">________________________________________</span>
            </div>

            {/* Actitud Evaluada */}
            <div className="flex justify-center gap-6 mb-1.5">
                <span className="font-black text-[6.5pt] uppercase">Actitud Evaluada</span>
                <div className="flex items-center gap-1">
                    <div className="w-5 h-3 border border-black rounded-sm"></div>
                    <span className="text-[6.5pt] font-bold uppercase">Aprobado</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-5 h-3 border border-black rounded-sm"></div>
                    <span className="text-[6.5pt] font-bold uppercase">Reprobado</span>
                </div>
            </div>

            {/* Recomendaciones */}
            <div className="grid grid-cols-2 gap-x-6 mb-1.5 px-1">
                <div className="space-y-0.5">
                    <p className="text-[5.5pt] font-bold italic mb-0.5 uppercase">Evaluación de Competencias</p>
                    {recommendations.slice(0, 7).map(rec => (
                        <div key={rec} className="flex items-center justify-between gap-2 border-b border-dotted border-slate-200">
                            <span className="text-[6pt]">{rec}</span>
                            <div className="w-5 h-2.5 border border-slate-400 rounded-sm"></div>
                        </div>
                    ))}
                </div>
                <div className="space-y-0.5 pt-3">
                    {recommendations.slice(7).map(rec => (
                        <div key={rec} className="flex items-center justify-between gap-2 border-b border-dotted border-slate-200">
                            <span className="text-[6pt]">{rec}</span>
                            <div className="w-5 h-2.5 border border-slate-400 rounded-sm"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabla Prácticas */}
            <div className="mt-0.5">
                <p className="text-center font-black text-[5.5pt] uppercase mb-0.5">DÍAS DE CLASES PRACTICAS</p>
                <table className="w-full border-collapse border border-black text-[5pt]">
                    <thead>
                        <tr className="bg-slate-50 font-bold h-3">
                            <th rowSpan={2} className="border border-black p-0.5 w-16"></th>
                            <th colSpan={2} className="border border-black p-0.5 text-center">FECHA</th>
                            <th colSpan={2} className="border border-black p-0.5 text-center">HORARIO</th>
                            <th rowSpan={2} className="border border-black p-0.5 w-12">HRS</th>
                        </tr>
                        <tr className="bg-slate-50 font-bold h-3">
                            <th className="border border-black p-0.5">1° SEMANA</th>
                            <th className="border border-black p-0.5">2° SEMANA</th>
                            <th className="border border-black p-0.5">1° SEMANA</th>
                            <th className="border border-black p-0.5">2° SEMANA</th>
                        </tr>
                    </thead>
                    <tbody>
                        {['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'].map(day => (
                            <tr key={day} className="h-3">
                                <td className="border border-black px-1 font-bold bg-slate-50">{day}</td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black"></td>
                            </tr>
                        ))}
                        <tr className="h-3">
                            <td colSpan={5} className="border border-black px-1 text-right font-black uppercase bg-slate-50 p-0.5 text-[5pt]">EVALUACIÓN FINAL PRÁCTICA</td>
                            <td className="border border-black p-0.5"></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Firmas */}
            <div className="mt-auto space-y-2.5 mb-2">
                <div className="flex gap-2 border-b border-black pb-0.5">
                    <span className="text-[6.5pt] font-medium whitespace-nowrap">Instructor Práctico:</span>
                    <span className="text-[6.5pt] font-bold flex-1">________________________________________</span>
                </div>
                <div className="flex gap-2 border-b border-black pb-0.5">
                    <span className="text-[6.5pt] font-medium whitespace-nowrap">Estudiante:</span>
                    <span className="text-[6.5pt] font-bold flex-1">________________________________________</span>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[5pt] text-slate-400 font-bold uppercase tracking-[0.2em] border-t pt-1">
                Control de Calidad Académica • Freeway Escuela de Manejo S.A.
            </div>
        </div>
    );
}
