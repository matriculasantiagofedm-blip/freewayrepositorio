'use client';
import { Card, CardContent } from './ui/card';
import { cn, toDate } from '@/lib/utils';
import type { AutoMotoContractDetails, ContractType } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span className={cn("border-b border-dotted border-black flex-1 min-w-8 text-center font-semibold text-black", className)}>
    {children || <>&nbsp;</>}
  </span>
);
const Value = ({ children }: { children: React.ReactNode }) => <span className="px-1 font-semibold text-black">{children}</span>;

const Checkbox = ({ checked }: { checked: boolean }) => (
    <span className={`border border-black inline-block w-3 h-3 text-center leading-none align-middle ${checked ? 'bg-black text-white' : ''}`}>
        {checked ? 'X' : ''}
    </span>
);

const LongLine = () => <span className="border-b border-dotted border-black flex-1 h-4 min-w-40" />;

interface AutoMotoContractTemplatePreviewProps {
    clientName?: string;
    clientEmail?: string;
    idType?: string;
    studentIdNumber?: string;
    studentAddress?: string;
    studentPhone1?: string;
    studentPhone2?: string;
    autoMotoDetails?: Partial<AutoMotoContractDetails>;
    createdBy?: string | null;
    type?: ContractType;
    folioNumber?: number;
}

