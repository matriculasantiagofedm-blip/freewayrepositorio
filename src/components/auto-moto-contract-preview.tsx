'use client';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';
import type { AutoMotoContractDetails } from '@/lib/types';

const Line = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <span className={cn("border-b border-dotted border-black flex-1 min-w-8 text-center font-semibold text-primary", className)}>
    {children || <>&nbsp;</>}
  </span>
);
const Value = ({ children }: { children: React.ReactNode }) => <span className="px-1 font-semibold text-primary">{children}</span>;

const Checkbox = ({ checked }: { checked: boolean }) => (
    <span className={`border border-black inline-block w-3 h-3 text-center leading-none align-middle ${checked ? 'bg-black text-white' : ''}`}>
        {checked ? 'X' : ''}
    </span>
);

interface AutoMotoContractTemplatePreviewProps {
    folio: string;
    clientName?: string;
    clientEmail?: string;
    autoMotoDetails?: AutoMotoContractDetails;
    createdBy?: string | null;
}

export function AutoMotoContractTemplatePreview({ folio, clientName, clientEmail, autoMotoDetails, createdBy }: AutoMotoContractTemplatePreviewProps) {
  const balance = (autoMotoDetails?.courseValue || 0) - (autoMotoDetails?.downPayment || 0);

  return (
    <Card className="p-6 print:shadow-none print:border-none print:p-0 font-serif text-xs">
      <CardContent className="p-0 space-y-2 relative">
        <p className="absolute top-0 right-0 text-xs font-semibold text-destructive">Folio: {folio}</p>
        <div className="flex items-center gap-2 justify-center pb-2">
            <h2 className="text-center font-bold text-sm">CONTRATO POR SERVICIO DE CURSO DE MANEJO</h2>
        </div>
        
        <p className='text-[10px] leading-tight'>
            La empresa FREEWAY ESCUELA DE MANEJO S.A., con ubicación en La Chorrera, Vía Interamericana, Costa Verde, PH Green Plaza, Local #20, debidamente inscrita RUC 155628022-2-2016 DV 2, en adelante denominada LA EMPRESA, y <Line>{clientName}</Line>, identificado con cédula/pasaporte N.° <Line>{autoMotoDetails?.studentIdNumber}</Line>, con domicilio en <Line>{autoMotoDetails?.studentAddress}</Line>, teléfonos: <Line>{autoMotoDetails?.studentPhone}</Line>, correo electrónico: <Line>{clientEmail}</Line>, en adelante denominado EL ESTUDIANTE.
        </p>

        <h3 className="font-bold text-center pt-1">DECLARAN:</h3>
        <p className='text-[10px] leading-tight'>Ambas partes convienen celebrar este contrato en el cual la empresa se compromete a brindar al cliente, un servicio de capacitación y adiestramiento teórico y práctico relacionado con el aprendizaje de conducción de vehículos a motor. El mismo se regirá bajo los términos y condiciones que se detallan en las siguientes cláusulas:</p>

        <h3 className="font-bold">CLÁUSULA PRIMERA - VALOR Y FORMA DE PAGO</h3>
        <div className='space-y-1 text-[10px]'>
            <p>El valor total del curso es de <Line>{autoMotoDetails?.courseValue ? `B/.${autoMotoDetails.courseValue.toFixed(2)}` : ''}</Line> (B/ <Line>{autoMotoDetails?.courseValue?.toFixed(2)}</Line>).</p>
            <p>"El estudiante ha efectuado un abono por la suma de B/. <Line>{autoMotoDetails?.downPayment?.toFixed(2)}</Line>, quedando un saldo pendiente de B/. <Line>{balance > 0 ? balance.toFixed(2) : '0.00'}</Line>, el cual se compromete a cancelar en su totalidad el día <Line>{autoMotoDetails?.paymentDeadline}</Line>."</p>
            <ul className="list-disc list-inside pl-2">
                <li>Para la inscripción, EL ESTUDIANTE deberá abonar el 50% del valor total como reserva de su cupo y horario.</li>
                <li>El 50% restante deberá cancelarse antes de iniciar la primera clase práctica.</li>
                <li>En caso de incumplimiento en los pagos, EL ESTUDIANTE no podrá continuar el curso.</li>
            </ul>
        </div>
        
        <h3 className="font-bold">CLÁUSULA SEGUNDA - DETALLES DEL CURSO</h3>
        <div className='space-y-1 text-[10px] pl-4'>
             <p>1. Transmisión del vehículo: Automático <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Automático'} /> / Manual <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Manual'} /> / Moto <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Moto'} /></p>
             <p>2. Categoría de licencia a aplicar: A, C <Checkbox checked={autoMotoDetails?.licenseCategory === 'A, C'} /> / A, C, D <Checkbox checked={autoMotoDetails?.licenseCategory === 'A, C, D'} /> / A, B <Checkbox checked={autoMotoDetails?.licenseCategory === 'A, B'} /></p>
            <div className="flex items-center gap-2">3. Horario para clases teóricas: <Line>{autoMotoDetails?.theoreticalClassSchedule}</Line> Hora <Line>&nbsp;</Line></div>
            <p>4. Horario para clases practicas:</p>
            <div className="pl-4 space-y-0.5">
                <div className="flex items-center gap-2">○ Clase 1: <Line>&nbsp;</Line> Hora <Line>{autoMotoDetails?.practicalClassSchedules?.[0]?.time}</Line></div>
                <div className="flex items-center gap-2">○ Clase 2: <Line>&nbsp;</Line> Hora <Line>{autoMotoDetails?.practicalClassSchedules?.[1]?.time}</Line></div>
                <div className="flex items-center gap-2">○ Clase 3: <Line>&nbsp;</Line> Hora <Line>{autoMotoDetails?.practicalClassSchedules?.[2]?.time}</Line></div>
                <div className="flex items-center gap-2">○ Clase 4: <Line>&nbsp;</Line> Hora <Line>{autoMotoDetails?.practicalClassSchedules?.[3]?.time}</Line></div>
            </div>
        </div>

        <h3 className="font-bold">CLÁUSULA TERCERA - INASISTENCIAS Y REPROGRAMACIONES</h3>
        <div className='text-[10px] space-y-0.5'>
            <p>EL ESTUDIANTE que no asista a una clase práctica en el horario establecido perderá automáticamente la clase práctica sin derecho a reposición ni reclamo.</p>
            <p>Excepción: Si la falta es por motivo de salud, deberá presentar constancia médica válida y coordinar con la administración para una reprogramación, la cual dependerá de la disponibilidad de horarios.</p>
            <p>SI EL ESTUDIANTE falta a más de una clase práctica sin justificar médicamente, no tendrá derecho a certificado y deberá pagar un recargo de $20.00 por cada clase perdida para poder reprogramarla.</p>
        </div>

        <h3 className="font-bold">CLÁUSULA CUARTA - LUGAR DE INICIO Y TRASLADO</h3>
        <p className='text-[10px]'>Las clases prácticas iniciarán en la oficina de LA ESCUELA. Desde allí, EL ESTUDIANTE será trasladado al circuito de prácticas y posteriormente de regreso. Dicho traslado se encuentra incluido dentro del tiempo de las 2 horas de clase práctica.</p>

        {/* The rest of the template will be added later */}

        {createdBy && (
          <div className="text-xs text-muted-foreground pt-8">
            Confeccionado por: {createdBy}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
