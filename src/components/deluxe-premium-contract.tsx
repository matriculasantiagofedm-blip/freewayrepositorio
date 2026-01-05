
'use client';
import type { Contract, Client } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';
import { useDb } from './firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span className={cn("border-b border-dotted border-black flex-1 min-w-8 text-center font-semibold text-primary print:text-black", className)}>
    {children || <>&nbsp;</>}
  </span>
);
const LongLine = () => <span className="border-b border-dotted border-black flex-1 h-4 min-w-40" />;
const Value = ({ children }: { children: React.ReactNode }) => <span className="px-1 font-semibold text-primary print:text-blue-600">{children}</span>;

function toDate(date: any): Date {
  if (date instanceof Date) return date;
  if (date && date.toDate) return date.toDate();
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      const timezoneOffset = parsed.getTimezoneOffset() * 60000;
      return new Date(parsed.getTime() + timezoneOffset);
    }
  }
  return new Date(0); // Return invalid date
}


const Checkbox = ({ checked }: { checked: boolean }) => (
    <span className={`border border-black inline-block w-3 h-3 text-center leading-none align-middle ${checked ? 'bg-black text-white print:text-black print:bg-white print:font-bold' : ''}`}>
        {checked ? 'X' : ''}
    </span>
);

export function DeluxePremiumContractTemplate({ contract }: { contract: Contract }) {
  const db = useDb();
  const clientRef = useMemoDoc(() => {
    if (!db || !contract.clientId) return null;
    return doc(db, 'clients', contract.clientId);
  }, [db, contract.clientId]);

  const { data: client } = useDoc<Client>(clientRef);
  const deluxeDetails = contract.deluxeDetails;

  const formatDate = (date: Date) => {
    if (!date || isNaN(date.getTime()) || date.getFullYear() <= 1970) return <Line />;
    try {
        return <Value>{format(date, 'P', { locale: es })}</Value>;
    } catch {
        return <Line />;
    }
  };

  const paymentAmount = deluxeDetails?.paymentAmount || 33.50;

  const theoreticalScheduleText = deluxeDetails?.theoreticalClassSchedule === 'Lunes'
    ? 'Clases teóricas: Lunes, de 8:00 a.m. a 10:00 a.m.'
    : 'Clases teóricas: Miércoles, de 7:00 p.m. a 9:00 p.m.';
    
  const paymentDetailsText = deluxeDetails?.paymentDetails === 'Premium B/ 201.00'
    ? 'El estudiante pagará B/. 201.00 en 6 cuotas quincenales de B/.33.50.'
    : deluxeDetails?.paymentDetails === 'Deluxe B/ 270.00'
    ? 'El estudiante pagará B/. 270.00 en 6 cuotas quincenales de B/.45.00.'
    : deluxeDetails?.paymentDetails || '';

  return (
    <Card className="p-6 print:shadow-none print:border-none print:p-0 font-serif text-xs">
      <CardContent className="p-0 space-y-1 relative">
        <div className="flex justify-between items-start pb-2">
            <h2 className="text-center font-bold text-sm">CONTRATO DE SERVICIOS EDUCATIVOS</h2>
            {contract.folioNumber && (
                <div className="text-right">
                    <p className="font-bold text-sm text-destructive print:text-red-500">CONTRATO N° {String(contract.folioNumber).padStart(6, '0')}</p>
                </div>
            )}
        </div>


        <p>
          La empresa FREEWAY ESCUELA DE MANEJO S.A., con ubicación en La Chorrera, Vía Interamericana, Costa Verde, PH Green Plaza, Local #20, debidamente inscrita RUC 155628022-2-2016 DV 2, en adelante denominada LA EMPRESA.
        </p>

        <div className="space-y-0.5">
            <p>Entre <Value>{contract.clientName}</Value>, con cédula <Value>{deluxeDetails?.studentIdNumber}</Value>,</p>
            <div className="flex items-center flex-wrap">
                , con domicilio en 
                <Line><Value>{deluxeDetails?.studentAddress}</Value></Line>
                , teléfonos:
                <Line><Value>{deluxeDetails?.studentPhone1}</Value></Line>/<Line><Value>{deluxeDetails?.studentPhone2}</Value></Line>
            </div>
             <div className="flex items-center flex-wrap">
                , correo electrónico:
                <Value>{client?.email}</Value>
                , en adelante denominado EL ESTUDIANTE.
            </div>
        </div>
        
        <div className="bg-slate-50 p-4 rounded-md print:bg-transparent print:p-0 space-y-1">
            <h3 className="font-bold">CLÁUSULA PRIMERA - OBJETO DEL CONTRATO</h3>
            <p>LA EMPRESA se compromete a brindar a EL ESTUDIANTE la capacitación teórico-práctica del curso “PAQUETE DELUXE: PLAN PREMIUM”, con una duración total de 12 semanas, que incluye: 20 horas teóricas (clases presenciales nocturnas), 12 horas prácticas (entrenamiento en circuito cerrado), y Certificación según categoría: A, C o A, C, D.</p>

            <h3 className="font-bold">CLÁUSULA SEGUNDA - VALOR, MATRÍCULA Y FORMA DE PAGO</h3>
            <p><Value>{paymentDetailsText}</Value></p>
            <p>El pago se realizará de la siguiente manera: 6 cuotas de B/.<Value>{paymentAmount.toFixed(2)}</Value> cada una, con fechas de pago establecidas cada dos semanas a partir del inicio del curso.</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0 text-[10px]">
              <span>CUOTA 1: {formatDate(toDate(deluxeDetails?.paymentInstallments?.[0]))}</span>
              <span>CUOTA 4: {formatDate(toDate(deluxeDetails?.paymentInstallments?.[3]))}</span>
              <span>CUOTA 2: {formatDate(toDate(deluxeDetails?.paymentInstallments?.[1]))}</span>
              <span>CUOTA 5: {formatDate(toDate(deluxeDetails?.paymentInstallments?.[4]))}</span>
              <span>CUOTA 3: {formatDate(toDate(deluxeDetails?.paymentInstallments?.[2]))}</span>
              <span>CUOTA 6: {formatDate(toDate(deluxeDetails?.paymentInstallments?.[5]))}</span>
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
                    <span key={index}>Semana {index + 1}: {formatDate(toDate(deluxeDetails?.theoreticalClasses?.[index]))}</span>
                ))}
            </div>
            <p>Clases prácticas: Se programarán a partir de la semana 8 de la capacitación teórica, en horario diurno o vespertino, de acuerdo con la disponibilidad de LA ESCUELA.</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 pl-4 text-[10px]">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-1">
                    Clase {index + 1}: <Line className="min-w-20"></Line> 
                    Hora <Line className="min-w-12"></Line>
                </div>
              ))}
            </div>
            
            <h3 className="font-bold">CLÁUSULA QUINTA - POLÍTICA DE PAGOS Y MOROSIDAD</h3>
            <p>EL ESTUDIANTE deberá mantener sus pagos al día para poder asistir a sus clases. Si el estudiante no cancela su cuota correspondiente en la semana establecida, no podrá ingresar a sus clases teóricas ni prácticas hasta regularizar su situación. En caso de atraso, EL ESTUDIANTE tiene dos opciones: Opción 1: Cancelar las dos cuotas pendientes (la atrasada y la vigente) para reincorporarse a sus clases. Opción 2: Cancelar una sola cuota, quedando pendiente de ser notificado sobre la próxima clase disponible, la cual deberá ser pagada antes de su inicio.</p>

            <h3 className="font-bold">CLÁUSULA SEXTA- INASISTENCIAS E REPROGRAMACIONES</h3>
            <p>EL ESTUDIANTE que no asista a una clase práctica en el horario establecido perderá automáticamente la clase práctica sin derecho a reposición ni reclamo. Excepción: Si la falta es por motivo de salud, deberá presentar constancia médica válida y coordinar con la administración para una reprogramación, la cual dependerá de la disponibilidad de horarios. Si EL ESTUDIANTE falta a más de una clase práctica sin justificar médicamente, no tendrá derecho a certificado y deberá pagar un recargo de $20.00 por cada clase perdida para poder reprogramarla.</p>

            <h3 className="font-bold">CLÁUSULA SEPTIMA - PUNTUALIDAD</h3>
            <p>En caso de que EL ESTUDIANTE llegue tarde a su clase, solo recibirá el tiempo restante de las 2 horas programadas, sin derecho a reposición.</p>

            <h3 className="font-bold">CLÁUSULA OCTAVA- LUGAR DE INICIO E TRASLADO</h3>
            <p>Las clases prácticas iniciarán en la oficina de LA ESCUELA. Desde allí, EL ESTUDIANTE será trasladado al circuito de prácticas y posteriormente de regreso. Dicho traslado se encuentra incluido dentro del tiempo de las 2 horas de clase práctica.</p>

            <h3 className="font-bold">CLÁUSULA NOVENA - NORMAS DE COMPORTAMIENTO E VESTIMENTA</h3>
            <p>EL ESTUDIANTE se compromete a: Seguir las instructions del instructor, mantener una actitud respetuosa y adecuada durante las clases y asistir en estado óptimo de salud física, mental y emocional. Para las clases prácticas y teóricas, EL ESTUDIANTE deberá asistir con ropa adecuada. Se prohíbe presentarse con: Escotes pronunciados, minifaldas, camisetas sin mangas, pantalones cortos, leggins, chancletas o sandalias. El incumplimiento de esta norma implica la pérdida automática de la clase, sin derecho a reposición.</p>

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
            <p className="text-center !mt-4">
                En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, República de panamá, a los <Value>{format(toDate(contract.createdAt), 'd', { locale: es })}</Value> días del mes de <Value>{format(toDate(contract.createdAt), 'LLLL', { locale: es })}</Value>, de <Value>{format(toDate(contract.createdAt), 'yyyy', { locale: es })}</Value>, a las <Value>{format(toDate(contract.createdAt), 'p', { locale: es })}</Value>.
            </p>
        </div>


        <div className="flex justify-around pt-6 print:pt-12">
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
        
        {contract.createdBy && (
            <div className="hidden print:block text-center text-xs text-muted-foreground pt-12">
                <span>Confeccionado por: {contract.createdBy}</span>
            </div>
        )}

      </CardContent>
    </Card>
  );
}