export function AutoMotoContractTemplatePreview({ clientName, clientEmail, idType, studentIdNumber, studentAddress, studentPhone1, studentPhone2, autoMotoDetails, createdBy, type, folioNumber }: AutoMotoContractTemplatePreviewProps) {
  const balance = autoMotoDetails?.balance || 0;
  const creationDate = new Date();
  const paymentDeadline = autoMotoDetails?.paymentDeadline ? toDate(autoMotoDetails.paymentDeadline) : null;
  const isSoloPractica = type === 'Curso Solo Practica';
  const isAutoContract = type === 'Curso Auto';
  const isMotoContract = type === 'Curso Moto';
  const isMixtoContract = type === 'Curso Mixto';
  const licenseStr = autoMotoDetails?.licenseCategory || '';

  const showAutoSessions = isAutoContract || isMixtoContract || (isMotoContract && autoMotoDetails?.additionalService === 'Curso Plus Auto 10Hrs') || (isSoloPractica && (autoMotoDetails as any)?.vehicleType === 'Auto');
  const showMotoSessions = isMotoContract || isMixtoContract || (isAutoContract && autoMotoDetails?.additionalService === 'Plus Moto 10Hrs') || (isSoloPractica && (autoMotoDetails as any)?.vehicleType === 'Motocicleta');

  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return <Line />;
    const date = toDate(dateString);
    if (isNaN(date.getTime())) return <Line />;
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
             {folioNumber && (
                <div className="text-right">
                    <p className="font-bold text-sm text-destructive print:text-red-500">CONTRATO N° {String(folioNumber).padStart(6, '0')}</p>
                </div>
            )}
        </div>
        
        <p className='text-[10px] leading-tight text-justify'>
            La empresa FREEWAY ESCUELA DE MANEJO S.A., con ubicación en La Chorrera, Vía Interamericana, Costa Verde, PH Green Plaza, Local #20, debidamente inscrita RUC 155628022-2-2016 DV 2, en adelante denominada LA EMPRESA, se compromete a brindar a EL ESTUDIANTE la capacitación teórico-práctica del curso “CURSO DE MANEJO”, que incluye la Certificación según la categoría seleccionada.
            Entre <Value>{clientName?.toUpperCase()}</Value>, identificado con <Value>{idType || 'cédula/pasaporte'}</Value> N.° <Value>{studentIdNumber}</Value>, con domicilio en <Value>{studentAddress}</Value>, teléfonos: <Value>{studentPhone1}</Value>/<Value>{studentPhone2}</Value>, correo electrónico: <Value>{clientEmail}</Value>, en adelante denominado EL ESTUDIANTE.
        </p>

        <h3 className="font-bold text-center pt-1">DECLARAN:</h3>
        <p className='text-[10px] leading-tight text-justify'>Ambas partes convienen celebrar este contrato en el cual la empresa se compromete a brindar al cliente, un servicio de capacitación y adiestramiento teórico y práctico relacionado con el aprendizaje de conducción de vehículos a motor. El mismo se regirá bajo los términos y condiciones que se detallan en las siguientes cláusulas:</p>

        <h3 className="font-bold">CLÁUSULA PRIMERA - VALOR Y FORMA DE PAGO</h3>
        <div className='space-y-1 text-[10px] text-justify'>
            <p>"El estudiante ha efectuado un abono por la suma de B/. <Value>{(autoMotoDetails?.downPayment || 0).toFixed(2)}</Value>, quedando un saldo pendiente de B/. <Value>{balance > 0 ? balance.toFixed(2) : '0.00'}</Value>, el cual se compromete a cancelar en su totalidad el día <Value>{paymentDeadline && !isNaN(paymentDeadline.getTime()) ? format(paymentDeadline, 'P', { locale: es }) : ''}</Value>."</p>
        </div>
        
        <h3 className="font-bold">CLÁUSULA SEGUNDA - DETALLES DEL CURSO</h3>
        <div className='space-y-1 text-[10px] pl-4'>
            {isSoloPractica ? (
                <p>1. Categoría de licencia a aplicar: <Value>No Aplica</Value></p>
            ) : (
                <p>1. Categoría de licencia a aplicar: 
                    A, B <Checkbox checked={licenseStr === 'A, B'} /> / 
                    A, C <Checkbox checked={licenseStr === 'A, C'} /> / 
                    A, C, D <Checkbox checked={licenseStr === 'A, C, D'} /> / 
                    A, B, C <Checkbox checked={licenseStr === 'A, B, C' || licenseStr === 'A, C, B'} /> / 
                    A, B, C, D <Checkbox checked={licenseStr === 'A, B, C, D' || licenseStr === 'A, C, B, D'} />
                </p>
            )}

            <p>2. Transmisión del vehículo: Automático <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Automático'} /> / Manual <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Manual' || autoMotoDetails?.vehicleTransmission === 'Moto'} /></p>
            
            {!isSoloPractica && (
                <>
                    <div className="flex items-center gap-2">3. Horario para clases teóricas: <Value>{autoMotoDetails?.theoreticalClassSchedule}</Value></div>
                </>
            )}
            <p className="font-semibold underline mt-1">4. Propuesta de Horario Práctico:</p>
            
            {/* AGENDA DE AUTO - Filtrada en preview */}
            {showAutoSessions && autoMotoDetails?.practicalClassSchedules && autoMotoDetails.practicalClassSchedules.length > 0 && (
                <div className="mb-1">
                    {showMotoSessions && (
                        <p className="text-[8px] font-bold italic">Auto:</p>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 pl-2">
                        {autoMotoDetails.practicalClassSchedules.map((s, index) => (
                            <div key={index} className="text-[9px]">
                                ○ Clase {index + 1}: {s.date ? formatDate(s.date) : ''} - {s.time}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* AGENDA DE MOTO - Filtrada en preview */}
            {showMotoSessions && autoMotoDetails?.motoPracticalClassSchedules && autoMotoDetails.motoPracticalClassSchedules.length > 0 && (
                <div>
                    {showAutoSessions && (
                        <p className="text-[8px] font-bold italic">Moto:</p>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 pl-2">
                        {autoMotoDetails.motoPracticalClassSchedules.map((s, index) => (
                            <div key={index} className="text-[9px]">
                                ○ Clase {index + 1}: {s.date ? formatDate(s.date) : ''} - {s.time}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <h3 className="font-bold">CLÁUSULA TERCERA - INASISTENCIAS Y REPROGRAMACIONES</h3>
        <ul className="text-[10px] space-y-0.5 pl-1">
          <li className="flex items-start gap-1"><span className="shrink-0">▪</span><span>EL ESTUDIANTE que no asista a una clase práctica en el horario establecido <strong>perderá automáticamente la clase práctica sin derecho a reposición ni reclamo.</strong></span></li>
          <li className="flex items-start gap-1"><span className="shrink-0">▪</span><span><strong>Excepción</strong>: Si la falta es por <strong>motivo de salud</strong>, deberá presentar constancia médica válida y coordinar con la administración para una reprogramación.</span></li>
          <li className="flex items-start gap-1"><span className="shrink-0">▪</span><span>Si falta sin justificar médicamente, <strong>no tendrá derecho a certificado</strong> y deberá pagar un <strong>recargo de $20.00 por cada clase perdida</strong>.</span></li>
        </ul>

        <h3 className="font-bold">CLÁUSULA CUARTA - LUGAR DE INICIO Y TRASLADO</h3>
        <p className='text-[10px] text-justify'>Las clases prácticas iniciarán en la oficina de LA ESCUELA. Desde allí, EL ESTUDIANTE será trasladado al circuito de prácticas y posteriormente de regreso. Dicho traslado se encuentra incluido dentro del tiempo de las <strong>2 horas de clase práctica.</strong></p>

        <h3 className="font-bold">CLÁUSULA QUINTA - RESTRICCIONES DE ACOMPAÑANTES</h3>
        <p className='text-[10px] text-justify'>No se permitirá bajo ningún concepto el ingreso de acompañantes, niños, mascotas o terceras personas durante las clases teóricas o prácticas.</p>

        <h3 className="font-bold">CLÁUSULA SEXTA - PUNTUALIDAD</h3>
        <p className='text-[10px] text-justify'>En caso de que EL ESTUDIANTE llegue tarde a su clase, <strong>solo recibirá el tiempo restante de las 2 horas programadas</strong>, sin derecho a reposición.</p>

        <h3 className="font-bold">CLÁUSULA SÉPTIMA - CANCELACIÓN DEL CURSO</h3>
        <p className='text-[10px] text-justify'>Si EL ESTUDIANTE decide cancelar el curso una vez iniciada la inscripción, no habrá devolución de dinero bajo ninguna circunstancia.</p>

        <h3 className="font-bold">CLÁUSULA OCTAVA - OBLIGACIONES DEL ESTUDIANTE</h3>
        <p className='text-[10px]'>EL ESTUDIANTE se compromete a: 1. Seguir las instrucciones del instructor. 2. Mantener una actitud respetuosa y adecuada durante las clases. 3. Asistir en estado óptimo de salud física, mental y emocional.</p>

        <h3 className="font-bold">CLÁUSULA NOVENA - VESTIMENTA</h3>
        <ul className="text-[10px] space-y-0.5 pl-1">
          <li className="flex items-start gap-1"><span className="shrink-0">▪</span><span>Se prohíbe: Escotes pronunciados, minifaldas, camisetas sin mangas, pantalones cortos, leggins, chancletas o sandalias.</span></li>
          <li className="flex items-start gap-1"><span className="shrink-0">▪</span><span>El incumplimiento implica la <strong>pérdida automática de la clase</strong>, sin derecho a reposición.</span></li>
        </ul>

        <h3 className="font-bold">CLÁUSULA DÉCIMA - CERTIFICACIÓN</h3>
        <p className='text-[10px]'>El certificado será entregado únicamente si EL ESTUDIANTE: 1. Está paz y salvo en sus pagos. 2. Ha completado la totalidad del curso teórico y práctico.</p>

        <h3 className="font-bold">CLÁUSULA DÉCIMA PRIMERA - VIGENCIA DEL CURSO</h3>
        <p className='text-[10px] text-justify'>Si EL ESTUDIANTE no establece contacto para finalizar su curso en un plazo de <strong>tres (3) meses</strong> desde la fecha de inicio, se entenderá que renuncia a continuar, sin derecho a devolución del dinero ni a reclamos posteriores.</p>

        <h3 className="font-bold">CLÁUSULA DÉCIMA SEGUNDA - ACEPTACIÓN</h3>
        <p className='text-[10px] text-justify'>Ambas partes declaran haber leído, entendido y aceptado el presente contrato, firmándolo en señal de conformidad.</p>
        <p className="text-[10px] !mt-2">
            En fe de lo cual, se suscribe en la ciudad de Panamá, a los <Value>{format(creationDate, 'd')}</Value> días de <Value>{format(creationDate, 'MMMM', { locale: es })}</Value> de <Value>{format(creationDate, 'yyyy')}</Value>.
        </p>

        <div className="flex justify-around pt-6">
            <div className="text-center flex flex-col items-center">
                <LongLine />
                <p className="text-[10px]">Por la Empresa</p>
            </div>
            <div className="text-center flex flex-col items-center">
                <LongLine />
                <p className="text-[10px]">El Cliente</p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
