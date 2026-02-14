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

const Checkbox = ({ checked }: { checked: boolean }) => (
    <span className="inline-flex items-center justify-center border border-black w-4 h-4 mr-1 align-middle">
        {checked ? <span className="text-[10px] font-bold">X</span> : null}
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
    <div className="max-w-[8.5in] mx-auto bg-white p-8 font-serif text-[10pt] leading-snug text-black print:p-0 print:m-0">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <h1 className="font-bold text-[11pt] uppercase">CONTRATO POR SERVICIO DE CURSO DE MANEJO</h1>
        <div className="text-right">
          <p className="font-bold text-[11pt]">CONTRATO N° {String(contract.folioNumber || '').padStart(6, '0')}</p>
        </div>
      </div>

      {/* Intro */}
      <div className="text-justify mb-4">
        La empresa <Value>FREEWAY ESCUELA DE MANEJO S.A.</Value>, con ubicación en La Chorrera, Vía Interamericana, Costa Verde, PH Green Plaza, Local #20, debidamente inscrita RUC <Value>155628022-2-2016 DV 2</Value>, en adelante denominada LA EMPRESA. Entre <Line>{contract.clientName}</Line>, identificado con <Value>{details?.idType || 'C.I.P.'} N.°</Value> <Line>{details?.studentIdNumber}</Line>, con domicilio en <Line>{details?.studentAddress}</Line>, teléfonos: <Line>{details?.studentPhone1} / {details?.studentPhone2 || '---'}</Line>, correo electrónico: <Line>{contract.clientEmail}</Line>, en adelante denominado EL ESTUDIANTE.
      </div>

      <h2 className="text-center font-bold text-[11pt] mb-2">DECLARAN:</h2>
      <p className="text-justify mb-4">
        Ambas partes convienen celebrar este contrato en el cual la empresa se compromete a brindar al cliente, un servicio de capacitación y adiestramiento teórico y práctico relacionado con el aprendizaje de conducción de vehículos a motor. El mismo se regirá bajo los términos y condiciones que se detallan en las siguientes cláusulas:
      </p>

      {/* Cláusulas */}
      <div className="space-y-3">
        <section>
          <h3 className="font-bold uppercase">CLÁUSULA PRIMERA - VALOR Y FORMA DE PAGO</h3>
          <p>El valor total del curso es de <Value>{details?.courseValue?.toFixed(2)} (B/.)</Value>.</p>
          <p>"El estudiante ha efectuado un abono por la suma de B/. <Line>{details?.downPayment?.toFixed(2)}</Line>, quedando un saldo pendiente de B/. <Line>{(details?.balance || 0).toFixed(2)}</Line>, el cual se compromete a cancelar en su totalidad el día <Line>{formatDateStr(paymentDeadline)}</Line>."</p>
          <ul className="list-disc list-inside pl-4 mt-1 text-[9pt]">
            <li>Para la inscripción, EL ESTUDIANTE deberá abonar el 25% del valor total como reserva de su cupo y horario.</li>
            <li>El saldo restante deberá cancelarse antes de iniciar la primera clase práctica.</li>
            <li>En caso de incumplimiento en los pagos, EL ESTUDIANTE no podrá continuar el curso.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-bold uppercase">CLÁUSULA SEGUNDA - DETALLES DEL CURSO</h3>
          <div className="pl-4 space-y-1">
            <p>1. Categoría de licencia a aplicar: 
                A, C <Checkbox checked={details?.licenseCategory === 'A, C'} /> / 
                A, C, D <Checkbox checked={details?.licenseCategory === 'A, C, D'} />
            </p>
            <p>2. Transmisión del vehículo: 
                Automático <Checkbox checked={details?.vehicleTransmission === 'Automático'} /> / 
                Manual <Checkbox checked={details?.vehicleTransmission === 'Manual'} />
            </p>
            
            {!isSoloPractica && (
                <div className="mt-2">
                    <p className="font-bold inline">3. Horario para clases teóricas:</p>
                    <span className="ml-2 font-bold underline decoration-dotted">{details?.theoreticalClassSchedule || 'A COORDINAR'}</span>
                    <div className="flex flex-wrap gap-x-4 mt-1 text-[9pt]">
                        {(details?.theoreticalClassDates || []).map((date, index) => (
                            <span key={index}><span className="font-bold">Clase {index + 1}:</span> {formatDateStr(date)}</span>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-2">
                <p className="font-bold">4. Horario para clases prácticas (Fecha y Hora):</p>
                <div className="border border-black mt-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-black">
                                <th className="p-1 border-r border-black text-[9pt] font-bold">Clase</th>
                                <th className="p-1 border-r border-black text-[9pt] font-bold">Fecha</th>
                                <th className="p-1 text-[9pt] font-bold">Hora</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(details?.practicalClassSchedules || details?.motoPracticalClassSchedules || []).map((s, index) => (
                                <tr key={index} className="border-b border-black last:border-0">
                                    <td className="p-1 border-r border-black font-bold">○ Clase {index + 1}:</td>
                                    <td className="p-1 border-r border-black">{formatDateStr(s.date)}</td>
                                    <td className="p-1">{s.time || '---'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-bold uppercase">CLÁUSULA TERCERA - INASISTENCIAS Y REPROGRAMACIONES</h3>
          <p className="text-justify text-[9pt]">
            EL ESTUDIANTE que no asista a una clase práctica en el horario establecido perderá automáticamente la clase práctica sin derecho a reposición ni reclamo. Excepción: Si la falta es por motivo de salud, deberá presentar constancia médica válida y coordinar con la administración para una reprogramación, la cual dependerá de la disponibilidad de horarios. <span className="font-bold">SI EL ESTUDIANTE falta a más de una clase práctica sin justificar médicamente, no tendrá derecho a certificado y deberá pagar un recargo de $20.00 por cada clase perdida para poder reprogramarla.</span>
          </p>
        </section>

        <div className="grid grid-cols-1 gap-2 text-[9pt]">
            <p><span className="font-bold uppercase">CLÁUSULA CUARTA - LUGAR DE INICIO Y TRASLADO:</span> Las clases prácticas iniciarán en la oficina de LA ESCUELA. Desde allí, EL ESTUDIANTE será trasladado al circuito de prácticas y posteriormente de regreso. Dicho traslado se encuentra incluido dentro del tiempo de las 2 horas de clase práctica.</p>
            <p><span className="font-bold uppercase">CLÁUSULA QUINTA - PUNTUALIDAD:</span> En caso de que EL ESTUDIANTE llegue tarde a su clase, solo recibirá el tiempo restante de las 2 horas programadas, sin derecho a reposición.</p>
            <p><span className="font-bold uppercase">CLÁUSULA SEXTA - NORMAS DE COMPORTAMIENTO E VESTIMENTA:</span> EL ESTUDIANTE se compromete a asistir con ropa adecuada. Se prohíbe presentarse con: Escotes pronunciados, minifaldas, camisetas sin mangas, pantalones cortos, leggins, chancletas o sandalias. El incumplimiento implica la pérdida automática de la clase.</p>
            <p><span className="font-bold uppercase">CLÁUSULA SÉPTIMA - ACOMPAÑANTES Y ACCESO:</span> No se permite la presencia de acompañantes, niños o mascotas durante las clases.</p>
            <p><span className="font-bold uppercase">CLÁUSULA OCTAVA - CONDICIONES DE APTITUD:</span> EL ESTUDIANTE declara estar en pleno uso de sus facultades físicas y mentales.</p>
            <p><span className="font-bold uppercase">CLÁUSULA NOVENA - CANCELACIÓN DEL CONTRATO:</span> No habrá devolución de dinero bajo ninguna circunstancia.</p>
            <p><span className="font-bold uppercase">CLÁUSULA DÉCIMA - CERTIFICACIÓN:</span> Se entregará únicamente al completar el curso y estar paz y salvo.</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-[10pt] mb-12">
            Suscrito en Panamá, el <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'd', { locale: es }) : '---'}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'LLLL', { locale: es }) : '---'}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'yyyy', { locale: es }) : '---'}</Value>.
        </p>
        <div className="flex justify-around px-12">
            <div className="text-center w-[250px]">
                <div className="border-t border-black mb-1"></div>
                <p className="font-bold">Por la Empresa</p>
            </div>
            <div className="text-center w-[250px]">
                <div className="border-t border-black mb-1"></div>
                <p className="font-bold">El Estudiante</p>
                <p className="text-[8pt]">ID: {details?.studentIdNumber}</p>
            </div>
        </div>
      </div>

      <div className="mt-8 text-right text-[8pt] text-gray-500 italic">
        Confeccionado por: {contract.createdBy || 'Sistema'}
      </div>
    </div>
  );
}
