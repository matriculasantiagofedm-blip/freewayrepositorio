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
    <div className="max-w-[8.5in] mx-auto bg-white p-10 font-serif text-[9pt] leading-[1.15] text-black print:p-0 print:m-0">
      {/* Encabezado Principal */}
      <div className="flex justify-between items-end border-b-2 border-black pb-3 mb-4">
        <div className="flex flex-col">
            <h1 className="font-black text-2xl uppercase tracking-tighter leading-none">FREEWAY</h1>
            <p className="text-[7pt] font-bold uppercase tracking-[0.2em]">Escuela de Manejo, S.A.</p>
        </div>
        <div className="text-center flex-1 px-4">
            <h2 className="font-bold text-[10.5pt] uppercase">CONTRATO POR SERVICIO DE CURSO DE MANEJO</h2>
        </div>
        <div className="text-right">
          <p className="text-[7pt] uppercase font-bold text-gray-500">Folio de Registro</p>
          <p className="font-black text-lg text-red-600">N° {String(contract.folioNumber || '').padStart(6, '0')}</p>
        </div>
      </div>

      {/* Párrafo Introductorio */}
      <div className="text-justify mb-3 text-[8.5pt]">
        La empresa <Value>FREEWAY ESCUELA DE MANEJO S.A.</Value>, con ubicación en La Chorrera, Vía Interamericana, Costa Verde, PH Green Plaza, Local #20, debidamente inscrita <Value>RUC 155628022-2-2016 DV 2</Value>, en adelante denominada <Value>LA EMPRESA</Value>, se compromete a brindar a EL ESTUDIANTE la capacitación teórico-práctica del curso “CURSO DE MANEJO”, que incluye la Certificación según la categoría seleccionada. Entre <Value>{contract.clientName?.toUpperCase()}</Value>, identificado con <Value>{details?.idType || 'C.I.P.'}</Value> N.° <Value>{details?.studentIdNumber}</Value>, con domicilio en <Value>{details?.studentAddress?.toUpperCase()}</Value>, teléfonos: <Value>{details?.studentPhone1}</Value> / <Value>{details?.studentPhone2 || '---'}</Value>, correo electrónico: <Value>{contract.clientEmail}</Value>, en adelante denominado <Value>EL ESTUDIANTE</Value>.
      </div>

      <h3 className="text-center font-bold text-[9.5pt] mb-2 uppercase tracking-widest bg-gray-100 py-0.5">DECLARAN:</h3>
      <p className="text-justify mb-3 text-[8.5pt]">Ambas partes convienen celebrar este contrato en el cual la empresa se compromete a brindar al cliente, un servicio de capacitación y adiestramiento teórico y práctico relacionado con el aprendizaje de conducción de vehículos a motor. El mismo se regirá bajo los términos y condiciones que se detallan en las siguientes cláusulas:</p>

      <div className="space-y-2.5">
        <section>
          <p className="text-justify">
            <span className="font-bold uppercase">CLÁUSULA PRIMERA - VALOR Y FORMA DE PAGO:</span> 
            El estudiante ha efectuado un abono por la suma de B/. <Value>{(details?.downPayment || 0).toFixed(2)}</Value>, quedando un saldo pendiente de B/. <Value>{(details?.balance || 0).toFixed(2)}</Value>, el cual se compromete a cancelar en su totalidad el día <Value>{formatDateStr(paymentDeadline)}</Value>. El valor total del curso es de B/. <Value>{(details?.courseValue || 0).toFixed(2)}</Value>. Para la inscripción, EL ESTUDIANTE deberá abonar el 50% del valor total como reserva de su cupo y horario. El 50% restante deberá cancelarse antes de iniciar la primera clase práctica. En caso de incumplimiento en los pagos, EL ESTUDIANTE no podrá continuar el curso.
          </p>
        </section>

        <section className="border border-gray-200 p-2.5 rounded-sm bg-slate-50/30">
          <h4 className="font-bold uppercase mb-1.5 border-b border-gray-200 pb-0.5">CLÁUSULA SEGUNDA - DETALLES DEL CURSO</h4>
          <div className="grid grid-cols-2 gap-x-4 text-[8.5pt]">
            <div className="space-y-1">
                <p>1. Categoría: 
                    A, C <Checkbox checked={details?.licenseCategory?.includes('A') && details?.licenseCategory?.includes('C')} /> 
                    A, C, D <Checkbox checked={details?.licenseCategory?.includes('D')} />
                </p>
                <p>2. Transmisión: 
                    Automático <Checkbox checked={details?.vehicleTransmission === 'Automático'} /> 
                    Manual <Checkbox checked={details?.vehicleTransmission === 'Manual'} />
                </p>
                {!isSoloPractica && (
                    <p>3. Teoría: <span className="font-semibold underline uppercase">{details?.theoreticalClassSchedule || 'PENDIENTE'}</span></p>
                )}
            </div>
            <div className="space-y-1">
                {!isSoloPractica && (
                    <div className="text-[8pt] text-gray-600 leading-tight">
                        <span className="font-bold uppercase block text-[7pt]">Sesiones Teóricas:</span>
                        {(details?.theoreticalClassDates || []).map((d, i) => formatDateStr(d)).join(' | ')}
                    </div>
                )}
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-gray-200">
            <p className="font-bold mb-1 uppercase text-[8pt]">4. Horario para clases prácticas (Propuesta):</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[8.5pt]">
                {(details?.practicalClassSchedules || details?.motoPracticalClassSchedules || []).map((s, index) => (
                    <div key={index} className="flex items-center justify-between border-b border-dotted border-gray-300 pb-0.5">
                        <span className="font-bold">Clase {index + 1}:</span>
                        <span>{formatDateStr(s.date)}</span>
                        <span className="font-semibold">{s.time || '--:--'}</span>
                    </div>
                ))}
            </div>
          </div>
        </section>

        <div className="space-y-1.5 text-[8.2pt] leading-snug text-justify">
            <p><span className="font-bold uppercase">CLÁUSULA TERCERA - INASISTENCIAS Y REPROGRAMACIONES:</span> EL ESTUDIANTE que no asista a una clase práctica en el horario establecido perderá automáticamente la sesión sin derecho a reposición. Si la falta es por salud, deberá presentar constancia médica. Si falta a más de una clase sin justificación, deberá pagar un recargo de <span className="font-black">$20.00</span> por cada clase para reprogramarla.</p>
            <p><span className="font-bold uppercase">CLÁUSULA CUARTA/QUINTA:</span> Las clases inician en la oficina; el traslado al circuito está incluido en las 2 horas. La tardanza del estudiante reduce su tiempo de clase sin derecho a reposición.</p>
            <p><span className="font-bold uppercase">CLÁUSULA SEXTA - VESTIMENTA:</span> Se prohíbe el acceso con escotes pronunciados, minifaldas, camisetas sin mangas, pantalones cortos (shorts), leggins, chancletas o sandalias. El incumplimiento implica la pérdida de la clase.</p>
            <p><span className="font-bold uppercase">CLÁUSULA SÉPTIMA/OCTAVA:</span> No se permiten acompañantes, niños o mascotas. EL ESTUDIANTE declara estar en pleno uso de sus facultades físicas y mentales para conducir.</p>
            <p><span className="font-bold uppercase">CLÁUSULA NOVENA/DÉCIMA:</span> En caso de cancelación por parte del estudiante, no habrá devolución de dinero. El certificado se entregará solo al completar satisfactoriamente los pagos y las horas de capacitación.</p>
            <p><span className="font-bold uppercase">CLÁUSULA UNDÉCIMA:</span> El curso tiene una vigencia de tres (3) meses a partir de la firma de este contrato.</p>
        </div>

        <section className="mt-3 pt-3 border-t-2 border-black">
            <h3 className="font-bold uppercase text-center mb-1.5 text-[9pt]">CLÁUSULA DÉCIMA SEGUNDA - ACEPTACIÓN</h3>
            <p className="text-center italic text-[8.5pt] mb-6">
                Suscrito en la ciudad de Panamá, a los <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'd', { locale: es }) : '---'}</Value> días del mes de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'MMMM', { locale: es }) : '---'}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'yyyy', { locale: es }) : '---'}</Value>, a las <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'HH:mm', { locale: es }) : '---'}</Value>.
            </p>
            
            <div className="flex justify-between px-16 pt-6">
                <div className="text-center w-[200px]">
                    <div className="border-t border-black mb-1"></div>
                    <p className="font-bold uppercase text-[7.5pt]">Por la Empresa</p>
                    <p className="text-[6.5pt] text-gray-500 italic">Freeway Escuela de Manejo S.A.</p>
                </div>
                <div className="text-center w-[200px]">
                    <div className="border-t border-black mb-1"></div>
                    <p className="font-bold uppercase text-[7.5pt]">El Cliente</p>
                    <p className="text-[7.5pt] font-bold">ID: {details?.studentIdNumber}</p>
                </div>
            </div>
        </section>
      </div>

      <div className="mt-8 text-center text-[6.5pt] text-gray-400 uppercase tracking-tighter">
        Documento interno de control administrativo • Confeccionado por: {contract.createdBy || 'Sistema'} • {format(new Date(), 'PPpp', { locale: es })}
      </div>
    </div>
  );
}
