'use client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from './ui/card';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { AutoMotoContractDetails } from '@/lib/types';

const Value = ({ children, className }: { children: React.ReactNode, className?: string }) => <span className={cn("px-1 font-semibold text-primary", className)}>{children}</span>;

interface AutoMotoContractTemplatePreviewProps {
    folio: string;
    clientName?: string;
    autoMotoDetails?: AutoMotoContractDetails;
    createdBy?: string | null;
}

export function AutoMotoContractTemplatePreview({ folio, clientName, autoMotoDetails, createdBy }: AutoMotoContractTemplatePreviewProps) {
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
  
  return (
    <Card className="p-6 print:shadow-none print:border-none print:p-0 font-serif text-xs">
      <CardContent className="p-0 space-y-2 relative">
        <p className="absolute top-0 right-0 text-xs font-semibold text-destructive">Folio: {folio}</p>

        <h2 className="text-center font-bold text-sm mb-2 pt-4">CONTRATO DE SERVICIOS EDUCATIVOS</h2>
        
        <h3 className="font-bold">CLÁUSULA QUINTA - RESTRICCIONES DE ACOMPAÑANTES</h3>
        <p>No se permitirá bajo ningún concepto el ingreso de acompañantes, niños, mascotas o terceras personas durante las clases teóricas o prácticas.</p>
        
        <h3 className="font-bold">CLÁUSULA SEXTA - PUNTUALIDAD</h3>
        <p>En caso de que EL ESTUDIANTE llegue tarde a su clase, solo recibirá el tiempo restante de las 2 horas programadas, sin derecho a reposición.</p>

        <h3 className="font-bold">CLÁUSULA SÉPTIMA - CANCELACIÓN DEL CURSO</h3>
        <p>Si EL ESTUDIANTE decide cancelar el curso una vez iniciada la inscripción, no habrá devolución de dinero bajo ninguna circunstancia.</p>

        <h3 className="font-bold">CLÁUSULA OCTAVA - OBLIGACIONES DEL ESTUDIANTE</h3>
        <p>EL ESTUDIANTE se compromete a:</p>
        <ol className="list-decimal list-inside pl-4">
            <li>Seguir las instrucciones del instructor.</li>
            <li>Mantener una actitud respetuosa y adecuada durante las clases.</li>
            <li>Asistir en estado óptimo de salud física, mental y emocional.</li>
        </ol>

        <h3 className="font-bold">CLÁUSULA NOVENA - VESTIMENTA</h3>
        <p>Para las clases prácticas y teóricas, EL ESTUDIANTE deberá asistir con ropa adecuada. Se prohíbe presentarse con: Escotes pronunciados, minifaldas, camisetas sin mangas, pantalones cortos, leggins, chancletas o sandalias. El incumplimiento de esta norma implica la pérdida automática de la clase, sin derecho a reposición.</p>

        <h3 className="font-bold">CLÁUSULA DÉCIMA - CERTIFICACIÓN</h3>
        <p>El certificado de aprobación del curso será entregado únicamente si EL ESTUDIANTE:</p>
        <ol className="list-decimal list-inside pl-4">
            <li>Está paz y salvo en sus pagos.</li>
            <li>Ha completado la totalidad del curso teórico y práctico.</li>
        </ol>
        
        <h3 className="font-bold">CLÁUSULA DÉCIMA PRIMERA - VIGENCIA DEL CURSO</h3>
        <p>Si EL ESTUDIANTE no establece contacto para finalizar su curso en un plazo de tres (3) meses desde la fecha de inicio, se entenderá que renuncia a continuar, sin derecho a devolución del dinero ni a reclamos posteriores.</p>
        
        <h3 className="font-bold">CLÁUSULA DÉCIMA SEGUNDA - ACEPTACIÓN</h3>
        <p>Ambas partes declaran haber leído, entendido y aceptado el presente contrato, firmándolo en señal de conformidad.</p>

        <p className="text-center !mt-4">
            En fe de lo cual, se suscribe el presente contrato en la ciudad de Panamá, República de panamá, a los <Value>{format(currentDate, 'd')}</Value> días del mes de <Value>{format(currentDate, 'LLLL', { locale: es })}</Value>, de <Value>{format(currentDate, 'yyyy')}</Value>, a las <Value>{format(currentDate, 'p', { locale: es })}</Value>.
        </p>

        <div className="flex justify-around pt-12">
            <div className="text-center flex flex-col items-center">
                <span className="border-b border-black w-48 block">&nbsp;</span>
                <p className="text-[10px]">Por la Empresa</p>
            </div>
            <div className="text-center flex flex-col items-center">
                <span className="border-b border-black w-48 block"><Value className="text-black">{clientName}</Value></span>
                <p className="text-[10px]">El Cliente</p>
                <span className="border-b border-black w-48 block mt-4"><Value className="text-black">{autoMotoDetails?.studentIdNumber}</Value></span>
                <p className="text-[10px]">N° de identificación</p>
            </div>
        </div>

        {createdBy && (
          <div className="text-xs text-muted-foreground pt-8">
            Confeccionado por: {createdBy}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
