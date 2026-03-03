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
  const courseValue = autoMotoDetails?.courseValue || 0;
  const isSoloPractica = type === 'Curso Solo Practica';

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
                <p>1. Categoría de licencia a aplicar: A, C <Checkbox checked={autoMotoDetails?.licenseCategory?.includes('C')} /> / A, C, D <Checkbox checked={autoMotoDetails?.licenseCategory?.includes('D')} /> / A, B <Checkbox checked={autoMotoDetails?.licenseCategory?.includes('B')} /></p>
            )}

            <p>2. Transmisión del vehículo: Automático <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Automático'} /> / Manual <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Manual'} /> / Moto <Checkbox checked={autoMotoDetails?.vehicleTransmission === 'Moto'} /></p>
            
            {!isSoloPractica && (
                <>
                    <div className="flex items-center gap-2">3. Horario para clases teóricas: <Value>{autoMotoDetails?.theoreticalClassSchedule}</Value></div>
                </>
            )}
            <p className="font-semibold underline mt-1">4. Propuesta de Horario Práctico:</p>
            
            {/* PREVIEW AGENDAS */}
            {autoMotoDetails?.practicalClassSchedules && autoMotoDetails.practicalClassSchedules.length > 0 && (
                <div className="mb-1">
                    {autoMotoDetails.motoPracticalClassSchedules && autoMotoDetails.motoPracticalClassSchedules.length > 0 && (
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

            {autoMotoDetails?.motoPracticalClassSchedules && autoMotoDetails.motoPracticalClassSchedules.length > 0 && (
                <div>
                    <p className="text-[8px] font-bold italic">Moto:</p>
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
        <p className='text-[10px] text-justify'>EL ESTUDIANTE que no asista a una clase práctica en el horario establecido perderá automáticamente la clase práctica sin derecho a reposición ni reclamo. Si falta a más de una clase sin justificar, deberá pagar un recargo de $20.00 por cada clase perdida.</p>

        <h3 className="font-bold">CLÁUSULA DUODÉCIMA - ACEPTACIÓN</h3>
        <p className="text-center text-[10px] !mt-4">
            Suscrito en Panamá, a los <Value>{format(creationDate, 'd')}</Value> días de <Value>{format(creationDate, 'MMMM', { locale: es })}</Value> de <Value>{format(creationDate, 'yyyy')}</Value>.
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
