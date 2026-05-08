'use client';
import type { Contract } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo } from 'react';
import { toDate } from '@/lib/utils';

/**
 * Template de impresión del Contrato Deluxe.
 * Mismo estilo visual que AutoMotoContractTemplate.
 * 2 páginas carta, SIN clases prácticas en el impreso.
 */

const Value = ({ children }: { children: React.ReactNode }) => (
  <span className="font-bold text-black">{children}</span>
);

const Underline = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <span
    className={`border-b border-black inline-block px-0.5 min-w-[60px] font-semibold text-center ${className ?? ''}`}
    style={{ borderBottomStyle: 'solid' }}
  >
    {children || <>&nbsp;</>}
  </span>
);

const Checkbox = ({ checked }: { checked: boolean }) => (
  <span className="inline-flex items-center justify-center border border-black w-3.5 h-3.5 mx-0.5 align-middle">
    {checked ? <span className="text-[10px] font-black leading-none">X</span> : null}
  </span>
);

function fmtShort(d: any): string {
  if (!d) return '';
  const date = toDate(d);
  if (isNaN(date.getTime())) return '';
  try { return format(date, "d 'de' MMMM", { locale: es }); } catch { return ''; }
}

export function DeluxePremiumContractTemplatePreview({ contract }: { contract: Contract }) {
  const d = contract.deluxeDetails as any;
  const courseValue: number   = d?.courseValue   ?? 0;
  const enrollmentFee: number = d?.enrollmentFee ?? 15;
  const cuotaAmt: number      = courseValue > 0 ? courseValue / 6 : 0;
  const theoryDates: any[]    = d?.theoreticalClasses ?? [];
  const folio = contract.folioNumber ? String(contract.folioNumber).padStart(4, '0') : '____';

  // Cuotas bisemanales desde la primera clase teórica
  const cuotaDates = useMemo(() => {
    if (!theoryDates.length) return [] as Date[];
    const first = toDate(theoryDates[0]);
    if (isNaN(first.getTime())) return [] as Date[];
    return Array.from({ length: 6 }, (_, i) => {
      const dt = new Date(first);
      dt.setDate(dt.getDate() + i * 14);
      return dt;
    });
  }, [theoryDates]);

  const scheduleDay = (() => {
    const s = d?.theoreticalClassSchedule ?? '';
    if (/mi[eé]rcoles/i.test(s)) return 'Miércoles, de 6:00 p.m. a 8:00 p.m.';
    if (/lunes/i.test(s))        return 'Lunes, de 8:00 a.m. a 10:00 a.m.';
    return 'Jueves, de 7:00 p.m. a 9:00 p.m.';
  })();

  return (
    <div className="max-w-[8.5in] mx-auto bg-white font-serif text-[8.5pt] leading-[1.15] text-black print:p-0 print:m-0">

      {/* ── PRINT STYLES ── */}
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in 0.6in; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .print-ui-element { display: none !important; }
          .page-2 { page-break-before: always; }
        }
      `}</style>

      {/* ═══════════════ PÁGINA 1 ═══════════════ */}
      <div className="px-10 pt-8 pb-4">

        {/* ── Encabezado ── */}
        <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="border-2 border-black p-1 text-center">
              <div className="font-black text-xl leading-none">FW</div>
            </div>
            <div>
              <div className="font-black text-base tracking-widest">FREEWAY</div>
              <div className="text-[6.5pt] tracking-[2px] uppercase font-bold">Escuela de Manejo</div>
            </div>
          </div>
          <div className="flex-1 text-center px-4">
            <div className="border border-black inline-block px-4 py-1 font-bold text-[9pt] uppercase">
              Contrato por Servicio de Curso de Manejo
            </div>
          </div>
          <div className="text-right">
            <p className="text-[6.5pt] uppercase font-bold text-gray-500">Folio N.°</p>
            <p className="font-black text-xl text-red-600">{folio}</p>
          </div>
        </div>

        {/* ── Intro empresa ── */}
        <p className="text-justify mb-2">
          La empresa <Value>FREEWAY ESCUELA DE MANEJO S.A.</Value>, con ubicación en La Chorrera, Vía Interamericana, Costa Verde,
          PH Green Plaza, Local #20, debidamente inscrita RUC 155628022-2-2016 DV 2, en adelante denominada <Value>LA EMPRESA</Value>, y
        </p>

        {/* ── Datos del estudiante ── */}
        <p className="mb-1">
          <Underline className="min-w-[240px]">{contract.clientName}</Underline>
          {', identificado con '}
          <Underline className="min-w-[60px]">{d?.idType || 'cédula'}</Underline>
          {' N.° '}
          <Underline className="min-w-[100px]">{d?.studentIdNumber}</Underline>
        </p>
        <p className="mb-1">
          {'con domicilio en '}
          <Underline className="min-w-[200px]">{d?.studentAddress}</Underline>
          {', teléfonos: '}
          <Underline className="min-w-[80px]">{d?.studentPhone1}</Underline>
          {' / '}
          <Underline className="min-w-[80px]">{d?.studentPhone2}</Underline>
        </p>
        <p className="mb-3">
          {', correo electrónico: '}
          <Underline className="min-w-[160px]">{contract.clientEmail}</Underline>
          {', denominado '}
          <Value>EL ESTUDIANTE</Value>.
        </p>

        {/* ── Declaran ── */}
        <h3 className="font-bold uppercase mb-1">DECLARAN:</h3>
        <p className="text-justify mb-2">
          Ambas partes convienen celebrar este contrato en el cual la empresa se compromete a brindar al cliente, un servicio de
          capacitación y adiestramiento teórico y práctico relacionado con el aprendizaje de conducción de vehículos a motor. El
          mismo se regirá bajo los términos y condiciones que se detallan en las siguientes cláusulas:
        </p>

        {/* ── Cláusula Primera ── */}
        <h4 className="font-bold uppercase mb-1">CLÁUSULA PRIMERA - OBJETO DEL CONTRATO</h4>
        <p className="text-justify mb-1">
          LA ESCUELA SE compromete a brindar A EL ESTUDIANTE la capacitación teórico-práctica del curso <Value>"PAQUETE DELUXE: SPECIAL EDITION"</Value>,
          con una duración total de <Value>12 semanas</Value>, que incluye:
        </p>
        <ul className="list-disc list-inside mb-2 pl-2 leading-relaxed">
          <li><Value>20 horas teóricas</Value> (clases presenciales nocturnas).</li>
          <li><Value>16 horas prácticas</Value> (entrenamiento en circuito cerrado).</li>
          <li>Certificación según categoría: A, C o A, C, D.</li>
        </ul>

        {/* ── Cláusula Segunda ── */}
        <h4 className="font-bold uppercase mb-1">CLÁUSULA SEGUNDA - VALOR, MATRÍCULA Y FORMA DE PAGO</h4>
        <p className="text-justify mb-1">
          El valor total del curso es de <Value>B/. {courseValue.toFixed(2)}</Value>, más una matrícula de <Value>B/. {enrollmentFee.toFixed(2)}</Value>.
        </p>
        <p className="mb-1">El pago se realizará de la siguiente manera:</p>
        <ul className="list-disc list-inside mb-2 pl-2">
          <li>
            <Value>6 cuotas de B/. {cuotaAmt.toFixed(2)} cada una</Value>, con fechas de pago establecidas cada dos semanas
            a partir del inicio del curso.
          </li>
        </ul>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mb-3 pl-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-baseline gap-1">
              <span className="font-bold whitespace-nowrap">CUOTA {i + 1}:</span>
              <Underline className="flex-1 min-w-[130px]">
                {cuotaDates[i] ? fmtShort(cuotaDates[i]) : ''}
              </Underline>
            </div>
          ))}
          {[3, 4, 5].map(i => (
            <div key={i} className="flex items-baseline gap-1">
              <span className="font-bold whitespace-nowrap">CUOTA {i + 1}:</span>
              <Underline className="flex-1 min-w-[130px]">
                {cuotaDates[i] ? fmtShort(cuotaDates[i]) : ''}
              </Underline>
            </div>
          ))}
        </div>

        {/* ── Cláusula Tercera ── */}
        <h4 className="font-bold uppercase mb-1">CLÁUSULA TERCERA - DETALLES DEL CURSO</h4>
        <p className="mb-1">
          1. Transmisión del vehículo: Automático <Checkbox checked={d?.vehicleTransmission === 'Automático'} /> / Manual <Checkbox checked={d?.vehicleTransmission === 'Manual'} />
          &nbsp;&nbsp;&nbsp;
          2. Categoría de licencia a aplicar: A, C <Checkbox checked={d?.licenseCategory === 'A, C'} /> / A, C, D <Checkbox checked={d?.licenseCategory === 'A, C, D'} />
        </p>

        {/* ── Cláusula Cuarta ── */}
        <h4 className="font-bold uppercase mt-2 mb-1">CLÁUSULA CUARTA - HORARIO DE CAPACITACIÓN</h4>
        <p className="mb-1">
          <Checkbox checked={true} /> <strong>Clases teóricas:</strong> {scheduleDay}
        </p>
        <div className="grid grid-cols-3 gap-x-4 gap-y-0 mb-2 pl-4 text-[8pt]">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i}>
              Semana {i + 1}: <Underline className="min-w-[70px]">{theoryDates[i] ? fmtShort(theoryDates[i]) : ''}</Underline>
            </span>
          ))}
        </div>
        <p className="mb-3 text-justify">
          <Checkbox checked={false} /> <strong>Clases prácticas:</strong> Se programarán a partir de la semana 8 de la capacitación teórica,
          en horario diurno o vespertino, de acuerdo con la disponibilidad de LA ESCUELA.
        </p>

        {/* ── Cláusula Quinta ── */}
        <p className="text-justify mb-1.5 leading-snug">
          <span className="font-bold uppercase">CLÁUSULA QUINTA - POLÍTICA DE PAGOS Y MOROSIDAD:</span>{' '}
          EL ESTUDIANTE deberá mantener sus pagos al día para poder asistir a sus clases. Si el estudiante no cancela su cuota
          correspondiente en la semana establecida, no podrá ingresar a sus clases teóricas ni prácticas hasta regularizar su situación.
          En caso de atraso: <strong>Opción 1:</strong> Cancelar las dos cuotas pendientes para reincorporarse.
          <strong> Opción 2:</strong> Cancelar una cuota, quedando pendiente de notificación.
        </p>

        {/* ── Cláusula Sexta ── */}
        <p className="text-justify mb-1.5 leading-snug">
          <span className="font-bold uppercase">CLÁUSULA SEXTA - INASISTENCIAS Y REPROGRAMACIONES:</span>{' '}
          EL ESTUDIANTE que no asista a una clase práctica en el horario establecido perderá automáticamente la clase sin
          derecho a reposición ni reclamo. Excepción por salud con constancia médica válida. Más de una ausencia injustificada:
          sin derecho a certificado y recargo de <strong>$20.00</strong> por cada clase perdida para reprogramar.
        </p>

        {/* ── Cláusula Séptima ── */}
        <p className="text-justify mb-1.5 leading-snug">
          <span className="font-bold uppercase">CLÁUSULA SÉPTIMA - PUNTUALIDAD:</span>{' '}
          En caso de que EL ESTUDIANTE llegue tarde a su clase, solo recibirá el tiempo restante de las 2 horas programadas, sin derecho a reposición.
        </p>

        {/* ── Cláusula Octava ── */}
        <p className="text-justify mb-1.5 leading-snug">
          <span className="font-bold uppercase">CLÁUSULA OCTAVA - LUGAR DE INICIO Y TRASLADO:</span>{' '}
          Las clases prácticas iniciarán en la oficina de LA ESCUELA. EL ESTUDIANTE será trasladado al circuito de prácticas y
          de regreso. El traslado está incluido dentro del tiempo de las 2 horas de clase práctica.
        </p>

      </div>{/* fin página 1 */}

      {/* ═══════════════ PÁGINA 2 ═══════════════ */}
      <div className="page-2 px-10 pt-8 pb-4">

        {/* Mini-encabezado página 2 */}
        <div className="flex justify-between items-center border-b border-black pb-1 mb-3 text-[8pt]">
          <span className="font-black tracking-wider">FREEWAY ESCUELA DE MANEJO S.A.</span>
          <span>Contrato N.° <strong>{folio}</strong> — {contract.clientName}</span>
        </div>

        {/* ── Cláusula Novena ── */}
        <p className="text-justify mb-1.5 leading-snug">
          <span className="font-bold uppercase">CLÁUSULA NOVENA - NORMAS DE COMPORTAMIENTO Y VESTIMENTA:</span>{' '}
          EL ESTUDIANTE se compromete a seguir las instrucciones del instructor, mantener una actitud respetuosa y asistir en
          estado óptimo de salud. Ropa adecuada obligatoria. Prohibido: escotes pronunciados, minifaldas, camisetas sin mangas,
          pantalones cortos, leggins, chancletas. El incumplimiento implica pérdida automática de la clase sin reposición.
        </p>

        {/* ── Cláusula Décima ── */}
        <p className="text-justify mb-1.5 leading-snug">
          <span className="font-bold uppercase">CLÁUSULA DÉCIMA - ACOMPAÑANTES Y ACCESO:</span>{' '}
          Durante las clases teóricas y prácticas no se permite la presencia de acompañantes, niños, mascotas o terceras personas ajenas al proceso de enseñanza.
        </p>

        {/* ── Cláusula Décima Primera ── */}
        <p className="text-justify mb-1.5 leading-snug">
          <span className="font-bold uppercase">CLÁUSULA DÉCIMA PRIMERA - CONDICIONES DE APTITUD:</span>{' '}
          EL ESTUDIANTE declara estar en pleno uso de sus facultades físicas, mentales y emocionales, siendo responsable de informar
          a LA ESCUELA sobre cualquier condición médica que limite su desempeño.
        </p>

        {/* ── Cláusula Décima Segunda ── */}
        <p className="text-justify mb-1.5 leading-snug">
          <span className="font-bold uppercase">CLÁUSULA DÉCIMA SEGUNDA - CANCELACIÓN DEL CONTRATO:</span>{' '}
          En caso de que EL ESTUDIANTE decida cancelar el curso o el contrato, no habrá devolución de dinero bajo ninguna circunstancia.
        </p>

        {/* ── Cláusula Décima Tercera ── */}
        <p className="text-justify mb-1.5 leading-snug">
          <span className="font-bold uppercase">CLÁUSULA DÉCIMA TERCERA - CERTIFICACIÓN:</span>{' '}
          El certificado de aprobación del curso será entregado únicamente si EL ESTUDIANTE: Está paz y salvo en sus pagos y ha
          completado la totalidad del curso teórico y práctico.
        </p>

        {/* ── Cláusula Décima Cuarta ── */}
        <p className="text-justify mb-1.5 leading-snug">
          <span className="font-bold uppercase">CLÁUSULA DÉCIMA CUARTA - VIGENCIA DEL CURSO:</span>{' '}
          Si EL ESTUDIANTE no establece contacto para finalizar su curso en un plazo de tres (3) meses desde la fecha de inicio, se
          entenderá que renuncia a continuar, sin derecho a devolución del dinero ni a reclamos posteriores.
        </p>

        {/* ── Cláusula Décima Quinta - Aceptación ── */}
        <section className="mt-4 pt-3 border-t-2 border-black">
          <h3 className="font-bold uppercase text-center mb-1">CLÁUSULA DÉCIMA QUINTA - ACEPTACIÓN</h3>
          <p className="text-center italic mb-8">
            En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, República de Panamá.
          </p>
          <div className="flex justify-around px-8 pt-4">
            <div className="text-center w-[200px]">
              <div className="border-t border-black mb-1"></div>
              <p className="font-bold uppercase text-[7pt]">Por la Empresa</p>
              <p className="text-[7pt]">FREEWAY ESCUELA DE MANEJO S.A.</p>
            </div>
            <div className="text-center w-[200px]">
              <div className="border-t border-black mb-1"></div>
              <p className="font-bold uppercase text-[7pt]">Firma del Estudiante</p>
              <p className="text-[7pt]">{d?.idType || 'C.I.P.'} N.° {d?.studentIdNumber || '__________'}</p>
            </div>
          </div>
        </section>

        {/* Nota interna */}
        {contract.createdBy && (
          <div className="print:hidden mt-6 text-center text-[6pt] text-gray-400 uppercase tracking-tighter border-t pt-2">
            Confeccionado por: {contract.createdBy} · Folio {folio}
          </div>
        )}

      </div>{/* fin página 2 */}

    </div>
  );
}
