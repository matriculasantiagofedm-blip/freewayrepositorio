'use client';

import React from 'react';
import type { Contract } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ATTampliacionTemplateProps {
    contract: Contract;
}

const Checkbox = ({ label }: { label: string }) => (
    <div className="flex items-center gap-1">
        <span className="text-[6.5pt] font-medium uppercase">{label}</span>
        <div className="w-4 h-3 border border-blue-800 rounded-sm"></div>
    </div>
);

const CriteriaRow = ({ num, text }: { num: number; text: string }) => (
    <tr className="border-b border-black">
        <td className="p-1 text-[6.5pt] leading-tight border-r border-black">
            <span className="font-bold mr-1">{num}.</span>
            {text}
        </td>
        <td className="p-0 w-14 border-r border-black">
            <div className="flex items-center justify-between px-1">
                <span className="text-[6.5pt] font-bold">Si</span>
                <div className="w-4 h-3 border border-blue-800 rounded-sm"></div>
            </div>
        </td>
        <td className="p-0 w-14">
            <div className="flex items-center justify-between px-1">
                <span className="text-[6.5pt] font-bold">No</span>
                <div className="w-4 h-3 border border-blue-800 rounded-sm"></div>
            </div>
        </td>
    </tr>
);

export function ATTampliacionTemplate({ contract }: ATTampliacionTemplateProps) {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    const studentName = contract.clientName || "";
    const studentId = details?.studentIdNumber || contract.studentIdNumber || "";
    
    return (
        <div className="w-[8.5in] h-[11in] bg-white p-[0.25in] font-sans text-black flex flex-col overflow-hidden box-border">
            {/* Header */}
            <div className="flex justify-between items-start mb-1">
                <div className="flex flex-col">
                    <h1 className="font-black text-lg uppercase tracking-tighter leading-none text-black">FREEWAY</h1>
                    <p className="text-[4.5pt] font-bold text-black uppercase tracking-[0.2em] -mt-0.5">E S C U E L A D E M A N E J O</p>
                </div>
                <div className="text-center flex-1 pt-0.5">
                    <h2 className="font-black text-[9pt] uppercase tracking-tight">FREEWAY ESCUELA DE MANEJO S.A.</h2>
                    <h3 className="font-bold text-[7.5pt] uppercase mt-0.5">Constancia de Evaluación Práctica Ampliaciones</h3>
                </div>
                <div className="border border-black p-1 px-2 rounded-sm flex items-center gap-1">
                    <span className="text-[6pt] font-bold">Fecha:</span>
                    <span className="border-b border-black w-16 h-3 inline-block text-[6pt] text-center">
                        {format(new Date(), 'dd/MM/yyyy')}
                    </span>
                </div>
            </div>

            {/* Datos Alumno */}
            <div className="space-y-0.5 mb-1.5">
                <div className="flex gap-2 border-b border-black pb-0.5">
                    <span className="text-[7pt] font-medium whitespace-nowrap">Nombre del estudiante:</span>
                    <span className="text-[7pt] font-bold uppercase flex-1 truncate">{studentName}</span>
                    <span className="text-[7pt] font-medium whitespace-nowrap ml-2">Cédula:</span>
                    <span className="text-[7pt] font-bold w-32">{studentId}</span>
                </div>
                <div className="flex gap-2 border-b border-black pb-0.5">
                    <span className="text-[7pt] font-medium whitespace-nowrap">Tipo de vehículo:</span>
                    <span className="text-[7pt] font-bold uppercase flex-1">________________________________________</span>
                    <span className="text-[7pt] font-medium whitespace-nowrap ml-2">Placa:</span>
                    <span className="text-[7pt] font-bold w-32">____________________</span>
                </div>
            </div>

            {/* Categorías */}
            <div className="border border-blue-800 p-1 py-1.5 rounded-sm flex items-center justify-between mb-1.5">
                <span className="font-black text-[7.5pt] uppercase tracking-wider">Categorías:</span>
                <div className="flex gap-4">
                    <Checkbox label="B" />
                    <Checkbox label="D" />
                    <Checkbox label="E1" />
                    <Checkbox label="E2" />
                    <Checkbox label="E3" />
                    <Checkbox label="F" />
                </div>
            </div>

            {/* Equipo utilizado */}
            <div className="border border-black p-1 py-1 rounded-sm mb-1.5">
                <p className="font-black text-[6.5pt] uppercase mb-0.5 px-1">Equipo utilizado:</p>
                <div className="flex justify-between px-1">
                    <Checkbox label="MOTO" />
                    <Checkbox label="CAMIÓN SENCILLO" />
                    <Checkbox label="TAXI" />
                    <Checkbox label="BUSITO" />
                    <Checkbox label="COASTER" />
                </div>
            </div>

            {/* Resultado */}
            <div className="flex justify-center gap-6 mb-1.5">
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-3.5 border border-black rounded-sm"></div>
                    <span className="font-bold text-[7.5pt] uppercase">Aprobado</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-3.5 border border-black rounded-sm"></div>
                    <span className="font-bold text-[7.5pt] uppercase">Reprobado</span>
                </div>
            </div>

            {/* Criterios de Evaluación */}
            <div className="mb-1.5">
                <p className="font-black text-[7pt] uppercase mb-0.5 px-1">Criterios de evaluación:</p>
                <table className="w-full border-collapse border border-black">
                    <tbody>
                        <CriteriaRow num={1} text="Conocimientos generales del equipo." />
                        <CriteriaRow num={2} text="Demuestra que puede mover y controlar el equipo o vehículo de manera segura." />
                        <CriteriaRow num={3} text="Destreza y uso correcto del vehículo o equipo." />
                        <CriteriaRow num={4} text="Demuestra destreza adecuadas, conocimiento y respeto por las normas de tránsito." />
                        <tr className="bg-slate-50">
                            <td className="p-1 border-r border-black font-bold text-[6.5pt]">Escala:</td>
                            <td colSpan={2} className="p-0.5">
                                <div className="flex justify-between px-2">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[6pt]">Excelente</span>
                                        <div className="w-4 h-3 border border-blue-800 rounded-sm"></div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[6pt]">Bueno</span>
                                        <div className="w-4 h-3 border border-blue-800 rounded-sm"></div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[6pt]">Regular</span>
                                        <div className="w-4 h-3 border border-blue-800 rounded-sm"></div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[6pt]">No apto</span>
                                        <div className="w-4 h-3 border border-blue-800 rounded-sm"></div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Comentarios generales */}
            <div className="border border-blue-800 p-1.5 py-2.5 rounded-sm mb-2 relative">
                <span className="absolute -top-1.5 left-2 bg-white px-1 font-black text-[6.5pt] uppercase tracking-tight">Comentarios generales:</span>
                <div className="border-b border-black border-dotted h-1 pt-1 w-full"></div>
                <div className="border-b border-black border-dotted h-4 w-full"></div>
            </div>

            {/* Firmas */}
            <div className="mt-auto space-y-4 mb-3">
                <div className="flex gap-2">
                    <span className="text-[7pt] font-medium whitespace-nowrap">Firma del instructor:</span>
                    <div className="border-b border-black flex-1 h-3"></div>
                </div>
                <div className="flex gap-2">
                    <span className="text-[7pt] font-medium whitespace-nowrap">Firma del estudiante:</span>
                    <div className="border-b border-black flex-1 h-3"></div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[5pt] text-slate-400 font-bold uppercase tracking-[0.2em] border-t pt-1">
                Documento de Control Interno • Freeway Escuela de Manejo S.A.
            </div>
        </div>
    );
}
