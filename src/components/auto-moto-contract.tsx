'use client';
import type { Contract } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span className={cn("border-b border-dotted border-black inline-block px-1 min-w-[40px] font-semibold text-black", className)}>
    {children || <>&nbsp;</>}
  </span>
);

const Value = ({ children }: { children: React.ReactNode }) => <span className="font-semibold text-black">{children}</span>;

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
    <div className="max-w-[8.5in] mx-auto bg-white p-10 font-serif text-[9.5pt] leading-tight text-black print:p-0 print:m-0">
      {/* Encabezado Principal */}
      <div className="flex justify-between items-start mb-2">
        <h1 className="font-bold text-[10.5pt] uppercase">CONTRATO POR SERVICIO DE CURSO DE MANEJO</h1>
        <div className="text-right">
          <p className="font-bold text-[10.5pt] text-red-600 print:text-red-600">CONTRATO N° {String(contract.folioNumber || '').padStart(6, '0')}</p>
        </div>
      </div>

      {/* Párrafo Introductorio */}
      <div className="text-justify mb-2 leading-relaxed">
        La empresa <Value>FREEWAY ESCUELA DE MANEJO S.A.</Value>, con ubicación en La Chorrera, Vía Interamericana, Costa Verde, PH Green Plaza, Local #20, debidamente inscrita RUC <Value>155628022-2-2016 DV 2</Value>, en adelante denominada LA EMPRESA, se compromete a brindar a EL ESTUDIANTE la capacitación teórico-práctica del curso "CURSO DE MANEJO", que incluye la Certificación según la categoría seleccionada. Entre <Line className="min-w-[250px]">{contract.clientName?.toUpperCase()}</Line>, identificado con <Value>{details?.idType || 'C.I.P.'} N.°</Value> <Line className="min-w-[120px]">{details?.studentIdNumber}</Line>, con domicilio en <Line className="min-w-[200px]">{details?.studentAddress?.toUpperCase()}</Line>, teléfonos: <Line className="min-w-[100px]">{details?.studentPhone1}</Line> / <Line className="min-w-[100px]">{details?.studentPhone2 || '---'}</Line>, correo electrónico: <Line className="min-w-[180px]">{contract.clientEmail}</Line>, en adelante denominado EL ESTUDIANTE.
      </div>

      <h2 className="text-center font-bold text-[10pt] mb-1 uppercase underline decoration-1">DECLARAN:</h2>
      <p className="text-justify mb-2 leading-tight italic">
        Ambas partes convienen celebrar este contrato en el cual la empresa se compromete a brindar al cliente, un servicio de capacitación y adiestramiento teórico y práctico relacionado con el aprendizaje de conducción de vehículos a motor. El mismo se regirá bajo los términos y condiciones que se detallan en las siguientes cláusulas:
      </p>

      {/* Listado de Cláusulas */}
      <div className="space-y-2">
        <section>
          <h3 className="font-bold uppercase inline">CLÁUSULA PRIMERA - VALOR Y FORMA DE PAGO: </h3>
          <span className="leading-tight">
            "El estudiante ha efectuado un abono por la suma de B/. <Line className="min-w-[60px]">{details?.downPayment?.toFixed(2)}</Line>, quedando un saldo pendiente de B/. <Line className="min-w-[60px]">{(details?.balance || 0).toFixed(2)}</Line>, el cual se compromete a cancelar en su totalidad el día <Line className="min-w-[100px]">{formatDateStr(paymentDeadline)}</Line>."
          </span>
          <ul className="list-disc list-inside pl-4 mt-0.5 text-[9pt] italic">
            <li>El valor total del curso es de B/. <Value>{details?.courseValue?.toFixed(2)}</Value>.</li>
            <li>Para la inscripción, EL ESTUDIANTE deberá abonar el 50% del valor total como reserva de su cupo y horario.</li>
            <li>El 50% restante deberá cancelarse antes de iniciar la primera clase práctica.</li>
            <li>En caso de incumplimiento en los pagos, EL ESTUDIANTE no podrá continuar el curso.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-bold uppercase">CLÁUSULA SEGUNDA - DETALLES DEL CURSO</h3>
          <div className="pl-4 space-y-0.5">
            <p>1. Categoría de licencia a aplicar: 
                A, C <Checkbox checked={details?.licenseCategory?.includes('A') && details?.licenseCategory?.includes('C')} /> / 
                A, C, D <Checkbox checked={details?.licenseCategory?.includes('D')} /> /
                Otras: <Line className="min-w-[80px]">{details?.licenseCategory?.replace('A, C, D', '')?.replace('A, C', '')}</Line>
            </p>
            <p>2. Transmisión del vehículo: 
                Automático <Checkbox checked={details?.vehicleTransmission === 'Automático'} /> / 
                Manual <Checkbox checked={details?.vehicleTransmission === 'Manual'} />
            </p>
            
            {!isSoloPractica && (
                <div>
                    <p className="font-bold inline">3. Horario para clases teóricas:</p>
                    <span className="ml-2 underline decoration-dotted">{details?.theoreticalClassSchedule || 'A COORDINAR'}</span>
                    <div className="flex flex-wrap gap-x-4 mt-0.5 text-[8.5pt]">
                        {(details?.theoreticalClassDates || []).map((date, index) => (
                            <span key={index}><span className="font-bold">Sesión {index + 1}:</span> {formatDateStr(date)}</span>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-1">
                <p className="font-bold">4. Horario para clases prácticas (Fecha y Hora):</p>
                <div className="mt-0.5 pl-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9pt]">
                    {(details?.practicalClassSchedules || details?.motoPracticalClassSchedules || []).map((s, index) => (
                        <div key={index} className="flex items-center">
                            <span className="font-bold min-w-[65px]">○ Clase {index + 1}:</span>
                            <Line className="min-w-[85px] border-dotted">{formatDateStr(s.date)}</Line>
                            <span className="font-bold mx-1">Hora:</span>
                            <Line className="min-w-[100px] border-dotted text-[8pt]">{s.time || '---'}</Line>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </section>

        <section className="text-justify">
          <h3 className="font-bold uppercase inline">CLÁUSULA TERCERA - INASISTENCIAS Y REPROGRAMACIONES: </h3>
          <span className="text-[9pt]">
            EL ESTUDIANTE que no asista a una clase práctica en el horario establecido perderá automáticamente la clase práctica sin derecho a reposición ni reclamo. Excepción: Si la falta es por motivo de salud, deberá presentar constancia médica válida y coordinar con la administración para una reprogramación, la cual dependerá de la disponibilidad de horarios. <span className="font-bold">SI EL ESTUDIANTE falta a más de una clase práctica sin justificar médicamente, no tendrá derecho a certificado y deberá pagar un recargo de $20.00 por cada clase perdida para poder reprogramarla.</span>
          </span>
        </section>

        <section className="text-justify leading-snug">
            <p className="mb-1"><span className="font-bold uppercase">CLÁUSULA CUARTA - LUGAR DE INICIO Y TRASLADO:</span> Las clases prácticas iniciarán en la oficina de LA ESCUELA. Desde allí, EL ESTUDIANTE será trasladado al circuito de prácticas y posteriormente de regreso. Dicho traslado se encuentra incluido dentro del tiempo de las 2 horas de clase práctica.</p>
            <p className="mb-1"><span className="font-bold uppercase">CLÁUSULA QUINTA - PUNTUALIDAD:</span> En caso de que EL ESTUDIANTE llegue tarde a su clase, solo recibirá el tiempo restante de las 2 horas programadas, sin derecho a reposición.</p>
            <p className="mb-1"><span className="font-bold uppercase">CLÁUSULA SEXTA - NORMAS DE COMPORTAMIENTO E VESTIMENTA:</span> EL ESTUDIANTE se compromete a asistir con ropa adecuada. Se prohíbe presentarse con: Escotes pronunciados, minifaldas, camisetas sin mangas, pantalones cortos, leggins, chancletas o sandalias. El incumplimiento implica la pérdida automática de la clase, sin derecho a reposición.</p>
            <p className="mb-1"><span className="font-bold uppercase">CLÁUSULA SÉPTIMA - ACOMPAÑANTES Y ACCESO:</span> Durante las clases teóricas y prácticas no se permite la presencia de acompañantes, niños, mascotas o terceras personas ajenas al proceso de enseñanza.</p>
            <p className="mb-1"><span className="font-bold uppercase">CLÁUSULA OCTAVA - CONDICIONES DE APTITUD:</span> EL ESTUDIANTE declara estar en pleno uso de sus facultades físicas, mentales y emocionales, siendo responsable de informar a LA ESCUELA sobre cualquier condición médica que limite su desempeño.</p>
            <p className="mb-1"><span className="font-bold uppercase">CLÁUSULA NOVENA - CANCELACIÓN DEL CONTRATO:</span> En caso de que EL ESTUDIANTE decida cancelar el curso o el contrato, no habrá devolución de dinero bajo ninguna circunstancia.</p>
            <p className="mb-1"><span className="font-bold uppercase">CLÁUSULA DÉCIMA - CERTIFICACIÓN:</span> El certificado de aprobación del curso será entregado únicamente si EL ESTUDIANTE: Está paz y salvo en sus pagos y ha completado la totalidad del curso teórico y práctico.</p>
            <p className="mb-1"><span className="font-bold uppercase">CLÁUSULA DÉCIMA PRIMERA - VIGENCIA DEL CURSO:</span> Si EL ESTUDIANTE no establece contacto para finalizar su curso en un plazo de tres (3) meses desde la fecha de inicio, se entenderá que renuncia a continuar, sin derecho a devolución del dinero ni a reclamos posteriores.</p>
            
            <section className="pt-1 mt-1 border-t border-black/10">
                <h3 className="font-bold uppercase text-center mb-1">CLÁUSULA DÉCIMA SEGUNDA - ACEPTACIÓN</h3>
                <p className="text-center italic">
                    En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, República de panamá, a los <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'd', { locale: es }) : '---'}</Value> días del mes de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'MMMM', { locale: es }) : '---'}</Value>, de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'yyyy', { locale: es }) : '---'}</Value>, a las <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'HH:mm', { locale: es }) : '---'}</Value>.
                </p>
            </section>
        </section>
      </div>

      {/* Área de Firmas */}
      <div className="mt-14 flex justify-between px-16">
          <div className="text-center w-[220px] flex flex-col items-center">
              <div className="w-full border-t border-black mb-1"></div>
              <p className="text-[9pt] font-bold uppercase">Por la Empresa</p>
              <p className="text-[7pt] italic">Freeway Escuela de Manejo S.A.</p>
          </div>
          <div className="text-center w-[220px] flex flex-col items-center">
              <div className="w-full border-t border-black mb-1"></div>
              <p className="text-[9pt] font-bold uppercase">El Cliente</p>
              <p className="text-[8pt] font-bold">ID: <Value>{details?.studentIdNumber}</Value></p>
          </div>
      </div>

      <div className="mt-10 text-center text-[8pt] text-gray-500 border-t border-dotted border-gray-300 pt-2 italic">
        Documento administrativo confeccionado por: {contract.createdBy || 'Sistema Operativo'}
      </div>
    </div>
  );
}
