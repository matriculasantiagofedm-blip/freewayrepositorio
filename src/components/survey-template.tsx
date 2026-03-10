'use client';

import React, { useState, useEffect } from 'react';
import type { Contract } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Star, Check, AlertTriangle, X, ShieldCheck, UserCheck, ClipboardEdit } from 'lucide-react';
import { format } from 'date-fns';

interface SurveyTemplateProps {
    contract?: Contract | null;
}

const RatingRow = ({ text }: { text: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
        <p className="text-[9pt] font-medium text-slate-700 pr-4">{text}</p>
        <div className="flex gap-6 shrink-0">
            <div className="flex flex-col items-center gap-0.5">
                <div className="w-6 h-6 border-2 border-slate-300 rounded-full flex items-center justify-center text-green-600">
                    <Check className="h-4 w-4" />
                </div>
                <span className="text-[6pt] font-bold text-slate-400">BIEN</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
                <div className="w-6 h-6 border-2 border-slate-300 rounded-full flex items-center justify-center text-amber-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <span className="text-[6pt] font-bold text-slate-400">REGULAR</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
                <div className="w-6 h-6 border-2 border-slate-300 rounded-full flex items-center justify-center text-red-500">
                    <X className="h-4 w-4" />
                </div>
                <span className="text-[6pt] font-bold text-slate-400">MAL</span>
            </div>
        </div>
    </div>
);

const StarRating = ({ label }: { label: string }) => (
    <div className="flex flex-col gap-1 flex-1">
        <p className="text-[8pt] font-black uppercase text-slate-500">{label}</p>
        <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="h-5 w-5 text-slate-200 stroke-[2.5]" />
            ))}
        </div>
    </div>
);

export function SurveyTemplate({ contract }: SurveyTemplateProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const studentName = contract?.clientName || "_________________________________________________";
    let instructorName = contract?.autoMotoDetails?.instructor || "";
    
    if (!instructorName && contract) {
        const schedules = contract.autoMotoDetails?.practicalClassSchedules || 
                         contract.autoMotoDetails?.motoPracticalClassSchedules || [];
        const sessionWithInstructor = schedules.find((s: any) => s.instructor);
        if (sessionWithInstructor) instructorName = sessionWithInstructor.instructor;
    }

    if (!mounted) return null;

    return (
        <div className="w-[8.5in] h-[10.7in] bg-white p-[0.7in] font-sans text-black flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-8 border-b-4 border-slate-900 pb-4">
                <div className="space-y-1">
                    <h1 className="font-black text-2xl uppercase tracking-tighter leading-none text-slate-900">FREEWAY</h1>
                    <p className="text-[8pt] font-bold text-slate-500 uppercase tracking-[0.2em]">Escuela de Manejo, S.A.</p>
                </div>
                <div className="text-right">
                    <h2 className="font-black text-xs bg-slate-900 text-white px-3 py-1 rounded-sm uppercase tracking-widest">Control de Calidad</h2>
                    {contract && <p className="text-[8pt] font-bold text-slate-400 mt-1 uppercase">Folio: {String(contract.folioNumber).padStart(6, '0')}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-1">
                    <span className="text-[7pt] font-black uppercase text-slate-400">Estudiante</span>
                    <p className="text-[10pt] font-bold uppercase truncate border-b border-slate-200 pb-1">{studentName}</p>
                </div>
                <div className="space-y-1">
                    <span className="text-[7pt] font-black uppercase text-slate-400">Instructor Evaluado</span>
                    <p className="text-[10pt] font-bold uppercase truncate border-b border-slate-200 pb-1">{instructorName || "____________________"}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="h-5 w-5 text-slate-900" />
                        <h3 className="font-black text-[10pt] uppercase tracking-tight">Evaluación del Instructor</h3>
                    </div>
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <RatingRow text="¿El instructor fue puntual al inicio y fin de la clase?" />
                        <RatingRow text="¿Se identificó correctamente y utilizó la bitácora?" />
                        <RatingRow text="¿Mantuvo un trato respetuoso y profesional durante la sesión?" />
                        <RatingRow text="¿Evitó el uso del celular en horas de capacitación?" />
                        <RatingRow text="¿Las explicaciones de maniobras y estacionamiento fueron claras?" />
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="h-5 w-5 text-slate-900" />
                        <h3 className="font-black text-[10pt] uppercase tracking-tight">Seguridad y Confianza al Conducir</h3>
                    </div>
                    <div className="bg-white border rounded-xl p-6 shadow-sm flex flex-wrap gap-8">
                        <StarRating label="Uso de espejos y cinturón" />
                        <StarRating label="Dominio de pedales y timón" />
                        <StarRating label="Reacción ante el tráfico" />
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <ClipboardEdit className="h-5 w-5 text-slate-900" />
                        <h3 className="font-black text-[10pt] uppercase tracking-tight">Observaciones y Comentarios Útiles</h3>
                    </div>
                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 h-32 relative">
                        <div className="space-y-6">
                            <div className="border-b border-slate-200 w-full h-1"></div>
                            <div className="border-b border-slate-200 w-full h-1"></div>
                            <div className="border-b border-slate-200 w-full h-1"></div>
                        </div>
                    </div>
                </section>

                <section className="bg-slate-900 text-white p-6 rounded-2xl flex items-center justify-between">
                    <div>
                        <h4 className="font-black text-sm uppercase tracking-tighter">Estado Final del Estudiante:</h4>
                        <p className="text-[8pt] font-medium text-slate-400">Marque el resultado de la capacitación hoy</p>
                    </div>
                    <div className="flex gap-6">
                        <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-lg border border-white/20">
                            <div className="w-5 h-5 border-2 border-white rounded-md"></div>
                            <span className="font-black text-[9pt] uppercase tracking-widest">APTO</span>
                        </div>
                        <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-lg border border-white/20">
                            <div className="w-5 h-5 border-2 border-white rounded-md"></div>
                            <span className="font-black text-[9pt] uppercase tracking-widest leading-none">NECESITA<br/>PRÁCTICA</span>
                        </div>
                    </div>
                </section>
            </div>

            <div className="mt-auto pt-12 flex justify-between items-end border-t border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="bg-slate-900 text-white p-1 rounded">
                        <span className="font-black text-xs italic px-1">FW</span>
                    </div>
                    <p className="text-[7pt] font-bold text-slate-400 uppercase tracking-widest">Documento Oficial Freeway</p>
                </div>
                <div className="flex gap-12">
                    <div className="text-center w-40">
                        <div className="border-t-2 border-slate-900 mb-1"></div>
                        <p className="text-[7pt] font-black uppercase text-slate-900 italic">Firma del Estudiante</p>
                    </div>
                    <div className="text-center w-40">
                        <div className="border-t-2 border-slate-900 mb-1"></div>
                        <p className="text-[7pt] font-black uppercase text-slate-900 italic">Firma del Instructor</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
