'use client';
import type { Contract } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from './ui/card';
import { cn, toDate } from '@/lib/utils';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span className={cn("border-b border-black inline-block px-1 min-w-[40px] font-semibold text-black", className)}>
    {children || <>&nbsp;</>}
  </span>
);

const Value = ({ children }: { children: React.ReactNode }) => <span className="font-semibold text-black">{children}</span>;

export function AmpliacionesContractTemplate({ contract }: { contract: Contract }) {
  const details = contract.ampliacionesDetails;
  const creationDate = toDate(contract.createdAt);
  const theoryDate = toDate(details?.theoreticalClassDate);
  
  const formatDateStr = (date: Date) => {
    if (!date || isNaN(date.getTime())) return "__________";
    try {
        return format(date, 'dd/MM/yyyy', { locale: es });
    } catch {
        return "__________";
    }
  };

  return (
    <div className="max-w-[8.5in] mx-auto bg-white p-8 font-serif text-[11pt] leading-relaxed text-black print:p-0 print:m-0">
      <div className="flex justify-between items-start mb-6">
        <h1 className="font-bold text-sm uppercase tracking-tight">CONTRATO POR SERVICIO DE AMPLIACIÓN DE LICENCIA</h1>
        <div className="text-right">
          <p className="font-bold text-sm">CONTRATO N° {String(contract.folioNumber || '').padStart(6, '0')}</p>
        </div>
      </div>

      <div className="text-justify text-[10pt] mb-6">
        La empresa <Value>FREEWAY ESCUELA DE MANEJO S.A.</Value>, con RUC <Value>155628022-2-2016 DV 2</Value>, en adelante <Value>LA EMPRESA</Value>, y <Line>{contract.clientName}</Line>, con <Value>{details?.idType || 'cédula/pasaporte'}</Value> <Line>{details?.studentIdNumber}</Line>, domicilio en <Line>{details?.studentAddress}</Line>, teléfonos <Line>{details?.studentPhone1} / {details?.studentPhone2 || '---'}</Line>, correo electrónico <Line>{contract.clientEmail}</Line>, en adelante <Value>EL ESTUDIANTE</Value>, convienen en celebrar el siguiente contrato de servicio.
      </div>

      <h2 className="text-center font-bold text-sm mb-4">CLÁUSULAS</h2>

      <div className="space-y-4 text-[10pt]">
        <section>
          <h3 className="font-bold">PRIMERA: OBJETO DEL CONTRATO</h3>
          <p>LA EMPRESA se compromete a brindar a EL ESTUDIANTE el servicio de capacitación teórica para la ampliación de su licencia de conducir, según los planes seleccionados.</p>
        </section>

        <div className="text-center py-2">
          <p className="font-bold">Planes de Ampliación Seleccionados</p>
          <p className="text-sm font-semibold mt-1">{details?.licenseCategory || '---'}</p>
        </div>

        <section>
          <h3 className="font-bold">SEGUNDA: VALOR Y FORMA DE PAGO</h3>
          <p>El valor total del servicio es de B/. <Line>{details?.courseValue?.toFixed(2)}</Line>.</p>
          <p>El estudiante ha efectuado un abono de B/. <Line>{details?.downPayment?.toFixed(2)}</Line>, quedando un saldo de B/. <Line>{(details?.balance || 0).toFixed(2)}</Line>.</p>
          <p className="italic text-[9pt] mt-1">Si el monto total es de B/. 100.00 o menos, debe ser cancelado en su totalidad al momento de la inscripción. Para montos superiores, se requiere un abono del 25%.</p>
        </section>

        <section>
          <h3 className="font-bold">TERCERA: DETALLES DE LA CAPACITACIÓN</h3>
          <p>La capacitación consiste en una única clase teórica.</p>
          <div className="grid grid-cols-2 gap-4 mt-1">
            <p>Fecha de la clase: <Line>{formatDateStr(theoryDate)}</Line></p>
            <p>Horario: <Line className="min-w-[150px]">{details?.theoreticalClassTime || '---'}</Line></p>
          </div>
        </section>

        <section>
          <h3 className="font-bold">CUARTA: POLÍTICAS DE ASISTENCIA</h3>
          <p>La inasistencia a la clase teórica programada sin notificación previa de al menos 24 horas resultará en la pérdida de la misma, sin derecho a reprogramación ni reembolso. En caso de emergencia justificada, se evaluará la posibilidad de reprogramar según disponibilidad.</p>
        </section>

        <section>
          <h3 className="font-bold">QUINTA: CANCELACIÓN Y VIGENCIA</h3>
          <p>No se realizarán devoluciones de dinero en caso de cancelación por parte de EL ESTUDIANTE. El servicio tiene una vigencia de tres (3) meses a partir de la firma de este contrato para ser completado.</p>
        </section>

        <section>
          <h3 className="font-bold">SEXTA: ACEPTACIÓN</h3>
          <p className="text-center mt-4">
            En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, a los <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'd', { locale: es }) : '---'}</Value> días del mes de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'MMMM', { locale: es }) : '---'}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'yyyy', { locale: es }) : '---'}</Value>, a las <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'HH:mm', { locale: es }) : '---'}</Value>.
          </p>
        </section>
      </div>

      <div className="flex justify-between items-end mt-24 px-8">
        <div className="text-center w-[250px]">
          <div className="border-t border-black mb-1"></div>
          <p className="text-[9pt] font-bold">Por la Empresa</p>
        </div>
        <div className="text-center w-[250px]">
          <div className="border-t border-black mb-1"></div>
          <p className="text-[9pt] font-bold">El Cliente</p>
          <p className="text-[8pt]">Cédula: {details?.studentIdNumber}</p>
        </div>
      </div>

      <div className="mt-16 text-center text-[9pt] text-gray-600 italic">
        Confeccionado por: {contract.createdBy || 'Ventas'}
      </div>
    </div>
  );
}
