'use client';
import type { Contract, Client, DeluxeContractDetails } from '@/lib/types';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span className={cn("border-b-2 border-dotted border-black flex-1 min-w-10 text-center font-semibold", className)}>
    {children || <>&nbsp;</>}
  </span>
);
const LongLine = () => <span className="border-b-2 border-dotted border-black flex-1 h-4 min-w-40" />;
const Value = ({ children }: { children: React.ReactNode }) => <span className="px-2 font-semibold">{children}</span>;

function toDate(date: any): Date {
  if (date instanceof Date) return date;
  if (date && date.toDate) return date.toDate();
  return new Date();
}

const Checkbox = ({ checked }: { checked: boolean }) => (
    <span className={`border-2 border-black inline-block w-4 h-4 text-center leading-none ${checked ? 'bg-black text-white' : ''}`}>
        {checked ? 'X' : ''}
    </span>
);

export function DeluxePremiumContractTemplate({ contract }: { contract: Contract }) {
  const { firestore } = useFirebase();
  const clientRef = useMemoFirebase(() => {
    if (!firestore || !contract.clientId) return null;
    return doc(firestore, 'clients', contract.clientId);
  }, [firestore, contract.clientId]);

  const { data: client } = useDoc<Client>(clientRef);
  const deluxeDetails = contract.deluxeDetails;

  return (
    <Card className="p-8 print:shadow-none print:border-none print:p-0 font-serif text-sm">
      <CardContent className="p-0 space-y-4">
        <h2 className="text-center font-bold text-lg">CONTRATO DE SERVICIOS EDUCATIVOS</h2>

        <p>
          La empresa FREEWAY ESCUELA DE MANEJO S.A., con ubicación en La Chorrera, Vía Interamericana, Costa Verde, PH Green Plaza, Local #20, debidamente inscrita RUC 155628022-2-2016 DV 2, en adelante denominada LA EMPRESA, y LA ESCUELA se compromete a brindar a EL ESTUDIANTE la capacitación teórico-práctica del curso “PAQUETE DELUXE: PLAN PREMIUM”, con una duración total de 12 semanas, que incluye: 20 horas teóricas (clases presenciales nocturnas), 12 horas prácticas (entrenamiento en circuito cerrado), y Certificación según categoría: A, C o A, C, D.
        </p>

        <div className="space-y-2">
            <p>Entre <span className='font-bold'>{contract.clientName}</span>, con cédula <span className='font-bold'>{deluxeDetails?.studentIdNumber}</span>,</p>
            <div className="flex items-center flex-wrap">
                , con domicilio en 
                <Line>{deluxeDetails?.studentAddress}</Line>
                , teléfonos:
                <Line>{deluxeDetails?.studentPhone1}</Line>/<Line>{deluxeDetails?.studentPhone2}</Line>
            </div>
             <div className="flex items-center flex-wrap">
                , correo electrónico:
                <Value>{client?.email}</Value>
                , en adelante denominado EL ESTUDIANTE.
            </div>
        </div>
        
        <h3 className="font-bold">CLÁUSULA PRIMERA - OBJETO DEL CONTRATO</h3>
        <p>Ambas partes convienen celebrar este contrato en el cual la empresa se compromete a brindar al cliente, un servicio de capacitación y adiestramiento teórico y práctico relacionado con el aprendizaje de conducción de vehículos a motor. El mismo se regirá bajo los términos y condiciones que se detallan en las siguientes cláusulas.</p>

        <h3 className="font-bold">CLÁUSULA SEGUNDA - VALOR, MATRÍCULA Y FORMA DE PAGO</h3>
        <p>El pago se realizará de la siguiente manera: 6 cuotas de B/.33.50 cada una, con fechas de pago establecidas cada dos semanas a partir del inicio del curso.</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <span>CUOTA 1: <Line className="min-w-24" /></span>
          <span>CUOTA 4: <Line className="min-w-24" /></span>
          <span>CUOTA 2: <Line className="min-w-24" /></span>
          <span>CUOTA 5: <Line className="min-w-24" /></span>
          <span>CUOTA 3: <Line className="min-w-24" /></span>
          <span>CUOTA 6: <Line className="min-w-24" /></span>
        </div>
        <p className='p-4 border border-dashed min-h-24'>{deluxeDetails?.paymentDetails || 'la de B/.15.00.'}</p>
        
        <h3 className="font-bold">CLÁUSULA TERCERA - DETALLES DEL CURSO</h3>
        <div className="space-y-2 pl-4">
            <p>1. Transmisión del vehículo: Automático <Checkbox checked={deluxeDetails?.vehicleTransmission === 'Automático'} /> / Manual <Checkbox checked={deluxeDetails?.vehicleTransmission === 'Manual'} /></p>
            <p>2. Categoría de licencia a aplicar: A, C <Checkbox checked={deluxeDetails?.licenseCategory === 'A, C'} /> / A, C, D <Checkbox checked={deluxeDetails?.licenseCategory === 'A, C, D'} /></p>
        </div>

        <h3 className="font-bold">CLÁUSULA CUARTA - HORARIO DE CAPACITACIÓN</h3>
        <p className="font-semibold">Clases teóricas: Miércoles, de 6:00 p.m. a 8:00 p.m.</p>
        <div className="grid grid-cols-3 gap-x-4 gap-y-1">
          <span>Semana 1: <Line /></span>
          <span>Semana 2: <Line /></span>
          <span>Semana 3: <Line /></span>
          <span>Semana 4: <Line /></span>
          <span>Semana 5: <Line /></span>
          <span>Semana 6: <Line /></span>
          <span>Semana 7: <Line /></span>
          <span>Semana 8: <Line /></span>
          <span>Semana 9: <Line /></span>
          <span>Semana 10: <Line /></span>
        </div>
        <p>Clases prácticas: Se programarán a partir de la semana 8 de la capacitación teórica, en horario diurno o vespertino, de acuerdo con la disponibilidad de LA ESCUELA.</p>
         <div className="grid grid-cols-2 gap-x-8 gap-y-2 pl-4">
          {deluxeDetails?.classSchedules?.map((clase, index) => (
            <div key={index} className="flex items-center gap-2">
              Clase {index + 1}: <Line>{clase.date ? format(toDate(clase.date), 'P', { locale: es }) : ''}</Line> 
              Hora <Line>{clase.time}</Line>
            </div>
          ))}
          {(!deluxeDetails?.classSchedules || deluxeDetails.classSchedules.length < 6) && 
            Array.from({ length: 6 - (deluxeDetails?.classSchedules?.length || 0) }).map((_, index) => (
              <div key={index} className="flex items-center gap-2">
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

        <h3 className="font-bold">CLÁUSULA DÉCIMA- ACOMPAÑANTES Y ACCESO</h3>
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
        <p className="text-center">
            En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, República de panamá, a los {format(toDate(contract.createdAt), 'd')} días del mes de {format(toDate(contract.createdAt), 'LLLL', { locale: es })}, de {format(toDate(contract.createdAt), 'yyyy')}, a las {format(toDate(contract.createdAt), 'p', { locale: es })}.
        </p>

        <div className="flex justify-around pt-16">
            <div className="text-center flex flex-col items-center">
                <LongLine />
                <p>Por la Empresa</p>
            </div>
            <div className="text-center flex flex-col items-center">
                <LongLine />
                <p>El Cliente</p>
                <p>N° de identificación: {deluxeDetails?.studentIdNumber}</p>
            </div>
        </div>

      </CardContent>
    </Card>
  );
}
