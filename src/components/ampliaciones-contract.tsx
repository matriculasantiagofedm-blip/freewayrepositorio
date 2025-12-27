
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
const Value = ({ children }: { children: React.ReactNode }) => <span className="px-1 font-semibold text-primary print:text-black">{children}</span>;

const LongLine = () => <span className="border-b border-dotted border-black flex-1 h-4 min-w-40" />;

function toDate(date: any): Date {
  if (date instanceof Date) return date;
  if (date && date.toDate) return date.toDate();
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      const timezoneOffset = parsed.getTimezoneOffset() * 60000;
      return new Date(parsed.getTime() + timezoneOffset);
    }
  }
  return new Date(0); // Return invalid date
}

export function AmpliacionesContractTemplate({ contract }: { contract: Contract }) {
  const ampliacionesDetails = contract.ampliacionesDetails;
  const creationDate = toDate(contract.createdAt);
  const paymentDeadline = toDate(ampliacionesDetails?.paymentDeadline);
  const balance = ampliacionesDetails?.balance || 0;
  
  const formatDate = (date: Date) => {
    if (!date || isNaN(date.getTime()) || date.getFullYear() <= 1970) return <Line />;
    try {
        return <Value>{format(date, 'P', { locale: es })}</Value>;
    } catch {
        return <Line />;
    }
  };

  return (
    <Card className="p-6 print:shadow-none print:border-none print:p-0 font-serif text-xs">
      <CardContent className="p-0 space-y-2 relative">
        {contract.folio && <p className="absolute top-0 right-0 text-xs font-semibold text-destructive print:text-black">Folio: {contract.folio}</p>}
        <div className="flex items-center gap-2 justify-center pb-2">
            <h2 className="text-center font-bold text-sm">CONTRATO POR SERVICIO DE AMPLIACIÓN DE LICENCIA</h2>
        </div>
        
        <p className='text-[10px] leading-tight'>
            La empresa FREEWAY ESCUELA DE MANEJO S.A., con RUC 155628022-2-2016 DV 2, en adelante LA EMPRESA, y <Line>{contract.clientName}</Line>, con cédula/pasaporte <Line>{ampliacionesDetails?.studentIdNumber}</Line>, domicilio en <Line>{ampliacionesDetails?.studentAddress}</Line>, teléfonos <Line>{ampliacionesDetails?.studentPhone1}</Line>/<Line>{ampliacionesDetails?.studentPhone2}</Line>, correo electrónico <Line>{contract.clientEmail}</Line>, en adelante EL ESTUDIANTE, convienen en celebrar el siguiente contrato de servicio.
        </p>

        <h3 className="font-bold text-center pt-1">CLÁUSULAS</h3>
        
        <h3 className="font-bold">PRIMERA: OBJETO DEL CONTRATO</h3>
        <p className='text-[10px]'>LA EMPRESA se compromete a brindar a EL ESTUDIANTE el servicio de capacitación teórica para la ampliación de su licencia de conducir, según los planes seleccionados.</p>
        
        <div className="my-2 p-2 border border-dashed border-gray-300">
            <h4 className="font-semibold text-center mb-2">Planes de Ampliación Seleccionados</h4>
            {ampliacionesDetails?.selectedPlans && ampliacionesDetails.selectedPlans.length > 0 ? (
                <ul className="list-disc list-inside text-[10px]">
                    {ampliacionesDetails.selectedPlans.map(plan => (
                        <li key={plan.name} className="flex justify-between">
                            <span>{plan.name}</span>
                            <span className='font-semibold'>B/.{plan.price.toFixed(2)}</span>
                        </li>
                    ))}
                </ul>
            ) : <p className='text-[10px] text-center'>(No hay planes seleccionados)</p>}
        </div>

        <h3 className="font-bold">SEGUNDA: VALOR Y FORMA DE PAGO</h3>
        <div className='space-y-1 text-[10px]'>
            <p>El valor total del servicio es de B/. <Line>{ampliacionesDetails?.courseValue?.toFixed(2)}</Line>.</p>
            <p>El estudiante ha efectuado un abono de B/. <Line>{ampliacionesDetails?.downPayment?.toFixed(2)}</Line>, quedando un saldo de B/. <Line>{balance > 0 ? balance.toFixed(2) : '0.00'}</Line>.</p>
            {balance > 0 && paymentDeadline && (
                <p>El saldo pendiente se cancelará a más tardar el día {formatDate(paymentDeadline)}.</p>
            )}
             <p>Si el monto total es de B/.100.00 o menos, debe ser cancelado en su totalidad al momento de la inscripción. Para montos superiores, se requiere un abono del 50%.</p>
        </div>
        
        <h3 className="font-bold">TERCERA: DETALLES DE LA CAPACITACIÓN</h3>
        <div className='text-[10px]'>
            <p>La capacitación consiste en una única clase teórica.</p>
            <div className='flex items-center gap-2'>
                Fecha de la clase: {formatDate(toDate(ampliacionesDetails?.theoreticalClassDate))}
            </div>
             <div className='flex items-center gap-2'>
                Horario: <Line>{ampliacionesDetails?.theoreticalClassTime}</Line>
            </div>
        </div>

        <h3 className="font-bold">CUARTA: POLÍTICAS DE ASISTENCIA</h3>
        <p className='text-[10px]'>La inasistencia a la clase teórica programada sin notificación previa de al menos 24 horas resultará en la pérdida de la misma, sin derecho a reprogramación ni reembolso. En caso de emergencia justificada, se evaluará la posibilidad de reprogramar según disponibilidad.</p>
        
        <h3 className="font-bold">QUINTA: CANCELACIÓN Y VIGENCIA</h3>
        <p className='text-[10px]'>No se realizarán devoluciones de dinero en caso de cancelación por parte de EL ESTUDIANTE. El servicio tiene una vigencia de tres (3) meses a partir de la firma de este contrato para ser completado.</p>

        <h3 className="font-bold">SEXTA: ACEPTACIÓN</h3>
        <p className="text-center text-[10px]">
            En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, a los <Value>{format(creationDate, 'd', { locale: es })}</Value> días del mes de <Value>{format(creationDate, 'LLLL', { locale: es })}</Value> de <Value>{format(creationDate, 'yyyy', { locale: es })}</Value>.
        </p>

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

        <div className="print:block hidden text-xs text-muted-foreground pt-8">
            {contract.createdBy && (
            <span>Confeccionado por: {contract.createdBy}</span>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

    