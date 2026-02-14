'use client';
import type { Contract } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span 
    className={cn("border-b border-black inline-block px-1 min-w-[40px] font-semibold text-black", className)}
    style={{ borderBottomStyle: 'dotted', borderBottomWidth: '1px' }}
  >
    {children || <>&nbsp;</>}
  </span>
);

const Value = ({ children }: { children: React.ReactNode }) => <span className="font-bold text-black">{children}</span>;

export function AmpliacionesContractTemplate({ contract }: { contract: Contract }) {
  const details = contract.ampliacionesDetails;
  const creationDate = toDate(contract.createdAt);
  const theoryDate = toDate(details?.theoreticalClassDate);
  const paymentDeadline = toDate(details?.paymentDeadline);
  
  const formatDateStr = (date: any) => {
    if (!date) return "__________";
    const d = toDate(date);
    if (isNaN(d.getTime())) return "__________";
    return format(d, 'dd/MM/yyyy', { locale: es });
  };

  return (
    <div className="max-w-[8.5in] mx-auto bg-white p-12 font-serif text-[10pt] leading-tight text-black print:p-0 print:m-0">
      {/* Encabezado Principal */}
      <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
        <div className="flex flex-col">
            <h1 className="font-black text-xl uppercase tracking-tighter leading-none">FREEWAY</h1>
            <p className="text-[8pt] font-bold uppercase tracking-[0.2em]">Escuela de Manejo, S.A.</p>
        </div>
        <div className="text-center flex-1 px-4">
            <h2 className="font-bold text-[11pt] uppercase">CONTRATO POR SERVICIO DE AMPLIACIÓN</h2>
        </div>
        <div className="text-right">
          <p className="text-[8pt] uppercase font-bold text-gray-500">Folio de Registro</p>
          <p className="font-black text-lg text-red-600">N° {String(contract.folioNumber || '').padStart(6, '0')}</p>
        </div>
      </div>

      {/* Párrafo Introductorio */}
      <div className="text-justify mb-4 leading-normal">
        Entre la sociedad <Value>FREEWAY ESCUELA DE MANEJO S.A.</Value>, con domicilio en La Chorrera, Costa Verde, PH Green Plaza, Local #20, con RUC <Value>155628022-2-2016 DV 2</Value>, en adelante denominada <Value>LA EMPRESA</Value>, y el Sr.(a) <Line className="min-w-[280px]">{contract.clientName?.toUpperCase()}</Line>, con <Value>{details?.idType || 'C.I.P.'}</Value> <Line className="min-w-[130px]">{details?.studentIdNumber}</Line>, residente en <Line className="min-w-[250px]">{details?.studentAddress?.toUpperCase()}</Line>, con teléfonos <Line className="min-w-[120px]">{details?.studentPhone1}</Line> / <Line className="min-w-[120px]">{details?.studentPhone2 || '---'}</Line> y correo <Line className="min-w-[200px]">{contract.clientEmail}</Line>, en adelante denominado <Value>EL ESTUDIANTE</Value>, acuerdan los términos del presente contrato.
      </div>

      <h3 className="text-center font-bold text-[10pt] mb-2 uppercase tracking-widest bg-gray-100 py-1">DECLARACIONES Y CLÁUSULAS</h3>

      <div className="space-y-4">
        <section>
          <p className="text-justify leading-snug">
            <span className="font-bold uppercase text-[9pt]">PRIMERA (OBJETO):</span> 
            LA EMPRESA se compromete a brindar a EL ESTUDIANTE el servicio de capacitación teórica para la ampliación de su licencia de conducir, según las categorías seleccionadas a continuación:
          </p>
          <div className="mt-2 text-center border border-gray-200 py-2 bg-slate-50/50 rounded-sm">
            <p className="text-[11pt] font-black tracking-widest uppercase">{details?.licenseCategory || '---'}</p>
          </div>
        </section>

        <section>
          <p className="text-justify leading-snug">
            <span className="font-bold uppercase text-[9pt]">SEGUNDA (VALOR Y PAGO):</span> 
            El valor total del servicio es de B/. <Value>{details?.courseValue?.toFixed(2)}</Value>. EL ESTUDIANTE ha abonado la suma de B/. <Line className="min-w-[70px]">{details?.downPayment?.toFixed(2)}</Line>, manteniendo un saldo pendiente de B/. <Line className="min-w-[70px]">{(details?.balance || 0).toFixed(2)}</Line> a cancelar el día <Line className="min-w-[110px]">{formatDateStr(paymentDeadline)}</Line>. 
            <span className="italic text-[8pt] block mt-1">Nota: Trámites de B/. 100.00 o menos deben cancelarse en su totalidad al momento de la inscripción.</span>
          </p>
        </section>

        <section className="border border-gray-200 p-3 rounded-sm">
          <h4 className="font-bold uppercase text-[9pt] mb-2 border-b border-gray-100 pb-1">TERCERA (DETALLES DE LA CAPACITACIÓN)</h4>
          <p className="text-[9pt] mb-2">La capacitación para ampliación consiste en una sesión teórica única programada de la siguiente manera:</p>
          <div className="grid grid-cols-2 gap-4 text-[9pt]">
            <div className="flex items-center gap-2">
                <span className="font-bold uppercase text-[8pt]">Fecha de Clase:</span>
                <Line className="min-w-[120px]">{formatDateStr(theoryDate)}</Line>
            </div>
            <div className="flex items-center gap-2">
                <span className="font-bold uppercase text-[8pt]">Horario:</span>
                <Line className="min-w-[150px]">{details?.theoreticalClassTime || '---'}</Line>
            </div>
          </div>
        </section>

        <div className="space-y-2 text-[8.5pt] leading-tight text-justify">
            <p><span className="font-bold uppercase">CUARTA (POLÍTICAS DE ASISTENCIA):</span> La inasistencia a la clase teórica programada sin notificación previa de al menos 24 horas resultará en la pérdida de la misma, sin derecho a reprogramación ni reembolso. En caso de emergencia justificada por salud, se evaluará la reprogramación según disponibilidad.</p>
            <p><span className="font-bold uppercase">QUINTA (CANCELACIÓN Y VIGENCIA):</span> No se realizarán devoluciones de dinero en caso de cancelación por parte de EL ESTUDIANTE. El servicio tiene una vigencia máxima de tres (3) meses a partir de la firma de este contrato para ser completado satisfactoriamente.</p>
        </div>

        <section className="mt-6 pt-4 border-t-2 border-black">
            <h3 className="font-bold uppercase text-center mb-2 text-[9pt]">SEXTA - ACEPTACIÓN Y FIRMAS</h3>
            <p className="text-center italic text-[9pt] mb-8">
                Suscrito en la ciudad de Panamá, el día <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'd', { locale: es }) : '---'}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'MMMM', { locale: es }) : '---'}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'yyyy', { locale: es }) : '---'}</Value>, a las <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'HH:mm', { locale: es }) : '---'}</Value>.
            </p>
            
            <div className="flex justify-between px-12 pt-10">
                <div className="text-center w-[220px]">
                    <div className="border-t border-black mb-1"></div>
                    <p className="font-bold uppercase text-[8pt]">Representante Legal</p>
                    <p className="text-[7pt] text-gray-500 italic">Freeway Escuela de Manejo S.A.</p>
                </div>
                <div className="text-center w-[220px]">
                    <div className="border-t border-black mb-1"></div>
                    <p className="font-bold uppercase text-[8pt]">Firma del Estudiante</p>
                    <p className="text-[8pt] font-bold">ID: {details?.studentIdNumber}</p>
                </div>
            </div>
        </section>
      </div>

      <div className="mt-16 text-center text-[7pt] text-gray-400 uppercase tracking-tighter">
        Documento interno de control administrativo • Confeccionado por: {contract.createdBy || 'Sistema'} • {format(new Date(), 'PPpp', { locale: es })}
      </div>
    </div>
  );
}
