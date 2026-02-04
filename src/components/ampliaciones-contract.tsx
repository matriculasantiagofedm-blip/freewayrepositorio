
'use client';
import type { Contract } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span className={cn("border-b border-dotted border-black flex-1 min-w-8 text-center font-semibold text-primary print:text-black", className)}>
    {children || <>&nbsp;</>}
  </span>
);
const Value = ({ children }: { children: React.ReactNode }) => <span className="px-1 font-semibold text-primary print:text-blue-600">{children}</span>;

const LongLine = () => <span className="border-b border-dotted border-black flex-1 h-4 min-w-40" />;

function toDate(date: any): Date {
  if (!date) return new Date('invalid');
  if (date instanceof Date) {
    return date;
  }
  // Handle Firestore Timestamp
  if (date && typeof date.toDate === 'function') {
    return date.toDate();
  }
  // Handle ISO strings or other string formats
  if (typeof date === 'string') {
    // Attempt to parse, replacing hyphens for better cross-browser compatibility
    const parsed = new Date(date.replace(/-/g, '/'));
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  // Fallback for unexpected types
  return new Date('invalid');
}

export function AmpliacionesContractTemplate({ contract }: { contract: Contract }) {
  const ampliacionesDetails = contract.ampliacionesDetails;
  const creationDate = contract.createdAt ? toDate(contract.createdAt) : new Date();
  const paymentDeadline = toDate(ampliacionesDetails?.paymentDeadline);
  const balance = ampliacionesDetails?.balance || 0;
  
  const formatDate = (date: Date) => {
    if (!date || isNaN(date.getTime())) return <Line />;
    try {
        return <Value>{format(date, 'P', { locale: es })}</Value>;
    } catch {
        return <Line />;
    }
  };

  return (
    <Card className="p-6 print:shadow-none print:border-none print:p-0 font-serif text-xs">
      <CardContent className="p-0 space-y-2 relative">
        <div className="flex justify-between items-start pb-2">
            <h2 className="text-center font-bold text-sm">CONTRATO POR SERVICIO DE AMPLIACIÓN DE LICENCIA</h2>
            {contract.folioNumber && (
                <div className="text-right">
                    <p className="font-bold text-sm text-destructive print:text-red-500">CONTRATO N° {String(contract.folioNumber).padStart(6, '0')}</p>
                </div>
            )}
        </div>
        
        <p className='text-[10px] leading-tight'>
            La empresa FREEWAY ESCUELA DE MANEJO S.A., con RUC 155628022-2-2016 DV 2, en adelante LA EMPRESA, y <Line><Value>{contract.clientName}</Value></Line>, con cédula/pasaporte <Line><Value>{ampliacionesDetails?.studentIdNumber}</Value></Line>, domicilio en <Line><Value>{ampliacionesDetails?.studentAddress}</Value></Line>, teléfonos <Line><Value>{ampliacionesDetails?.studentPhone1}</Value></Line>/<Line><Value>{ampliacionesDetails?.studentPhone2}</Value></Line>, correo electrónico <Line><Value>{contract.clientEmail}</Value></Line>, en adelante EL ESTUDIANTE, convienen en celebrar el siguiente contrato de servicio.
        </p>

        <div className="bg-slate-50 p-4 rounded-md print:bg-transparent print:p-0 space-y-1">
            <h3 className="font-bold text-center pt-1">CLÁUSULAS</h3>
            
            <h3 className="font-bold">PRIMERA: OBJETO DEL CONTRATO</h3>
            <p className='text-[10px]'>LA EMPRESA se compromete a brindar a EL ESTUDIANTE el servicio de capacitación teórica para la ampliación de su licencia de conducir, según los planes seleccionados.</p>
            
            <div className="my-2 p-2 border border-dashed border-gray-300">
                <h4 className="font-semibold text-center mb-2">Planes de Ampliación Seleccionados</h4>
                {ampliacionesDetails?.selectedPlans && ampliacionesDetails.selectedPlans.length > 0 ? (
                    <div className="flex flex-wrap justify-center items-center gap-x-2 text-[10px]">
                        {ampliacionesDetails.selectedPlans.map((plan, index) => (
                            <span key={plan.name}>
                                {plan.name}{index < ampliacionesDetails!.selectedPlans!.length - 1 ? ',' : ''}
                            </span>
                        ))}
                    </div>
                ) : <p className='text-[10px] text-center'>(No hay planes seleccionados)</p>}
            </div>

            <h3 className="font-bold">SEGUNDA: VALOR Y FORMA DE PAGO</h3>
            <div className='space-y-1 text-[10px]'>
                <p>El valor total del servicio es de B/. <Line><Value>{ampliacionesDetails?.courseValue?.toFixed(2)}</Value></Line>.</p>
                <p>El estudiante ha efectuado un abono de B/. <Line><Value>{ampliacionesDetails?.downPayment?.toFixed(2)}</Value></Line>, quedando un saldo de B/. <Line><Value>{balance > 0 ? balance.toFixed(2) : '0.00'}</Value></Line>.</p>
                {balance > 0 && paymentDeadline && (
                    <p>El saldo pendiente se cancelará a más tardar el día {formatDate(paymentDeadline)}.</p>
                )}
                <p>Si el monto total es de B/.100.00 o menos, debe ser cancelado en su totalidad al momento de la inscripción. Para montos superiores, se requiere un abono del 25%.</p>
            </div>
            
            <h3 className="font-bold">TERCERA: DETALLES DE LA CAPACITACIÓN</h3>
            <div className='text-[10px]'>
                <p>La capacitación consiste en una única clase teórica.</p>
                <div className='flex items-center gap-2'>
                    Fecha de la clase: {formatDate(toDate(ampliacionesDetails?.theoreticalClassDate))}
                </div>
                <div className='flex items-center gap-2'>
                    Horario: <Line><Value>{ampliacionesDetails?.theoreticalClassTime}</Value></Line>
                </div>
            </div>

            <h3 className="font-bold">CUARTA: POLÍTICAS DE ASISTENCIA</h3>
            <p className='text-[10px]'>La inasistencia a la clase teórica programada sin notificación previa de al menos 24 horas resultará en la pérdida de la misma, sin derecho a reprogramación ni reembolso. En caso de emergencia justificada, se evaluará la posibilidad de reprogramar según disponibilidad.</p>
            
            <h3 className="font-bold">QUINTA: CANCELACIÓN Y VIGENCIA</h3>
            <p className='text-[10px]'>No se realizarán devoluciones de dinero en caso de cancelación por parte de EL ESTUDIANTE. El servicio tiene una vigencia de tres (3) meses a partir de la firma de este contrato para ser completado.</p>

            <h3 className="font-bold">SEXTA: ACEPTACIÓN</h3>
            <p className="text-center text-[10px]">
                En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, a los <Value>{format(creationDate, 'd', { locale: es })}</Value> días del mes de <Value>{format(creationDate, 'LLLL', { locale: es })}</Value> de <Value>{format(creationDate, 'yyyy', { locale: es })}</Value>, a las <Value>{format(creationDate, 'p', { locale: es })}</Value>.
            </p>
        </div>


        <div className="flex justify-around pt-6 print:pt-12">
            <div className="text-center flex flex-col items-center">
                <LongLine />
                <p className="text-[10px]">Por la Empresa</p>
            </div>
            <div className="text-center flex flex-col items-center">
                <LongLine />
                <p className="text-[10px]">El Cliente</p>
                <p className="text-[10px]">Cédula: <Value>{ampliacionesDetails?.studentIdNumber}</Value></p>
            </div>
        </div>
        
        {contract.createdBy && (
            <div className="hidden print:block text-center text-xs text-muted-foreground pt-12">
                <span>Confeccionado por: {contract.createdBy}</span>
            </div>
        )}
      </CardContent>
    </Card>
  );
}

    