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

export function AutoContractTemplate({ contract }: { contract: Contract }) {
  const details = contract.autoMotoDetails;
  const creationDate = toDate(contract.createdAt);
  const paymentDeadline = toDate(details?.paymentDeadline);
  const balance = details?.balance ?? 0;
  const downPayment = details?.downPayment ?? 0;
  const courseValue = details?.courseValue ?? 0;
  
  const formatDateStr = (date: Date) => {
    if (!date || isNaN(date.getTime())) return "__________";
    try {
        return format(date, 'P', { locale: es });
    } catch {
        return "__________";
    }
  };

  return (
    <Card className="p-6 print:shadow-none print:border-none print:p-0 font-serif text-xs">
      <CardContent className="p-0 space-y-2 relative">
        <div className="flex justify-between items-start pb-2 border-b-2 border-black mb-2">
            <div className='flex flex-col'>
                <h2 className="font-bold text-sm uppercase">CONTRATO DE CAPACITACIÓN VIAL: CURSO AUTO</h2>
                <p className='text-[8px] text-muted-foreground uppercase'>FREEWAY ESCUELA DE MANEJO S.A. | RUC 155628022-2-2016 DV 2</p>
            </div>
             {contract.folioNumber && (
                <div className="text-right">
                    <p className="font-bold text-sm text-destructive print:text-red-500">FOLIO N° {String(contract.folioNumber).padStart(6, '0')}</p>
                </div>
            )}
        </div>
        
        {/* FICHA COMPACTA DEL ESTUDIANTE */}
        <div className="border-2 border-black p-2 bg-slate-50/20 mb-3 rounded-sm">
            <div className="grid grid-cols-4 gap-x-4 gap-y-2">
                <div className="col-span-2">
                    <p className="text-[11px] font-black uppercase border-b border-black/10 mb-0.5">{contract.clientName}</p>
                    <p className="text-[7px] text-muted-foreground font-bold uppercase tracking-tighter">ESTUDIANTE</p>
                </div>
                <div>
                    <p className="text-[11px] font-bold border-b border-black/10 mb-0.5">{details?.studentIdNumber}</p>
                    <p className="text-[7px] text-muted-foreground font-bold uppercase tracking-tighter">{details?.idType || 'IDENTIFICACIÓN'}</p>
                </div>
                <div>
                    <p className="text-[11px] font-bold border-b border-black/10 mb-0.5">{details?.studentPhone1}</p>
                    <p className="text-[7px] text-muted-foreground font-bold uppercase tracking-tighter">TELÉFONO</p>
                </div>
                <div className="col-span-3">
                    <p className="text-[10px] font-medium uppercase border-b border-black/10 mb-0.5">{details?.studentAddress}</p>
                    <p className="text-[7px] text-muted-foreground font-bold uppercase tracking-tighter">DIRECCIÓN RESIDENCIAL</p>
                </div>
                <div>
                    <p className="text-[10px] font-medium lowercase border-b border-black/10 mb-0.5">{contract.clientEmail}</p>
                    <p className="text-[7px] text-muted-foreground font-bold uppercase tracking-tighter">CORREO ELECTRÓNICO</p>
                </div>
            </div>
        </div>

        <div className="space-y-1 text-justify">
            <h3 className="font-bold uppercase text-[9px] bg-slate-100 px-1 border-l-2 border-black">I. VALOR Y COMPROMISO DE PAGO</h3>
            <div className='space-y-0.5 text-[9px] pl-2'>
                <p>Valor Total: B/. <Line><Value>{courseValue.toFixed(2)}</Value></Line> | Abono: B/. <Line><Value>{downPayment.toFixed(2)}</Value></Line> | Saldo: B/. <Line><Value>{balance > 0 ? balance.toFixed(2) : '0.00'}</Value></Line>.</p>
                <p>Fecha límite de cancelación: <Line><Value>{formatDateStr(paymentDeadline)}</Value></Line>.</p>
            </div>
            
            <h3 className="font-bold uppercase text-[9px] mt-2 bg-slate-100 px-1 border-l-2 border-black">II. DETALLES DEL CURSO AUTO</h3>
            <div className='space-y-0.5 text-[9px] pl-2'>
                <p>Categoría: A, C <Checkbox checked={details?.licenseCategory === 'A, C'} /> / A, C, D <Checkbox checked={details?.licenseCategory === 'A, C, D'} /></p>
                <p>Transmisión: Automático <Checkbox checked={details?.vehicleTransmission === 'Automático'} /> / Manual <Checkbox checked={details?.vehicleTransmission === 'Manual'} /></p>
                
                <div className="mt-1">
                    <p className="font-bold underline">Programación Teórica:</p>
                    <p className="text-[8px]">Horario: <Value>{details?.theoreticalClassSchedule || 'A COORDINAR'}</Value></p>
                    <div className="flex flex-wrap gap-x-4">
                        {(details?.theoreticalClassDates || []).map((date, index) => (
                            <span key={index} className="text-[8px]">Sesión {index + 1}: <Value>{formatDateStr(toDate(date))}</Value></span>
                        ))}
                    </div>
                </div>

                <div className="mt-1">
                    <p className="font-bold underline">Programación Práctica (Horarios Reservados):</p>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 border-l-2 border-slate-200 pl-2">
                        {(details?.practicalClassSchedules || []).map((s, index) => (
                            <div key={index} className="text-[8px] leading-tight">
                                <span className="font-bold">CLASE {index + 1}:</span> {s.date ? formatDateStr(toDate(s.date)) : '---'} | {s.time || '---'}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <h3 className="font-bold uppercase text-[9px] mt-2 bg-slate-100 px-1 border-l-2 border-black">III. POLÍTICAS DE LA ESCUELA</h3>
            <div className='text-[8px] leading-tight space-y-1'>
                <p><span className="font-bold">ASISTENCIA:</span> La inasistencia sin aviso previo de 24h conlleva la pérdida de la clase. El recargo por reprogramación es de $20.00.</p>
                <p><span className="font-bold">VESTIMENTA:</span> Prohibido el uso de chancletas, shorts, minifaldas o camisillas. El incumplimiento anula la sesión.</p>
                <p><span className="font-bold">VIGENCIA:</span> El contrato tiene una validez máxima de tres (3) meses para completar el curso.</p>
            </div>

            <div className="mt-4 border-t border-black pt-2">
                <p className="text-center text-[9px] font-bold">
                    Suscrito en Panamá, el <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'd', { locale: es }) : ''}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'LLLL', { locale: es }) : ''}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'yyyy', { locale: es }) : ''}</Value>.
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
                <p className="text-[8px]">ID: <Value>{details?.studentIdNumber}</Value></p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
