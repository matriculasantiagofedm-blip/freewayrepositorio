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
  const isAutoContract = contract.type === 'Curso Auto';
  const isMotoContract = contract.type === 'Curso Moto';
  const isMixtoContract = contract.type === 'Curso Mixto';
  
  const licenseStr = details?.licenseCategory || '';

  // Lógica de validación de servicios para evitar duplicidad o errores de agenda
  const showAutoSessions = isAutoContract || isMixtoContract || (isMotoContract && details?.additionalService === 'Curso Plus Auto 10Hrs') || (isSoloPractica && (details as any)?.vehicleType === 'Auto');
  const showMotoSessions = isMotoContract || isMixtoContract || (isAutoContract && details?.additionalService === 'Plus Moto 10Hrs') || (isSoloPractica && (details as any)?.vehicleType === 'Motocicleta');

  return (
    <div className="max-w-[8.5in] mx-auto bg-white p-10 font-serif text-[8.5pt] leading-[1.15] text-black print:p-0 print:m-0">
      <div className="flex justify-between items-end border-b-2 border-black pb-3 mb-4">
        <div className="flex flex-col">
            <h1 className="font-black text-2xl uppercase tracking-tighter leading-none">FREEWAY</h1>
            <p className="text-[7pt] font-bold uppercase tracking-[0.2em]">Escuela de Manejo, S.A.</p>
        </div>
        <div className="text-center flex-1 px-4">
            <h2 className="font-bold text-[11pt] uppercase">CONTRATO POR SERVICIO DE CURSO DE MANEJO</h2>
        </div>
        <div className="text-right">
          <p className="text-[7pt] uppercase font-bold text-gray-500">Folio de Registro</p>
          <p className="font-black text-lg text-red-600">N° {String(contract.folioNumber || '').padStart(6, '0')}</p>
        </div>
      </div>



      <div className="text-justify mb-3">
        La empresa <Value>FREEWAY ESCUELA DE MANEJO S.A.</Value>, con ubicación en La Chorrera, Vía Interamericana, Costa Verde, PH Green Plaza, Local #20, debidamente inscrita <Value>RUC 155628022-2-2016 DV 2</Value>, en adelante denominada <Value>LA EMPRESA</Value>, se compromete a brindar a EL ESTUDIANTE la capacitación teórico-práctica del curso “CURSO DE MANEJO”, que incluye la Certificación según la categoría seleccionada. Entre <Value>{contract.clientName?.toUpperCase()}</Value>, identificado con <Value>{details?.idType || 'C.I.P.'}</Value> N.° <Value>{details?.studentIdNumber}</Value>, con domicilio en <Value>{details?.studentAddress?.toUpperCase()}</Value>, teléfonos: <Value>{details?.studentPhone1}</Value> / <Value>{details?.studentPhone2 || '---'}</Value>, correo electrónico: <Value>{contract.clientEmail}</Value>, en adelante denominado <Value>EL ESTUDIANTE</Value>.
      </div>

      <h3 className="text-center font-bold text-[9pt] mb-1 uppercase tracking-widest bg-gray-100 py-0.5">DECLARAN:</h3>
      <p className="text-justify mb-2">Ambas partes convienen celebrar este contrato en el cual la empresa se compromete a brindar al cliente, un servicio de capacitación y adiestramiento teórico y práctico relacionado con el aprendizaje de conducción de vehículos a motor. El mismo se regirá bajo los términos y condiciones que se detallan en las siguientes cláusulas:</p>

      <div className="space-y-2">
        <section>
          <h4 className="font-bold uppercase mb-1">CLÁUSULA PRIMERA - VALOR Y FORMA DE PAGO</h4>
          <p className="text-justify leading-snug">
            El estudiante ha efectuado un <span className="font-bold">ABONO</span> por la suma de <Value>B/. {(Number(details?.downPayment) || 0).toFixed(2)}</Value>, quedando un <span className="font-bold">SALDO PENDIENTE</span> de <Value>B/. {(Number(details?.balance) || 0).toFixed(2)}</Value>, el cual se compromete a cancelar en su totalidad el día <span className="font-bold underline">{formatDateStr(paymentDeadline)}</span>. El valor total del curso es de <Value>B/. {(Number(details?.courseValue) || 0).toFixed(2)}</Value>. Para la inscripción, EL ESTUDIANTE deberá abonar el 50% del valor total como reserva de su cupo y horario. El 50% restante deberá cancelarse antes de iniciar la primera clase práctica. En caso de incumplimiento en los pagos, EL ESTUDIANTE no podrá continuar el curso.
          </p>
        </section>

        <section className="border border-gray-200 p-2 rounded-sm">
          <h4 className="font-bold uppercase mb-1 border-b border-gray-200 pb-0.5">CLÁUSULA SEGUNDA - DETALLES DEL CURSO</h4>
          <div className="grid grid-cols-1 gap-y-1 text-[8pt]">
            <div className="space-y-1">
                <p>1. Categoría de licencia a aplicar: 
                    A, B <Checkbox checked={licenseStr === 'A, B'} /> 
                    A, C <Checkbox checked={licenseStr === 'A, C'} /> 
                    A, C, D <Checkbox checked={licenseStr === 'A, C, D'} /> 
                    A, B, C <Checkbox checked={licenseStr === 'A, B, C' || licenseStr === 'A, C, B'} /> 
                    A, B, C, D <Checkbox checked={licenseStr === 'A, B, C, D' || licenseStr === 'A, C, B, D'} />
                </p>
                <div className="flex gap-8">
                  <p>2. Transmisión del vehículo: 
                      Automático <Checkbox checked={details?.vehicleTransmission === 'Automático'} /> 
                      Manual <Checkbox checked={details?.vehicleTransmission === 'Manual' || details?.vehicleTransmission === 'Moto'} />
                  </p>
                  {!isSoloPractica && <p>3. Horario clases teóricas: <span className="font-semibold underline uppercase">{details?.theoreticalClassSchedule || 'PENDIENTE'}</span></p>}
                </div>
            </div>
            <div className="space-y-1">
                {!isSoloPractica && <div className="text-[7.5pt] text-gray-600">{(details?.theoreticalClassDates || []).map((d, i) => formatDateStr(d)).join(' | ')}</div>}
            </div>
          </div>
          <div className="mt-2 pt-1 border-t border-gray-200">
            <p className="font-bold mb-1 uppercase text-[7.5pt]">4. Propuesta de Horario Práctico:</p>
            
            {/* AGENDA DE AUTO - Filtrada por servicio */}
            {showAutoSessions && details?.practicalClassSchedules && details.practicalClassSchedules.length > 0 && (
                <div className="mb-2">
                    {showMotoSessions && (
                        <p className="text-[7pt] font-black italic underline mb-0.5 uppercase">Sesiones de Auto:</p>
                    )}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[8pt]">
                        {details.practicalClassSchedules.map((s, index) => (
                            <div key={index} className="flex items-center justify-between border-b border-dotted border-gray-300">
                                <span className="font-bold">Sesión {index + 1}:</span>
                                <span>{formatDateStr(s.date)}</span>
                                <span className="font-semibold">{s.time}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* AGENDA DE MOTO - Filtrada por servicio */}
            {showMotoSessions && details?.motoPracticalClassSchedules && details.motoPracticalClassSchedules.length > 0 && (
                <div>
                    {showAutoSessions && (
                        <p className="text-[7pt] font-black italic underline mb-0.5 uppercase">Sesiones de Moto:</p>
                    )}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[8pt]">
                        {details.motoPracticalClassSchedules.map((s, index) => (
                            <div key={index} className="flex items-center justify-between border-b border-dotted border-gray-300">
                                <span className="font-bold">Sesión {index + 1}:</span>
                                <span>{formatDateStr(s.date)}</span>
                                <span className="font-semibold">{s.time}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </section>

        <div className="space-y-1.5 text-[8pt] leading-snug text-justify">

          {/* CLÁUSULA TERCERA */}
          <div>
            <p className="font-bold uppercase mb-0.5">CLÁUSULA TERCERA - INASISTENCIAS Y REPROGRAMACIONES</p>
            <ul className="space-y-0.5 pl-1">
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">▪</span>
                <span>EL ESTUDIANTE que no asista a una clase práctica en el horario establecido <strong>perderá automáticamente la clase práctica sin derecho a reposición ni reclamo.</strong></span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">▪</span>
                <span><strong>Excepción</strong>: Si la falta es por <strong>motivo de salud</strong>, deberá presentar constancia médica válida y coordinar con la administración para una reprogramación, la cual dependerá de la disponibilidad de horarios.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">▪</span>
                <span>Si EL ESTUDIANTE falta a una o más de una clase práctica sin justificar médicamente, <strong>no tendrá derecho a certificado</strong> y deberá pagar un <strong>recargo de $20.00 por cada clase perdida</strong> para poder reprogramarla.</span>
              </li>
            </ul>
          </div>

          {/* CLÁUSULA CUARTA */}
          <div>
            <p className="font-bold uppercase mb-0.5">CLÁUSULA CUARTA - LUGAR DE INICIO Y TRASLADO</p>
            <p>Las clases prácticas iniciarán en la oficina de LA ESCUELA. Desde allí, EL ESTUDIANTE será trasladado al circuito de prácticas y posteriormente de regreso. Dicho traslado se encuentra incluido dentro del tiempo de las <strong>2 horas de clase práctica.</strong></p>
          </div>

          {/* CLÁUSULA QUINTA */}
          <div>
            <p className="font-bold uppercase mb-0.5">CLÁUSULA QUINTA - RESTRICCIONES DE ACOMPAÑANTES</p>
            <p>No se permitirá bajo ningún concepto el ingreso de acompañantes, niños, mascotas o terceras personas durante las clases teóricas o prácticas.</p>
          </div>

          {/* CLÁUSULA SEXTA */}
          <div>
            <p className="font-bold uppercase mb-0.5">CLÁUSULA SEXTA - PUNTUALIDAD</p>
            <p>En caso de que EL ESTUDIANTE llegue tarde a su clase, <strong>solo recibirá el tiempo restante de las 2 horas programadas</strong>, sin derecho a reposición.</p>
          </div>

          {/* CLÁUSULA SÉPTIMA */}
          <div>
            <p className="font-bold uppercase mb-0.5">CLÁUSULA SÉPTIMA - CANCELACIÓN DEL CURSO</p>
            <p>Si EL ESTUDIANTE decide cancelar el curso una vez iniciada la inscripción, no habrá devolución de dinero bajo ninguna circunstancia.</p>
          </div>

          {/* CLÁUSULA OCTAVA */}
          <div>
            <p className="font-bold uppercase mb-0.5">CLÁUSULA OCTAVA - OBLIGACIONES DEL ESTUDIANTE</p>
            <p className="mb-0.5">EL ESTUDIANTE se compromete a:</p>
            <ol className="list-decimal pl-5 space-y-0.5">
              <li>Seguir las instrucciones del instructor.</li>
              <li>Mantener una actitud respetuosa y adecuada durante las clases.</li>
              <li>Asistir en estado óptimo de salud física, mental y emocional.</li>
            </ol>
          </div>

          {/* CLÁUSULA NOVENA */}
          <div>
            <p className="font-bold uppercase mb-0.5">CLÁUSULA NOVENA - VESTIMENTA</p>
            <p className="mb-0.5">Para las clases prácticas y teóricas, EL ESTUDIANTE deberá asistir con ropa adecuada. Se prohíbe presentarse con:</p>
            <ul className="space-y-0.5 pl-1">
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">▪</span>
                <span>Escotes pronunciados, minifaldas, camisetas sin mangas, pantalones cortos, leggins, chancletas o sandalias.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">▪</span>
                <span>El incumplimiento de esta norma implica la <strong>pérdida automática de la clase</strong>, sin derecho a reposición.</span>
              </li>
            </ul>
          </div>

          {/* CLÁUSULA DÉCIMA */}
          <div>
            <p className="font-bold uppercase mb-0.5">CLÁUSULA DÉCIMA - CERTIFICACIÓN</p>
            <p className="mb-0.5">El certificado de aprobación del curso será entregado únicamente si EL ESTUDIANTE:</p>
            <ol className="list-decimal pl-5 space-y-0.5">
              <li>Está paz y salvo en sus pagos.</li>
              <li>Ha completado la totalidad del curso teórico y práctico.</li>
            </ol>
          </div>

          {/* CLÁUSULA DÉCIMA PRIMERA */}
          <div>
            <p className="font-bold uppercase mb-0.5">CLÁUSULA DÉCIMA PRIMERA - VIGENCIA DEL CURSO</p>
            <p>Si EL ESTUDIANTE no establece contacto para finalizar su curso en un plazo de <strong>tres (3) meses</strong> desde la fecha de inicio, se entenderá que renuncia a continuar, sin derecho a devolución del dinero ni a reclamos posteriores.</p>
          </div>
        </div>

        <section className="mt-2 pt-2 border-t-2 border-black">
            <h3 className="font-bold uppercase text-center mb-1 text-[8.5pt]">CLÁUSULA DÉCIMA SEGUNDA - ACEPTACIÓN</h3>
            <p className="text-justify text-[8pt] mb-2">Ambas partes declaran haber leído, entendido y aceptado el presente contrato, firmándolo en señal de conformidad.</p>
            <p className="text-[8pt] mb-6">
              En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, República de panamá, a los{' '}
              <Line className="min-w-[50px]">{!isNaN(creationDate.getTime()) ? format(creationDate, 'd', { locale: es }) : ''}</Line>{' '}
              días del mes de{' '}
              <Line className="min-w-[90px]">{!isNaN(creationDate.getTime()) ? format(creationDate, 'MMMM', { locale: es }) : ''}</Line>
              {', de '}
              <Line className="min-w-[40px]">{!isNaN(creationDate.getTime()) ? format(creationDate, 'yyyy', { locale: es }) : ''}</Line>
              {', a las '}
              <Line className="min-w-[60px]" />.
            </p>
            <div className="flex justify-between px-16 pt-6">
                <div className="text-center w-[220px]"><div className="border-t border-black mb-1"></div><p className="font-bold uppercase text-[7pt]">Por la Empresa</p></div>
                <div className="text-center w-[220px]"><div className="border-t border-black mb-1"></div><p className="font-bold uppercase text-[7pt]">Firma del Estudiante</p></div>
            </div>
        </section>

      </div>
      <div className="mt-6 text-center text-[6pt] text-gray-400 uppercase tracking-tighter">Documento interno • Confeccionado por: {contract.createdBy || 'Sistema'} • {format(new Date(), 'PPpp', { locale: es })}</div>
    </div>
  );
}
