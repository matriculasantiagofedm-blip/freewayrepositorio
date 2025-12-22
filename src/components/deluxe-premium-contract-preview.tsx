'use client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from './ui/card';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { DeluxeContractDetails } from '@/lib/types';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span className={cn("border-b border-dotted border-black flex-1 min-w-8 text-center font-semibold text-primary", className)}>
    {children || <>&nbsp;</>}
  </span>
);
const LongLine = () => <span className="border-b border-dotted border-black flex-1 h-4 min-w-40" />;
const Value = ({ children }: { children: React.ReactNode }) => <span className="px-1 font-semibold text-primary">{children}</span>;

function toDate(date: any): Date {
  if (date instanceof Date) return date;
  if (date && date.toDate) return date.toDate();
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      // Adjust for timezone offset if the string is just a date (YYYY-MM-DD)
      const timezoneOffset = parsed.getTimezoneOffset() * 60000;
      return new Date(parsed.getTime() + timezoneOffset);
    }
  }
  return new Date();
}

interface DeluxePremiumContractPreviewProps {
    folio: string;
    clientName?: string;
    clientEmail?: string;
    deluxeDetails?: DeluxeContractDetails;
}

export function DeluxePremiumContractTemplatePreview({ folio, clientName, clientEmail, deluxeDetails }: DeluxePremiumContractPreviewProps) {
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  if (!currentDate) {
    return (
        <Card className="p-6 print:shadow-none print:border-none print:p-0 font-serif text-xs">
            <CardContent>
                <p>Generando vista previa del contrato...</p>
            </CardContent>
        </Card>
    );
  }
  
  const Checkbox = ({ checked }: { checked: boolean }) => (
    <span className={`border border-black inline-block w-3 h-3 text-center leading-none align-middle ${checked ? 'bg-black text-white' : ''}`}>
        {checked ? 'X' : ''}
    </span>
);

  const formatDate = (dateString?: string) => {
    if (!dateString) return <Line />;
    try {
        const date = toDate(dateString);
        return <Value>{format(date, 'P', { locale: es })}</Value>;
    } catch {
        return <Line />;
    }
  };

  const paymentAmount = deluxeDetails?.paymentAmount || 33.50;
  
  const theoreticalScheduleText = deluxeDetails?.theoreticalClassSchedule === 'Lunes'
    ? 'Clases teóricas: Lunes, de 8:00 a.m. a 10:00 a.m.'
    : 'Clases teóricas: Miércoles, de 7:00 p.m. a 9:00 p.m.';

  return (
    <Card className="p-6 print:shadow-none print:border-none print:p-0 font-serif text-xs">
      <CardContent className="p-0 space-y-1 relative">
        <p className="absolute top-0 right-0 text-xs font-semibold text-destructive">Folio: {folio}</p>

        <h2 className="text-center font-bold text-sm mb-2 pt-4">CONTRATO DE SERVICIOS EDUCATIVOS</h2>

        <p>
          La empresa FREEWAY ESCUELA DE MANEJO S.A., con ubicación en La Chorrera, Vía Interamericana, Costa Verde, PH Green Plaza, Local #20, debidamente inscrita RUC 155628022-2-2016 DV 2, en adelante denominada LA EMPRESA, y LA ESCUELA se compromete a brindar a EL ESTUDIANTE la capacitación teórico-práctica del curso “PAQUETE DELUXE: PLAN PREMIUM”, con una duración total de 12 semanas, que incluye: 20 horas teóricas (clases presenciales nocturnas), 12 horas prácticas (entrenamiento en circuito cerrado), y Certificación según categoría: A, C o A, C, D.
        </p>

        <div className="space-y-0.5">
            <p>Entre <Value>{clientName || '________________'}</Value>, con cédula <Value>{deluxeDetails?.studentIdNumber || '________________'}</Value>,</p>
            <div className="flex items-center flex-wrap">
                con domicilio en 
                <Line><Value>{deluxeDetails?.studentAddress}</Value></Line>
                , teléfonos:
                <Line><Value>{deluxeDetails?.studentPhone1}</Value></Line>/<Line><Value>{deluxeDetails?.studentPhone2}</Value></Line>
            </div>
             <div className="flex items-center flex-wrap">
                , correo electrónico:
                <Line><Value>{clientEmail}</Value></Line>
                , en adelante denominado EL ESTUDIANTE.
            </div>
        </div>

        <h3 className="font-bold">CLÁUSULA PRIMERA - OBJETO DEL CONTRATO</h3>
        <p>Ambas partes convienen celebrar este contrato en el cual la empresa se compromete a brindar al cliente, un servicio de capacitación y adiestramiento teórico y práctico relacionado con el aprendizaje de conducción de vehículos a motor. El mismo se regirá bajo los términos y condiciones que se detallan en las siguientes cláusulas.</p>
        
        <h3 className="font-bold">CLÁUSULA SEGUNDA - VALOR, MATRÍCULA Y FORMA DE PAGO</h3>
        <p><Value>{deluxeDetails?.paymentDetails}</Value></p>
        <p>El pago se realizará de la siguiente manera: 6 cuotas de B/.<Value>{paymentAmount.toFixed(2)}</Value> cada una, con fechas de pago establecidas cada dos semanas a partir del inicio del curso.</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0 text-[10px]">
          <span>CUOTA 1: {formatDate(deluxeDetails?.paymentInstallments?.[0])}</span>
          <span>CUOTA 4: {formatDate(deluxeDetails?.paymentInstallments?.[3])}</span>
          <span>CUOTA 2: {formatDate(deluxeDetails?.paymentInstallments?.[1])}</span>
          <span>CUOTA 5: {formatDate(deluxeDetails?.paymentInstallments?.[4])}</span>
          <span>CUOTA 3: {formatDate(deluxeDetails?.paymentInstallments?.[2])}</span>
          <span>CUOTA 6: {formatDate(deluxeDetails?.paymentInstallments?.[5])}</span>
        </div>

        <h3 className="font-bold">CLÁUSULA TERCERA - DETALLES DEL CURSO</h3>
        <div className="space-y-0.5 pl-4">
            <p>1. Transmisión del vehículo: Automático <Checkbox checked={deluxeDetails?.vehicleTransmission === 'Automático'} /> / Manual <Checkbox checked={deluxeDetails?.vehicleTransmission === 'Manual'} /></p>
            <p>2. Categoría de licencia a aplicar: A, C <Checkbox checked={deluxeDetails?.licenseCategory === 'A, C'} /> / A, C, D <Checkbox checked={deluxeDetails?.licenseCategory === 'A, C, D'} /></p>
        </div>

        <h3 className="font-bold">CLÁUSULA CUARTA - HORARIO DE CAPACITACIÓN</h3>
        <p><Value>{theoreticalScheduleText}</Value></p>
        <div className="grid grid-cols-3 gap-x-4 gap-y-0 text-[10px]">
            {Array.from({ length: 10 }).map((_, index) => (
                <span key={index}>Semana {index + 1}: {formatDate(deluxeDetails?.theoreticalClasses?.[index])}</span>
            ))}
        </div>
        <p>Clases prácticas: Se programarán a partir de la semana 8 de la capacitación teórica, en horario diurno o vespertino, de acuerdo con la disponibilidad de LA ESCUELA.</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 pl-4 text-[10px]">
            {deluxeDetails?.classSchedules?.map((clase, index) => (
                <div key={index} className="flex items-center gap-1">
                Clase {index + 1}: <Line><Value>{clase.date ? format(toDate(clase.date), 'P', { locale: es }) : ''}</Value></Line> 
                Hora <Line><Value>{clase.time}</Value></Line>
                </div>
            ))}
            {(!deluxeDetails?.classSchedules || deluxeDetails.classSchedules.length < 6) && 
                Array.from({ length: 6 - (deluxeDetails?.classSchedules?.length || 0) }).map((_, index) => (
                <div key={index} className="flex items-center gap-1">
                    Clase {index + (deluxeDetails?.classSchedules?.length || 0) + 1}: <Line /> Hora <Line />
                </div>
                ))
            }
        </div>
        
        <h3 className="font-bold">CLÁUSULA QUINTA - POLÍTICA DE PAGOS Y MOROSIDAD</h3>
        <p>EL ESTUDIANTE deberá mantener sus pagos al día para poder asistir a sus clases. Si el estudiante no cancela su cuota correspondiente en la semana establecida, no podrá ingresar a sus clases teóricas ni prácticas hasta regularizar su situación. En caso de atraso, EL ESTUDIANTE tiene dos opciones: Opción 1: Cancelar las dos cuotas pendientes (la atrasada y la vigente) para reincorporarse a sus clases. Opción 2: Cancelar una sola cuota, quedando pendiente de ser notificado sobre la próxima clase disponible, la cual deberá ser pagada antes de su inicio.</p>

        <h3 className="font-bold">CLÁUSULA SEXTA- INASISTENCIAS Y REPROGRAMACIONES</h3>
        <p>EL ESTUDIANTE que no asista a una clase práctica en el horario establecido perderá automáticamente la clase práctica sin derecho a reposición ni reclamo. Excepción: Si la falta es por motivo de salud, deberá presentar constancia médica válida y coordinar con la administración para una reprogramación, la cual dependerá de la disponibilidad de horarios. Si EL ESTUDIANTE falta a más de una clase práctica sin justificar médicamente, no tendrá derecho a certificado y deberá pagar un recargo de $20.00 por cada clase perdida para poder reprogramarla.</p>

        <h3 className="font-bold">CLÁUSULA SEPTIMA - PUNTUALIDAD</h3>
        <p>En caso de que EL ESTUDIANTE llegue tarde a su clase, solo recibirá el tiempo restante de las 2 horas programadas, sin derecho a reposición.</p>

        <h3 className="font-bold">CLÁUSULA OCTAVA- LUGAR DE INICIO Y TRASLADO</h3>
        <p>Las clases prácticas iniciarán en la oficina de LA ESCUELA. Desde allí, EL ESTUDIANTE será trasladado al circuito de prácticas y posteriormente de regreso. Dicho traslado se encuentra incluido dentro del tiempo de las 2 horas de clase práctica.</p>

        <h3 className="font-bold">CLÁUSULA NOVENA - NORMAS DE COMPORTAMIENTO Y VESTIMENTA</h3>
        <p>EL ESTUDIANTE se compromete a: Seguir las instrucciones del instructor, mantener una actitud respetuosa y adecuada durante las clases y asistir en estado óptimo de salud física, mental y emocional. Para las clases prácticas y teóricas, EL ESTUDIANTE deberá asistir con ropa adecuada. Se prohíbe presentarse con: Escotes pronunciados, minifaldas, camisetas sin mangas, pantalones cortos, leggins, chancletas o sandalias. El incumplimiento de esta norma implica la pérdida automática de la clase, sin derecho a reposición.</p>

        <h3 className="font-bold">CLÁUSULA DÉCIMA- ACOMPAñANTES Y ACCESO</h3>
        <p>Durante las clases teóricas y prácticas no se permite la presencia de acompañantes, niños, mascotas o terceras personas ajenas al proceso de enseñanza.</p>
        
        <h3 className="font-bold">CLÁUSULA DÉCIMA PRIMERA- CONDICIONES DE APTITUD</h3>
        <p>EL ESTUDIANTE declara estar en pleno uso de sus facultades físicas, mentales y emocionales, siendo responsable de informar a LA ESCUELA sobre cualquier condición médica que limite su desempeño.</p>

        <h3 className="font-bold">CLÁUSULA DÉCIMA SEGUNDA - CANCELACIÓN DEL CONTRATO</h3>
        <p>En caso de que EL ESTUDIANTE decida cancelar el curso o el contrato, no habrá devolución de dinero bajo ninguna circunstancia.</p>

        <h3 className="font-bold">CLÁUSULA DÉCIMA TERCERA - CERTIFICACIÓN</h3>
        <p>El certificado de aprobación del curso será entregado únicamente si EL ESTUDIANTE: Está paz y salvo en sus pagos y ha completado la totalidad del curso teórico y práctico.</p>

        <h3 className="font-bold">CLÁUSULA DÉCIMA CUARTA- VIGENCIA DEL CURSO</h3>
        <p>Si EL ESTUDIANTE no establece contacto para finalizar su curso en un plazo de tres (3) meses desde la fecha de inicio, se entenderá que renuncia a continuar, sin derecho a devolución del dinero ni a reclamos posteriores.</p>

        <h3 className="font-bold">CLÁUSULA DÉCIMA QUINTA- ACEPTACIÓN</h3>
        <p>Ambas partes declaran haber leído, entendido y aceptado el presente contrato, firmándolo en señal de conformidad.</p>
        <p className="text-center !mt-4">
            En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, República de panamá, a los {format(currentDate, 'd')} días del mes de {format(currentDate, 'LLLL', { locale: es })}, de {format(currentDate, 'yyyy')}, a las {format(currentDate, 'p', { locale: es })}.
        </p>

        <div className="flex justify-around pt-6">
            <div className="text-center flex flex-col items-center">
                <LongLine />
                <p className="text-[10px]">Por la Empresa</p>
            </div>
            <div className="text-center flex flex-col items-center">
                <LongLine />
                <p className="text-[10px]">El Cliente</p>
                <p className="text-[10px]">N° de identificación: <Value>{deluxeDetails?.studentIdNumber}</Value></p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
