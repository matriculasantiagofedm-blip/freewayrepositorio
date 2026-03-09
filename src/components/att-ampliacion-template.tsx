
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
    <div className="flex items-center gap-2">
        <span className="text-[10pt] font-medium uppercase">{label}</span>
        <div className="w-8 h-5 border border-blue-800 rounded-sm"></div>
    </div>
);

const CriteriaRow = ({ num, text }: { num: number; text: string }) => (
    <tr className="border-b border-black">
        <td className="p-2 text-[9.5pt] leading-tight border-r border-black">
            <span className="font-bold mr-2">{num}.</span>
            {text}
        </td>
        <td className="p-1 w-24 border-r border-black">
            <div className="flex items-center justify-between px-2">
                <span className="text-[9pt] font-bold">Si</span>
                <div className="w-8 h-5 border border-blue-800 rounded-sm"></div>
            </div>
        </td>
        <td className="p-1 w-24">
            <div className="flex items-center justify-between px-2">
                <span className="text-[9pt] font-bold">No</span>
                <div className="w-8 h-5 border border-blue-800 rounded-sm"></div>
            </div>
        </td>
    </tr>
);

export function ATTampliacionTemplate({ contract }: ATTampliacionTemplateProps) {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    const studentName = contract.clientName || "";
    const studentId = details?.studentIdNumber || contract.studentIdNumber || "";
    
    return (
        <div className="w-[8.5in] h-[11in] bg-white p-[0.6in] font-sans text-black flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                    <h1 className="font-black text-2xl uppercase tracking-tighter leading-none text-black">FREEWAY</h1>
                    <p className="text-[7pt] font-bold text-black uppercase tracking-[0.2em] -mt-1">E S C U E L A D E M A N E J O</p>
                </div>
                <div className="text-center flex-1 pt-2">
                    <h2 className="font-black text-[13pt] uppercase tracking-tight">FREWAY ESCUELA DE MANEJO S.A.</h2>
                    <h3 className="font-bold text-[11pt] uppercase mt-1">Constancia de Evaluación Práctica Ampliaciones</h3>
                </div>
                <div className="border border-black p-1 px-3 rounded-sm flex items-center gap-2">
                    <span className="text-[9pt] font-bold">Fecha:</span>
                    <span className="border-b border-black w-32 h-5 inline-block text-[9pt] text-center">
                        {format(new Date(), 'dd/MM/yyyy')}
                    </span>
                </div>
            </div>

            {/* Datos Alumno */}
            <div className="space-y-3 mb-4">
                <div className="flex gap-4 border-b border-black pb-0.5">
                    <span className="text-[10pt] font-medium whitespace-nowrap">Nombre del estudiante:</span>
                    <span className="text-[10pt] font-bold uppercase flex-1">{studentName}</span>
                    <span className="text-[10pt] font-medium whitespace-nowrap ml-4">Cédula:</span>
                    <span className="text-[10pt] font-bold w-48">{studentId}</span>
                </div>
                <div className="flex gap-4 border-b border-black pb-0.5">
                    <span className="text-[10pt] font-medium whitespace-nowrap">Tipo de vehículo:</span>
                    <span className="text-[10pt] font-bold uppercase flex-1">________________________________________</span>
                    <span className="text-[10pt] font-medium whitespace-nowrap ml-4">Placa:</span>
                    <span className="text-[10pt] font-bold w-48">____________________</span>
                </div>
            </div>

            {/* Categorías */}
            <div className="border border-blue-800 p-3 py-4 rounded-sm flex items-center justify-between mb-4">
                <span className="font-black text-[11pt] uppercase tracking-wider">Categorías:</span>
                <div className="flex gap-8">
                    <Checkbox label="B" />
                    <Checkbox label="D" />
                    <Checkbox label="E1" />
                    <Checkbox label="E2" />
                    <Checkbox label="E3" />
                    <Checkbox label="F" />
                </div>
            </div>

            {/* Equipo utilizado */}
            <div className="border border-black p-3 py-2 rounded-sm mb-4">
                <p className="font-black text-[10pt] uppercase mb-2">Equipo utilizado:</p>
                <div className="flex justify-between px-2">
                    <Checkbox label="MOTO" />
                    <Checkbox label="CAMIÓN SENCILLO" />
                    <Checkbox label="TAXI" />
                    <Checkbox label="BUSITO" />
                    <Checkbox label="COASTER" />
                </div>
            </div>

            {/* Resultado */}
            <div className="flex justify-center gap-12 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-6 border-2 border-black rounded-sm"></div>
                    <span className="font-bold text-[11pt] uppercase">Aprobado</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-6 border-2 border-black rounded-sm"></div>
                    <span className="font-bold text-[11pt] uppercase">Reprobado</span>
                </div>
            </div>

            {/* Criterios de Evaluación */}
            <div className="mb-4">
                <p className="font-black text-[10.5pt] uppercase mb-2">Criterios de evaluación:</p>
                <table className="w-full border-collapse border border-black">
                    <tbody>
                        <CriteriaRow num={1} text="Conocimientos generales del equipo." />
                        <CriteriaRow num={2} text="Demuestra que puede mover y controlar el equipo o vehículo de manera segura." />
                        <CriteriaRow num={3} text="Destreza y uso correcto del vehículo o equipo." />
                        <CriteriaRow num={4} text="Demuestra destreza adecuadas, conocimiento y respeto por las normas de tránsito." />
                        <tr className="bg-slate-50">
                            <td className="p-2 border-r border-black font-bold text-[9pt]">Escala:</td>
                            <td colSpan={2} className="p-2">
                                <div className="flex justify-between px-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[8.5pt]">Excelente</span>
                                        <div className="w-8 h-5 border border-blue-800 rounded-sm"></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[8.5pt]">Bueno</span>
                                        <div className="w-8 h-5 border border-blue-800 rounded-sm"></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[8.5pt]">Regular</span>
                                        <div className="w-8 h-5 border border-blue-800 rounded-sm"></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[8.5pt]">No apto</span>
                                        <div className="w-8 h-5 border border-blue-800 rounded-sm"></div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Comentarios generales */}
            <div className="border border-blue-800 p-4 py-6 rounded-sm mb-12 relative">
                <span className="absolute -top-3 left-4 bg-white px-2 font-black text-[10pt] uppercase tracking-tight">Comentarios generales:</span>
                <div className="border-b border-black border-dotted h-1 pt-2 w-full"></div>
                <div className="border-b border-black border-dotted h-8 w-full"></div>
            </div>

            {/* Firmas */}
            <div className="mt-auto space-y-12 mb-8">
                <div className="flex gap-4">
                    <span className="text-[10pt] font-medium whitespace-nowrap">Firma del instructor:</span>
                    <div className="border-b border-black flex-1 h-5"></div>
                </div>
                <div className="flex gap-4">
                    <span className="text-[10pt] font-medium whitespace-nowrap">Firma del estudiante:</span>
                    <div className="border-b border-black flex-1 h-5"></div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[7pt] text-slate-400 font-bold uppercase tracking-[0.3em] border-t pt-2">
                Documento de Control Interno • Freeway Escuela de Manejo S.A.
            </div>
        </div>
    );
}
