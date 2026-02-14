'use client';
import type { Contract } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span className={cn("border-b border-black inline-block px-1 min-w-[40px] font-semibold text-black", className)} style={{ borderBottomStyle: 'dotted', borderBottomWidth: '1px' }}>
    {children || <>&nbsp;</>}
  </span>
);

const Value = ({ children }: { children: React.ReactNode }) => <span className="font-bold text-black">{children}</span>;

const Checkbox = ({ checked }: { checked: boolean }) => (
    <span className="inline-flex items-center justify-center border border-black w-3.5 h-3.5 mr-1 align-middle">
        {checked ? <span className="text-[10px] font-black leading-none">X</span> : null}
    </span>
);

export function AutoMotoContractTemplate({ contract }: { contract: Contract }) {
  const details = contract.autoMotoDetails;
  const creationDate = toDate(contract.createdAt);
  const paymentDeadline = toDate(details?.paymentDeadline);
  
  const formatDateStr = (date: any) => {
    if (!date) return "__________";
    const d = toDate(date);
    if (isNaN(d.getTime())) return "__________";
    return format(d, 'dd/MM/yyyy', { locale: es });
  };

  const isSoloPractica = contract.type === 'Curso Solo Practica';

  return (
    <div className="max-w-[8.5in] mx-auto bg-white p-12 font-serif text-[10pt] leading-tight text-black print:p-0 print:m-0">
      {/* Encabezado Principal */}
      <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
        <div className="flex flex-col">
            <h1 className="font-black text-xl uppercase tracking-tighter leading-none">FREEWAY</h1>
            <p className="text-[8pt] font-bold uppercase tracking-[0.2em]">Escuela de Manejo, S.A.</p>
        </div>
        <div className="text-center flex-1 px-4">
            <h2 className="font-bold text-[11pt] uppercase">CONTRATO DE PRESTACIÓN DE SERVICIOS</h2>
        </div>
        <div className="text-right">
          <p className="text-[8pt] uppercase font-bold text-gray-500">Folio de Registro</p>
          <p className="font-black text-lg text-red-600">N° {String(contract.folioNumber || '').padStart(6, '0')}</p>
        </div>
      </div>

      {/* Párrafo Introductorio */}
      <div className="text-justify mb-4 leading-normal">
        Entre la sociedad <Value>FREEWAY ESCUELA DE MANEJO S.A.</Value>, con domicilio en La Chorrera, Costa Verde, PH Green Plaza, Local #20, con RUC <Value>155628022-2-2016 DV 2</Value>, en adelante denominada <Value>LA EMPRESA</Value>, y el Sr.(a) <Line className="min-w-[280px]">{contract.clientName?.toUpperCase()}</Line>, con <Value>{details?.idType || 'C.I.P.'}</Value> <Line className="min-w-[130px]">{details?.studentIdNumber}</Line>, residente en <Line className="min-w-[250px]">{details?.studentAddress?.toUpperCase()}</Line>, con números de contacto <Line className="min-w-[120px]">{details?.studentPhone1}</Line> / <Line className="min-w-[120px]">{details?.studentPhone2 || '---'}</Line> y correo <Line className="min-w-[200px]">{contract.clientEmail}</Line>, en adelante denominado <Value>EL ESTUDIANTE</Value>, acuerdan los términos del presente contrato de capacitación teórico-práctica para la obtención de licencia de conducir.
      </div>

      <h3 className="text-center font-bold text-[10pt] mb-2 uppercase tracking-widest bg-gray-100 py-1">DECLARACIONES Y CLÁUSULAS</h3>

      <div className="space-y-3">
        <section>
          <p className="text-justify leading-snug">
            <span className="font-bold uppercase">PRIMERA (VALOR Y PAGO):</span> 
            El valor total del curso es de B/. <Value>{details?.courseValue?.toFixed(2)}</Value>. EL ESTUDIANTE ha abonado B/. <Line className="min-w-[70px]">{details?.downPayment?.toFixed(2)}</Line>, manteniendo un saldo de B/. <Line className="min-w-[70px]">{(details?.balance || 0).toFixed(2)}</Line> a cancelar el día <Line className="min-w-[110px]">{formatDateStr(paymentDeadline)}</Line>. El pago total debe completarse antes de la primera clase práctica.
          </p>
        </section>

        <section className="border border-gray-200 p-3 rounded-sm">
          <h4 className="font-bold uppercase text-[9pt] mb-2 border-b border-gray-100 pb-1">SEGUNDA (DETALLES TÉCNICOS DEL CURSO)</h4>
          <div className="grid grid-cols-2 gap-4 text-[9pt]">
            <div className="space-y-1">
                <p>1. Categoría: 
                    A, C <Checkbox checked={details?.licenseCategory?.includes('A') && details?.licenseCategory?.includes('C')} /> 
                    A, C, D <Checkbox checked={details?.licenseCategory?.includes('D')} />
                </p>
                <p>2. Transmisión: 
                    Automático <Checkbox checked={details?.vehicleTransmission === 'Automático'} /> 
                    Manual <Checkbox checked={details?.vehicleTransmission === 'Manual'} />
                </p>
            </div>
            <div className="space-y-1">
                {!isSoloPractica && (
                    <p>3. Teoría: <span className="font-semibold underline">{details?.theoreticalClassSchedule || 'PENDIENTE'}</span></p>
                )}
                {!isSoloPractica && (
                    <div className="text-[8pt] text-gray-600 italic">
                        Sesiones: {(details?.theoreticalClassDates || []).map((d, i) => formatDateStr(d)).join(' | ')}
                    </div>
                )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-100">
            <p className="font-bold text-[9pt] mb-1">4. PROGRAMACIÓN DE CLASES PRÁCTICAS (Propuesta):</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[9pt]">
                {(details?.practicalClassSchedules || details?.motoPracticalClassSchedules || []).map((s, index) => (
                    <div key={index} className="flex items-center justify-between border-b border-dotted border-gray-300 pb-0.5">
                        <span className="font-bold">Clase {index + 1}:</span>
                        <span>{formatDateStr(s.date)}</span>
                        <span className="text-gray-500">|</span>
                        <span className="font-semibold">{s.time || '--:--'}</span>
                    </div>
                ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-2 text-[8.5pt] leading-tight text-justify">
            <p><span className="font-bold uppercase">TERCERA (ASISTENCIA):</span> La inasistencia sin aviso previo de 24h conlleva la pérdida de la clase. Justificación médica obligatoria para reposición. <span className="font-bold">Recargo de $20.00 por reprogramación no justificada.</span></p>
            <p><span className="font-bold uppercase">CUARTA (TRASLADO):</span> Las clases inician en la oficina. El traslado al circuito está incluido en las 2 horas de sesión.</p>
            <p><span className="font-bold uppercase">QUINTA (PUNTUALIDAD):</span> La tardanza del estudiante reduce el tiempo efectivo de clase sin reposición.</p>
            <p><span className="font-bold uppercase">SEXTA (CÓDIGO DE VESTIMENTA):</span> Prohibido escotes, minifaldas, camisetas sin mangas, pantalones cortos, leggins, chancletas o sandalias. Incumplimiento anula la clase.</p>
            <p><span className="font-bold uppercase">SÉPTIMA/OCTAVA:</span> Prohibido acompañantes. El estudiante declara aptitud física y mental para conducir.</p>
            <p><span className="font-bold uppercase">NOVENA/DÉCIMA:</span> Sin devolución de dinero por cancelación. El certificado se emite solo al completar teoría, práctica y pagos.</p>
            <p><span className="font-bold uppercase">UNDÉCIMA:</span> Vigencia del contrato: 3 meses desde la fecha de firma.</p>
        </div>

        <section className="mt-4 pt-4 border-t-2 border-black">
            <h3 className="font-bold uppercase text-center mb-2 text-[9pt]">DÉCIMA SEGUNDA - ACEPTACIÓN Y FIRMAS</h3>
            <p className="text-center italic text-[9pt] mb-6">
                Suscrito en la ciudad de Panamá, el día <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'd', { locale: es }) : '---'}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'MMMM', { locale: es }) : '---'}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'yyyy', { locale: es }) : '---'}</Value>, a las <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'HH:mm', { locale: es }) : '---'}</Value>.
            </p>
            
            <div className="flex justify-between px-12 pt-8">
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

      <div className="mt-12 text-center text-[7pt] text-gray-400 uppercase tracking-tighter">
        Documento interno de control administrativo • Confeccionado por: {contract.createdBy || 'Sistema'} • {format(new Date(), 'PPpp', { locale: es })}
      </div>
    </div>
  );
}
