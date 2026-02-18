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
  const isMoto = contract.type === 'Curso Moto' || details?.vehicleTransmission === 'Moto' || details?.vehicleTransmission === 'Motocicleta';

  return (
    <div className="max-w-[8.5in] mx-auto bg-white p-10 font-serif text-[9pt] leading-[1.2] text-black print:p-0 print:m-0">
      {/* Encabezado Principal */}
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

      {/* Párrafo Introductorio */}
      <div className="text-justify mb-3 text-[8.5pt]">
        La empresa <Value>FREEWAY ESCUELA DE MANEJO S.A.</Value>, con ubicación en La Chorrera, Vía Interamericana, Costa Verde, PH Green Plaza, Local #20, debidamente inscrita <Value>RUC 155628022-2-2016 DV 2</Value>, en adelante denominada <Value>LA EMPRESA</Value>, se compromete a brindar a EL ESTUDIANTE la capacitación teórico-práctica del curso “CURSO DE MANEJO”, que incluye la Certificación según la categoría seleccionada. Entre <Value>{contract.clientName?.toUpperCase()}</Value>, identificado con <Value>{details?.idType || 'C.I.P.'}</Value> N.° <Value>{details?.studentIdNumber}</Value>, con domicilio en <Value>{details?.studentAddress?.toUpperCase()}</Value>, teléfonos: <Value>{details?.studentPhone1}</Value> / <Value>{details?.studentPhone2 || '---'}</Value>, correo electrónico: <Value>{contract.clientEmail}</Value>, en adelante denominado <Value>EL ESTUDIANTE</Value>.
      </div>

      <h3 className="text-center font-bold text-[10pt] mb-2 uppercase tracking-widest bg-gray-100 py-0.5">DECLARAN:</h3>
      <p className="text-justify mb-3 text-[8.5pt]">Ambas partes convienen celebrar este contrato en el cual la empresa se compromete a brindar al cliente, un servicio de capacitación y adiestramiento teórico y práctico relacionado con el aprendizaje de conducción de vehículos a motor. El mismo se regirá bajo los términos y condiciones que se detallan en las siguientes cláusulas:</p>

      <div className="space-y-3">
        <section className="border border-slate-200 p-3 rounded-sm bg-slate-50/20">
          <h4 className="font-bold uppercase mb-2 border-b border-slate-200 pb-1 text-[9.5pt]">CLÁUSULA PRIMERA - VALOR Y FORMA DE PAGO</h4>
          <div className="space-y-3 text-justify leading-relaxed">
            <p>
              EL ESTUDIANTE ha efectuado un <span className="font-bold">ABONO</span> por la suma de <Value>B/. {(details?.downPayment || 0).toFixed(2)}</Value>, 
              quedando un <span className="font-bold">SALDO PENDIENTE</span> de <Value>B/. {(details?.balance || 0).toFixed(2)}</Value>, 
              el cual se compromete a cancelar en su totalidad el día <span className="font-bold underline">{formatDateStr(paymentDeadline)}</span>.
            </p>
            
            <p>
              El <span className="font-bold">VALOR TOTAL</span> del curso es de <Value>B/. {(details?.courseValue || 0).toFixed(2)}</Value>. Para la inscripción, EL ESTUDIANTE deberá abonar el 50% del valor total como reserva de su cupo y horario. El 50% restante deberá cancelarse antes de iniciar la primera clase práctica. En caso de incumplimiento en los pagos, EL ESTUDIANTE no podrá continuar el curso.
            </p>
          </div>
        </section>

        <section className="border border-gray-200 p-3 rounded-sm">
          <h4 className="font-bold uppercase mb-2 border-b border-gray-200 pb-1">CLÁUSULA SEGUNDA - DETALLES DEL CURSO</h4>
          <div className="grid grid-cols-2 gap-x-4 text-[8.5pt]">
            <div className="space-y-1.5">
                <p>1. Categoría de licencia a aplicar: 
                    A, B <Checkbox checked={details?.licenseCategory === 'A, B'} />
                    A, C <Checkbox checked={details?.licenseCategory === 'A, C'} /> 
                    A, C, D <Checkbox checked={details?.licenseCategory === 'A, C, D'} />
                </p>
                <p>2. Transmisión del vehículo: 
                    Automático <Checkbox checked={details?.vehicleTransmission === 'Automático' && !isMoto} /> 
                    Manual <Checkbox checked={details?.vehicleTransmission === 'Manual' || isMoto} />
                </p>
                {!isSoloPractica && (
                    <p>3. Horario para clases teóricas: <span className="font-semibold underline uppercase">{details?.theoreticalClassSchedule || 'PENDIENTE'}</span></p>
                )}
            </div>
            <div className="space-y-1">
                {!isSoloPractica && (
                    <div className="text-[8pt] text-gray-600 leading-tight">
                        <span className="font-bold uppercase block text-[7pt] mb-1">Sesiones Teóricas Programadas:</span>
                        {(details?.theoreticalClassDates || []).map((d, i) => formatDateStr(d)).join(' | ')}
                    </div>
                )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-200">
            <p className="font-bold mb-1.5 uppercase text-[8pt]">4. Horario para clases prácticas (Propuesta):</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[8.5pt]">
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

        <div className="space-y-2 text-[8.2pt] leading-normal text-justify">
            <p><span className="font-bold uppercase">CLÁUSULA TERCERA - INASISTENCIAS Y REPROGRAMACIONES:</span> EL ESTUDIANTE que no asista a una clase práctica en el horario establecido perderá automáticamente la sesión sin derecho a reposición ni reclamo. Si la falta es por salud, deberá presentar constancia médica válida. Si falta a más de una clase sin justificación, deberá pagar un recargo de <span className="font-black">$20.00</span> por cada clase perdida para poder reprogramarla.</p>
            
            <p><span className="font-bold uppercase">CLÁUSULA CUARTA - LUGAR DE INICIO Y TRASLADO:</span> Las clases prácticas iniciarán en la oficina de LA ESCUELA. Desde allí, EL ESTUDIANTE será trasladado al circuito de prácticas y posteriormente de regreso. Dicho traslado se encuentra incluido dentro del tiempo de las 2 horas de clase práctica.</p>
            
            <p><span className="font-bold uppercase">CLÁUSULA QUINTA - PUNTUALIDAD:</span> En caso de que EL ESTUDIANTE llegue tarde a su clase, solo recibirá el tiempo restante de las 2 horas programadas, sin derecho a reposición.</p>
            
            <p><span className="font-bold uppercase">CLÁUSULA SEXTA - NORMAS DE COMPORTAMIENTO E VESTIMENTA:</span> Se prohíbe presentarse con: Escotes pronunciados, minifaldas, camisetas sin mangas, pantalones cortos (shorts), leggins, chancletas o sandalias. El incumplimiento de esta norma implica la pérdida automática de la clase, sin derecho a reposición.</p>
            
            <p><span className="font-bold uppercase">CLÁUSULA SÉPTIMA - ACOMPAÑANTES Y ACCESO:</span> Durante las clases teóricas y prácticas no se permite la presencia de acompañantes, niños, mascotas o terceras personas ajenas al proceso de enseñanza.</p>
            
            <p><span className="font-bold uppercase">CLÁUSULA OCTAVA - CONDICIONES DE APTITUD:</span> EL ESTUDIANTE declara estar en pleno uso de sus facultades físicas, mentales y emocionales para conducir vehículos a motor.</p>
            
            <p><span className="font-bold uppercase">CLÁUSULA NOVENA - CANCELACIÓN DEL CONTRATO:</span> En caso de que EL ESTUDIANTE decida cancelar el curso o el contrato, no habrá devolución de dinero bajo ninguna circunstancia.</p>
            
            <p><span className="font-bold uppercase">CLÁUSULA DÉCIMA - CERTIFICACIÓN:</span> El certificado de aprobación del curso será entregado únicamente si EL ESTUDIANTE está paz y salvo en sus pagos y ha completado la totalidad del curso teórico y práctico.</p>
            
            <p><span className="font-bold uppercase">CLÁUSULA UNDÉCIMA - VIGENCIA DEL CURSO:</span> Si EL ESTUDIANTE no establece contacto para finalizar su curso en un plazo de tres (3) meses desde la fecha de inicio, se entenderá que renuncia a continuar, sin derecho a devolución ni reclamos.</p>
        </div>

        <section className="mt-4 pt-4 border-t-2 border-black">
            <h3 className="font-bold uppercase text-center mb-2 text-[9pt]">CLÁUSULA DÉCIMA SEGUNDA - ACEPTACIÓN</h3>
            <p className="text-center italic text-[8.5pt] mb-8">
                En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, a los <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'd', { locale: es }) : '---'}</Value> días del mes de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'MMMM', { locale: es }) : '---'}</Value> de <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'yyyy', { locale: es }) : '---'}</Value>, a las <Value>{!isNaN(creationDate.getTime()) ? format(creationDate, 'HH:mm', { locale: es }) : '---'}</Value>.
            </p>
            
            <div className="flex justify-between px-16 pt-8">
                <div className="text-center w-[220px]">
                    <div className="border-t border-black mb-1"></div>
                    <p className="font-bold uppercase text-[7.5pt]">Por la Empresa</p>
                    <p className="text-[6.5pt] text-gray-500 italic">Freeway Escuela de Manejo S.A.</p>
                </div>
                <div className="text-center w-[220px]">
                    <div className="border-t border-black mb-1"></div>
                    <p className="font-bold uppercase text-[7.5pt]">El Cliente</p>
                    <p className="text-[7.5pt] font-bold">ID: {details?.studentIdNumber}</p>
                </div>
            </div>
        </section>
      </div>

      <div className="mt-10 text-center text-[6.5pt] text-gray-400 uppercase tracking-tighter">
        Documento interno de control administrativo • Confeccionado por: {contract.createdBy || 'Sistema'} • {format(new Date(), 'PPpp', { locale: es })}
      </div>
    </div>
  );
}
