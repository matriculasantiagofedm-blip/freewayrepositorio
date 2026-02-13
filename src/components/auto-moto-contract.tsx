'use client';
import type { Contract } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from './ui/card';
import { cn, toDate } from '@/lib/utils';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span className={cn("border-b border-dotted border-black flex-1 min-w-8 text-center font-semibold text-black", className)}>
    {children || <>&nbsp;</>}
  </span>
);
const Value = ({ children }: { children: React.ReactNode }) => <span className="px-1 font-semibold text-black">{children}</span>;

const Checkbox = ({ checked }: { checked: boolean }) => (
    <span className={`border border-black inline-block w-3 h-3 text-center leading-none align-middle ${checked ? 'bg-black text-white print:text-black print:bg-white print:font-bold' : ''}`}>
        {checked ? 'X' : ''}
    </span>
);

const LongLine = () => <span className="border-b border-dotted border-black flex-1 h-4 min-w-40" />;

export function AutoMotoContractTemplate({ contract }: { contract: Contract }) {
  const autoMotoDetails = contract.autoMotoDetails;
  const creationDate = toDate(contract.createdAt);
  const paymentDeadline = toDate(autoMotoDetails?.paymentDeadline);
  const balance = autoMotoDetails?.balance ?? 0;
  const downPayment = autoMotoDetails?.downPayment ?? 0;
  const courseValue = autoMotoDetails?.courseValue ?? 0;
  
  const formatDateStr = (date: Date) => {
    if (!date || isNaN(date.getTime())) return "__________";
    try {
        return format(date, 'P', { locale: es });
    } catch {
        return "__________";
    }
  };

  const isSoloPractica = contract.type === 'Curso Solo Practica';

  return (
    <Card className="p-6 print:shadow-none print:border-none print:p-0 font-serif text-xs">
      <CardContent className="p-0 space-y-2 relative">
        <div className="flex justify-between items-start pb-2 border-b border-black mb-2">
            <h2 className="text-center font-bold text-sm uppercase">Contrato de Servicio de Capacitación Vial</h2>
             {contract.folioNumber && (
                <div className="text-right">
                    <p className="font-bold text-sm text-destructive print:text-red-500">FOLIO N° {String(contract.folioNumber).padStart(6, '0')}</p>
                </div>
            )}
        </div>
        
        {/* SECCIÓN COMPACTA DEL ESTUDIANTE Y EMPRESA */}
        <div className="border border-black p-2 bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-[9px] leading-tight">
                <div className="flex gap-1">
                    <span className="font-bold min-w-[60px]">EMPRESA:</span>
                    <span>FREEWAY ESCUELA DE MANEJO S.A. (RUC 155628022-2-2016 DV 2)</span>
                </div>
                <div className="flex gap-1">
                    <span className="font-bold min-w-[60px]">UBICACIÓN:</span>
                    <span>Costa Verde, PH Green Plaza, Local #20, La Chorrera.</span>
                </div>
                <div className="md:col-span-2 border-t border-black/10 my-1"></div>
                <div className="flex gap-1">
                    <span className="font-bold min-w-[60px]">ESTUDIANTE:</span>
                    <span className="uppercase font-bold">{contract.clientName}</span>
                </div>
                <div className="flex gap-1">
                    <span className="font-bold min-w-[60px] uppercase">{autoMotoDetails?.idType || 'ID'}:</span>
                    <span className="font-bold">{autoMotoDetails?.studentIdNumber}</span>
                </div>
                <div className="flex gap-1">
                    <span className="font-bold min-w-[60px]">DOMICILIO:</span>
                    <span className="uppercase">{autoMotoDetails?.studentAddress}</span>
                </div>
                <div className="flex gap-1">
                    <span className="font-bold min-w-[60px]">TELÉFONOS:</span>
                    <span>{autoMotoDetails?.studentPhone1} {autoMotoDetails?.studentPhone2 ? `/ ${autoMotoDetails.studentPhone2}` : ''}</span>
                </div>
                <div className="flex gap-1 md:col-span-2">
                    <span className="font-bold min-w-[60px]">EMAIL:</span>
                    <span className="lowercase font-semibold">{contract.clientEmail}</span>
                </div>
            </div>
        </div>

        <div className="bg-white p-0 space-y-1">
            <h3 className="font-bold text-center pt-1 italic underline text-[9px]">DECLARACIONES Y CLÁUSULAS</h3>
            <p className='text-[9px] leading-tight text-justify'>Ambas partes convienen celebrar este contrato para la prestación de servicios de capacitación y adiestramiento teórico-práctico de conducción, el cual se rige por las siguientes condiciones:</p>
            
            <h3 className="font-bold uppercase text-[9px] mt-1 bg-slate-100 px-1">I. VALOR Y FORMA DE PAGO</h3>
            <div className='space-y-0.5 text-[9px]'>
                <p>Valor total del curso: B/. <Line><Value>{courseValue.toFixed(2)}</Value></Line>.</p>
                <p>Abono efectuado: B/. <Line><Value>{downPayment.toFixed(2)}</Value></Line> | Saldo pendiente: B/. <Line><Value>{balance > 0 ? balance.toFixed(2) : '0.00'}</Value></Line>.</p>
                <p>Fecha límite para cancelación total: <Line><Value>{formatDateStr(paymentDeadline)}</Value></Line>.</p>
                <ul className="list-disc list-inside pl-2 text-[8px] italic text-muted-foreground">
                    <li>Se requiere abono del 25% para reserva. El saldo debe estar pago antes de la primera clase práctica.</li>
                </ul>
            </div>
            
            <h3 className="font-bold uppercase text-[9px] mt-1 bg-slate-100 px-1">II. DETALLES OPERATIVOS DEL CURSO</h3>
            <div className='space-y-0.5 text-[9px] pl-2'>
                {isSoloPractica ? (
                     <p>1. Categoría de licencia a aplicar: <Value>SOLO PRÁCTICA (NO APLICA CERTIFICACIÓN)</Value></p>
                ) : (
                    <p>1. Categoría de licencia a aplicar: 
                        {(contract.type === 'Curso Auto' || contract.type === 'Curso Mixto') && (
                            <>
                                A, C <Checkbox checked={autoMotoDetails?.licenseCategory === 'A, C'} /> / 
                                A, C, D <Checkbox checked={autoMotoDetails?.licenseCategory === 'A, C, D'} />
                            </>
                        )}
                        {(contract.type === 'Curso Moto' || contract.type === 'Curso Mixto') && (
                            <>
                                {contract.type === 'Curso Mixto' && ' / '}
                                A, B <Checkbox checked={autoMotoDetails?.licenseCategory === 'A, B'} />
                            </>
                        )}
                    </p>
                )}

                <p>2. Transmisión asignada: 
                    {(contract.type === 'Curso Auto' || contract.type === 'Curso Mixto' || contract.type === 'Curso Solo Practica') && (
                        <>
                            Automático <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Automático'} /> / 
                            Manual <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Manual'} />
                        </>
                    )}
                    {(contract.type === 'Curso Moto' || contract.type === 'Curso Mixto' || contract.type === 'Curso Solo Practica') && (
                        <>
                            {contract.type !== 'Curso Moto' && ' / '}
                            Moto <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Moto'} />
                        </>
                    )}
                </p>
                
                {!isSoloPractica && (
                    <>
                        <div className="flex items-center gap-2">3. Horario para clases teóricas: <Line><Value>{autoMotoDetails?.theoreticalClassSchedule || 'A COORDINAR'}</Value></Line></div>
                        <div className="pl-4 text-[8px] flex flex-wrap gap-x-4">
                            {(autoMotoDetails?.theoreticalClassDates || []).map((date, index) => (
                                <span key={index}>Sesión {index + 1}: <Value>{formatDateStr(toDate(date))}</Value></span>
                            ))}
                        </div>
                    </>
                )}

                <p className="font-bold underline mt-1">4. Programación de Clases Prácticas (Horarios Reservados):</p>
                {contract.type === 'Curso Mixto' ? (
                    <div className="grid grid-cols-2 gap-2 mt-1 border-l-2 border-slate-200 pl-2">
                        <div>
                            <p className="font-bold text-[8px] uppercase">Clases de Auto:</p>
                            {(autoMotoDetails?.practicalClassSchedules || []).map((s, index) => (
                                <div key={index} className="text-[8px] leading-tight">
                                    • {s.date ? formatDateStr(toDate(s.date)) : '---'} | {s.time || '---'}
                                </div>
                            ))}
                        </div>
                        <div>
                            <p className="font-bold text-[8px] uppercase text-orange-700">Clases de Moto:</p>
                            {(autoMotoDetails?.motoPracticalClassSchedules || []).map((s, index) => (
                                <div key={index} className="text-[8px] leading-tight">
                                    • {s.date ? formatDateStr(toDate(s.date)) : '---'} | {s.time || '---'}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 mt-1 border-l-2 border-slate-200 pl-2">
                        {( (autoMotoDetails?.practicalClassSchedules?.length ? autoMotoDetails.practicalClassSchedules : autoMotoDetails?.motoPracticalClassSchedules) || [] ).map((s, index) => (
                            <div key={index} className="text-[8px] leading-tight">
                                <span className="font-bold">CLASE {index + 1}:</span> {s.date ? formatDateStr(toDate(s.date)) : '---'} | {s.time || '---'}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <h3 className="font-bold uppercase text-[9px] mt-2 bg-slate-100 px-1">III. CONDICIONES DEL SERVICIO</h3>
            <div className='text-[8px] leading-tight space-y-1 text-justify'>
                <p><span className="font-bold">ASISTENCIA:</span> Inasistencias sin aviso previo de 24h resultan en pérdida de clase. Faltas por salud requieren constancia médica. Faltas injustificadas inhabilitan la certificación hasta pagar recargo de $20.00 por clase para reprogramación.</p>
                <p><span className="font-bold">LOGÍSTICA:</span> Clases inician en oficina. El traslado al circuito y retorno está incluido en el tiempo de la clase (2h). Llegadas tarde reducen el tiempo efectivo de práctica sin derecho a reposición.</p>
                <p><span className="font-bold">VESTIMENTA:</span> Es obligatorio el uso de ropa adecuada. Prohibido: escotes, minifaldas, shorts, leggins o sandalias. Incumplir esto implica pérdida automática de la clase.</p>
                <p><span className="font-bold">POLÍTICAS:</span> No se permiten acompañantes ni mascotas. No hay devoluciones de dinero. El curso vence a los tres (3) meses de la firma.</p>
            </div>

            <div className="mt-4 border-t border-black pt-2">
                <p className="text-center text-[9px] font-bold">
                    Suscrito en Panamá, el <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'd', { locale: es }) : ''}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'LLLL', { locale: es }) : ''}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'yyyy', { locale: es }) : ''}</Value>, a las <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'p', { locale: es }) : ''}</Value>.
                </p>
            </div>
        </div>

        <div className="flex justify-around pt-8">
            <div className="text-center flex flex-col items-center">
                <LongLine />
                <p className="text-[9px] font-bold">REPRESENTANTE FREEWAY</p>
            </div>
            <div className="text-center flex flex-col items-center">
                <LongLine />
                <p className="text-[9px] font-bold">EL ESTUDIANTE</p>
                <p className="text-[8px]">ID: <Value>{autoMotoDetails?.studentIdNumber}</Value></p>
            </div>
        </div>

        {contract.createdBy && (
            <div className="hidden print:block text-right text-[7px] text-muted-foreground pt-4">
                <span>Registro creado por: {contract.createdBy}</span>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
