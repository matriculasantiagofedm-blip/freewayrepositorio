
'use client';
import type { Contract } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span className={cn("border-b border-dotted border-black flex-1 min-w-8 text-center font-semibold text-primary print:text-black", className)}>
    {children || <>&nbsp;</>}
  </span>
);
const Value = ({ children }: { children: React.ReactNode }) => <span className="px-1 font-semibold text-primary print:text-blue-600">{children}</span>;

const Checkbox = ({ checked }: { checked: boolean }) => (
    <span className={`border border-black inline-block w-3 h-3 text-center leading-none align-middle ${checked ? 'bg-black text-white print:text-black print:bg-white print:font-bold' : ''}`}>
        {checked ? 'X' : ''}
    </span>
);

const LongLine = () => <span className="border-b border-dotted border-black flex-1 h-4 min-w-40" />;

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

export function AutoMotoContractTemplate({ contract }: { contract: Contract }) {
  const autoMotoDetails = contract.autoMotoDetails;
  const creationDate = toDate(contract.createdAt);
  const paymentDeadline = toDate(autoMotoDetails?.paymentDeadline);
  const balance = autoMotoDetails?.balance ?? 0;
  const downPayment = autoMotoDetails?.downPayment ?? 0;
  const courseValue = autoMotoDetails?.courseValue ?? 0;
  
  const formatDate = (date: Date) => {
    if (!date || isNaN(date.getTime()) || date.getFullYear() <= 1970) return <Line />;
    try {
        return <Value>{format(date, 'P', { locale: es })}</Value>;
    } catch {
        return <Line />;
    }
  };

  return (
    <Card className="p-6 print:shadow-none print:border-none print:p-0 font-serif text-xs">
      <CardContent className="p-0 space-y-2 relative">
        <div className="flex justify-between items-start pb-2">
            <h2 className="text-center font-bold text-sm">CONTRATO POR SERVICIO DE CURSO DE MANEJO</h2>
             {contract.folioNumber && (
                <div className="text-right">
                    <p className="font-bold text-sm text-destructive print:text-red-500">CONTRATO N° {String(contract.folioNumber).padStart(6, '0')}</p>
                </div>
            )}
        </div>
        
        <p className='text-[10px] leading-tight'>
            La empresa FREEWAY ESCUELA DE MANEJO S.A., con ubicación en La Chorrera, Vía Interamericana, Costa Verde, PH Green Plaza, Local #20, debidamente inscrita RUC 155628022-2-2016 DV 2, en adelante denominada LA EMPRESA.
            Entre <Line><Value>{contract.clientName}</Value></Line>, identificado con cédula/pasaporte N.° <Line><Value>{autoMotoDetails?.studentIdNumber}</Value></Line>, con domicilio en <Line><Value>{autoMotoDetails?.studentAddress}</Value></Line>, teléfonos: <Line><Value>{autoMotoDetails?.studentPhone1}</Value></Line>/<Line><Value>{autoMotoDetails?.studentPhone2}</Value></Line>, correo electrónico: <Line><Value>{contract.clientEmail}</Value></Line>, en adelante denominado EL ESTUDIANTE.
        </p>

        <div className="bg-slate-50 p-4 rounded-md print:bg-transparent print:p-0 space-y-1">
            <h3 className="font-bold text-center pt-1">DECLARAN:</h3>
            <p className='text-[10px] leading-tight'>Ambas partes convienen celebrar este contrato en el cual la empresa se compromete a brindar al cliente, un servicio de capacitación y adiestramiento teórico y práctico relacionado con el aprendizaje de conducción de vehículos a motor. El mismo se regirá bajo los términos y condiciones que se detallan en las siguientes cláusulas:</p>
            
            <h3 className="font-bold">CLÁUSULA PRIMERA - VALOR Y FORMA DE PAGO</h3>
            <div className='space-y-1 text-[10px]'>
                <p>El valor total del curso es de <Line><Value>{courseValue.toFixed(2)}</Value></Line> (B/.).</p>
                <p>"El estudiante ha efectuado un abono por la suma de B/. <Line><Value>{downPayment.toFixed(2)}</Value></Line>, quedando un saldo pendiente de B/. <Line><Value>{balance > 0 ? balance.toFixed(2) : '0.00'}</Value></Line>, el cual se compromete a cancelar en su totalidad el día {formatDate(paymentDeadline)}."</p>
                <ul className="list-disc list-inside pl-2">
                    <li>Para la inscripción, EL ESTUDIANTE deberá abonar el 50% del valor total como reserva de su cupo y horario.</li>
                    <li>El 50% restante deberá cancelarse antes de iniciar la primera clase práctica.</li>
                    <li>En caso de incumplimiento en los pagos, EL ESTUDIANTE no podrá continuar el curso.</li>
                </ul>
            </div>
            
            <h3 className="font-bold">CLÁUSULA SEGUNDA - DETALLES DEL CURSO</h3>
            <div className='space-y-1 text-[10px] pl-4'>
                <p>1. Transmisión del vehículo: 
                    {(contract.type === 'Curso Auto' || contract.type === 'Curso Mixto') && (
                        <>
                            Automático <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Automático'} /> / 
                            Manual <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Manual'} />
                        </>
                    )}
                    {(contract.type === 'Curso Moto' || contract.type === 'Curso Mixto') && (
                        <>
                            {contract.type === 'Curso Mixto' && ' / '}
                            Moto <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Moto'} />
                        </>
                    )}
                </p>
                <p>2. Categoría de licencia a aplicar: 
                    {(contract.type === 'Curso Auto' || contract.type === 'Curso Mixto') && (
                        <>
                            A, C <Checkbox checked={autoMotoDetails?.licenseCategory === 'A, C'} /> / 
                            A, C, D <Checkbox checked={autoMotoDetails?.licenseCategory === 'A, C, D'} />
                        </>
                    )}
                    {(contract.type === 'Curso Moto' || contract.type === 'Curso Mixto') && (
                        <>
                            {contract.type === 'Curso Mixto' && ' / '}
                            A, B <Checkbox checked={autoMotoDetails?.licenseCategory === 'A, B'} />
                        </>
                    )}
                </p>
                <div className="flex items-center gap-2">3. Horario para clases teóricas: <Line><Value>{autoMotoDetails?.theoreticalClassSchedule}</Value></Line></div>
                <div className="pl-4">
                    {(autoMotoDetails?.theoreticalClassDates || []).map((date, index) => (
                        <span key={index} className="mr-4">Clase {index + 1}: {formatDate(toDate(date))}</span>
                    ))}
                </div>
                <p>4. Horario para clases practicas:</p>
                {contract.type === 'Curso Mixto' ? (
                    <>
                        <p className="font-semibold">Clases de Auto:</p>
                        <div className="pl-4 space-y-0.5">
                            {Array.from({ length: autoMotoDetails?.practicalClassSchedules?.length || 0 }).map((_, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    ○ Clase {index + 1}: Fecha <Line>{autoMotoDetails?.practicalClassSchedules?.[index]?.date ? formatDate(toDate(autoMotoDetails?.practicalClassSchedules?.[index]?.date)) : <>&nbsp;</>}</Line> Hora <Line><Value>{autoMotoDetails?.practicalClassSchedules?.[index]?.time}</Value></Line>
                                </div>
                            ))}
                        </div>
                        <p className="font-semibold pt-2">Clases de Moto:</p>
                        <div className="pl-4 space-y-0.5">
                            {Array.from({ length: autoMotoDetails?.motoPracticalClassSchedules?.length || 0 }).map((_, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    ○ Clase {index + 1}: Fecha <Line>{autoMotoDetails?.motoPracticalClassSchedules?.[index]?.date ? formatDate(toDate(autoMotoDetails?.motoPracticalClassSchedules?.[index]?.date)) : <>&nbsp;</>}</Line> Hora <Line><Value>{autoMotoDetails?.motoPracticalClassSchedules?.[index]?.time}</Value></Line>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="pl-4 space-y-0.5">
                        {Array.from({ length: autoMotoDetails?.practicalClassSchedules?.length || 0 }).map((_, index) => (
                            <div key={index} className="flex items-center gap-2">
                                ○ Clase {index + 1}: Fecha <Line>{autoMotoDetails?.practicalClassSchedules?.[index]?.date ? formatDate(toDate(autoMotoDetails?.practicalClassSchedules?.[index]?.date)) : <>&nbsp;</>}</Line> Hora <Line><Value>{autoMotoDetails?.practicalClassSchedules?.[index]?.time}</Value></Line>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <h3 className="font-bold">CLÁUSULA TERCERA - INASISTENCIAS Y REPROGRAMACIONES</h3>
            <div className='text-[10px] space-y-0.5'>
                <p>EL ESTUDIANTE que no asista a una clase práctica en el horario establecido perderá automáticamente la clase práctica sin derecho a reposición ni reclamo.</p>
                <p>Excepción: Si la falta es por motivo de salud, deberá presentar constancia médica válida y coordinar con la administración para una reprogramación, la cual dependerá de la disponibilidad de horarios.</p>
                <p>SI EL ESTUDIANTE falta a más de una clase práctica sin justificar médicamente, no tendrá derecho a certificado y deberá pagar un recargo de $20.00 por cada clase perdida para poder reprogramarla.</p>
            </div>

            <h3 className="font-bold">CLÁUSULA CUARTA - LUGAR DE INICIO Y TRASLADO</h3>
            <p className='text-[10px]'>Las clases prácticas iniciarán en la oficina de LA ESCUELA. Desde allí, EL ESTUDIANTE será trasladado al circuito de prácticas y posteriormente de regreso. Dicho traslado se encuentra incluido dentro del tiempo de las 2 horas de clase práctica.</p>
            
            <h3 className="font-bold">CLÁUSULA QUINTA - PUNTUALIDAD</h3>
            <p className='text-[10px]'>En caso de que EL ESTUDIANTE llegue tarde a su clase, solo recibirá el tiempo restante de las 2 horas programadas, sin derecho a reposición.</p>
            
            <h3 className="font-bold">CLÁUSULA SEXTA - NORMAS DE COMPORTAMIENTO E VESTIMENTA</h3>
            <p className='text-[10px]'>EL ESTUDIANTE se compromete a: Seguir las instrucciones del instructor, mantener una actitud respetuosa y adecuada durante las clases y asistir en estado óptimo de salud física, mental y emocional. Para las clases prácticas y teóricas, EL ESTUDIANTE deberá asistir con ropa adecuada. Se prohíbe presentarse con: Escotes pronunciados, minifaldas, camisetas sin mangas, pantalones cortos, leggins, chancletas o sandalias. El incumplimiento de esta norma implica la pérdida automática de la clase, sin derecho a reposición.</p>

            <h3 className="font-bold">CLÁUSULA SÉPTIMA - ACOMPAÑANTES Y ACCESO</h3>
            <p className='text-[10px]'>Durante las clases teóricas y prácticas no se permite la presencia de acompañantes, niños, mascotas o terceras personas ajenas al proceso de enseñanza.</p>

            <h3 className="font-bold">CLÁUSULA OCTAVA - CONDICIONES DE APTITUD</h3>
            <p className='text-[10px]'>EL ESTUDIANTE declara estar en pleno uso de sus facultades físicas, mentales y emocionales, siendo responsable de informar a LA ESCUELA sobre cualquier condición médica que limite su desempeño.</p>

            <h3 className="font-bold">CLÁUSULA NOVENA - CANCELACIÓN DEL CONTRATO</h3>
            <p className='text-[10px]'>En caso de que EL ESTUDIANTE decida cancelar el curso o el contrato, no habrá devolución de dinero bajo ninguna circunstancia.</p>
            
            <h3 className="font-bold">CLÁUSULA DÉCIMA - CERTIFICACIÓN</h3>
            <p className='text-[10px]'>El certificado de aprobación del curso será entregado únicamente si EL ESTUDIANTE: Está paz y salvo en sus pagos y ha completado la totalidad del curso teórico y práctico.</p>

            <h3 className="font-bold">CLÁUSULA DÉCIMA PRIMERA - VIGENCIA DEL CURSO</h3>
            <p className='text-[10px]'>Si EL ESTUDIANTE no establece contacto para finalizar su curso en un plazo de tres (3) meses desde la fecha de inicio, se entenderá que renuncia a continuar, sin derecho a devolución del dinero ni a reclamos posteriores.</p>

            <h3 className="font-bold">CLÁUSULA DÉCIMA SEGUNDA - ACEPTACIÓN</h3>
            <p className="text-center text-[10px]">
                En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, República de panamá, a los <Value>{format(creationDate, 'd', { locale: es })}</Value> días del mes de <Value>{format(creationDate, 'LLLL', { locale: es })}</Value>, de <Value>{format(creationDate, 'yyyy', { locale: es })}</Value>, a las <Value>{format(creationDate, 'p', { locale: es })}</Value>.
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
                <p className="text-[10px]">N° de identificación: <Value>{autoMotoDetails?.studentIdNumber}</Value></p>
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
