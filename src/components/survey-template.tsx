'use client';

import React from 'react';
import type { Contract } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SurveyTemplateProps {
    contract?: Contract | null;
}

const QuestionRow = ({ num, text, options }: { num: number, text: string, options: string[] }) => (
    <div className="space-y-2">
        <p className="font-bold text-[11pt] leading-tight">
            {num}.- {text}
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 pl-4">
            {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                    <span className="font-medium text-[10pt] uppercase">{opt}</span>
                    <span className="inline-block border-b border-black w-12 h-0.5"></span>
                </div>
            ))}
        </div>
    </div>
);

export function SurveyTemplate({ contract }: SurveyTemplateProps) {
    const studentName = contract?.clientName || "_________________________________________________";
    const details = contract?.autoMotoDetails || contract?.deluxeDetails || contract?.ampliacionesDetails;
    const instructorName = details?.instructor || "__________________________";

    return (
        <div className="w-[8.5in] h-[11in] bg-white p-[0.75in] font-sans text-black flex flex-col relative overflow-hidden">
            {/* Header / Student Info */}
            <div className="mb-8 space-y-4 border-b-2 border-black pb-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <h1 className="font-black text-xl uppercase tracking-tighter">FREEWAY ESCUELA DE MANEJO</h1>
                        <p className="text-[9pt] font-bold text-slate-500 uppercase">Control de Calidad y Evaluación de Servicio</p>
                    </div>
                    {contract && (
                        <div className="text-right">
                            <p className="text-[8pt] font-black text-blue-600">FOLIO: {String(contract.folioNumber).padStart(6, '0')}</p>
                        </div>
                    )}
                </div>
                
                <div className="grid grid-cols-1 gap-2 pt-2">
                    <div className="flex items-baseline gap-2">
                        <span className="font-black text-[9pt] uppercase w-24">ESTUDIANTE:</span>
                        <span className="flex-1 border-b border-dotted border-black font-bold uppercase text-[10pt] px-2">{studentName}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-black text-[9pt] uppercase w-24">INSTRUCTOR:</span>
                        <span className="flex-1 border-b border-dotted border-black font-bold uppercase text-[10pt] px-2">{instructorName}</span>
                    </div>
                </div>
            </div>

            <div className="flex-grow space-y-7">
                <h2 className="font-black text-[13pt] uppercase border-l-4 border-black pl-3 mb-4">EVALUACIÓN AL INSTRUCTOR:</h2>

                <QuestionRow 
                    num={1} 
                    text="¿El instructor se identificó al iniciar su primera clase?" 
                    options={["SÍ", "NO"]} 
                />

                <QuestionRow 
                    num={2} 
                    text="¿El instructor salió a la hora pactada de clases?" 
                    options={["Fue Puntual", "Se atrasaba 5 minutos", "Se atrasaba 10 minutos", "Se atrasaba más de 10 minutos"]} 
                />

                <QuestionRow 
                    num={3} 
                    text="Como norma de la Empresa, se prohíbe el uso del celular, ¿El Instructor Utilizó el celular en horas de clases?" 
                    options={["No", "Sí, Chateaba y hacia llamadas la mayor parte del tiempo"]} 
                />

                <QuestionRow 
                    num={4} 
                    text="¿Cómo califica el nivel de Profesionalismo del Instructor?" 
                    options={["Bueno", "Regular", "Malo"]} 
                />

                <QuestionRow 
                    num={5} 
                    text="¿El instructor Utilizó la bitácora del Estudiante?" 
                    options={["SÍ", "NO"]} 
                />

                <QuestionRow 
                    num={6} 
                    text="¿El instructor se Distanció por mucho tiempo mientras usted permanecía solo en el vehículo?" 
                    options={["No, solo lo necesario", "Sí, la mayor parte del tiempo"]} 
                />

                <QuestionRow 
                    num={7} 
                    text="¿Cómo califica el método de enseñanza del instructor?" 
                    options={["Bueno", "Regular", "Malo"]} 
                />

                <QuestionRow 
                    num={8} 
                    text="¿Considera usted que le explicó de manera clara los Estacionamientos?" 
                    options={["Sí, Muy Claro", "Regular", "Logré entenderle muy poco"]} 
                />

                <div className="pt-6 space-y-4">
                    <h3 className="font-black text-[11pt] uppercase">OBSERVACIÓN DEL ESTUDIANTE:</h3>
                    <div className="space-y-6 pt-2">
                        <div className="border-b border-black border-dashed h-4 w-full"></div>
                        <div className="border-b border-black border-dashed h-4 w-full"></div>
                        <div className="border-b border-black border-dashed h-4 w-full"></div>
                        <div className="border-b border-black border-dashed h-4 w-3/4"></div>
                    </div>
                </div>
            </div>

            {/* Footer with Logo */}
            <div className="pt-12 border-t-2 border-black flex justify-between items-end">
                <div className="flex items-center gap-3">
                    <div className="bg-black text-white p-2 flex flex-col items-center leading-none">
                        <span className="font-black text-xl italic">FW</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-[14pt] tracking-widest uppercase leading-none">FREEWAY</span>
                        <span className="text-[7pt] font-bold uppercase tracking-[0.3em] -mt-0.5">Escuela de Manejo</span>
                    </div>
                </div>
                <div className="text-center w-48">
                    <div className="border-t border-black mb-1"></div>
                    <p className="text-[8pt] font-black uppercase opacity-40 italic">Firma del Estudiante</p>
                </div>
            </div>
        </div>
    );
}
