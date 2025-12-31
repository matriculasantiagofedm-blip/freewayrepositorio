'use client';
import type { Certificate, Contract } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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
  return new Date();
}

function CertificateFront({ certificate }: { certificate: Certificate }) {
    const issueDate = toDate(certificate.issueDate);
    const formattedDay = format(issueDate, 'dd', { locale: es });
    const formattedMonth = format(issueDate, 'MMMM', { locale: es });
    const formattedYear = format(issueDate, 'yyyy', { locale: es });
    
    const getCourseHours = (courseName?: string) => {
        if (!courseName) return '36';
        if (courseName.includes('Deluxe 16 Hrs')) return '16';
        if (courseName.includes('Deluxe 12 Hrs')) return '12';
        if (courseName.includes('Basico')) return '12';
        if (courseName.includes('Plus')) return '15';
        if (courseName.includes('Premium')) return '18';
        return '36'; 
    };
    
    const getLicenseTypeText = (licenseType?: string) => {
        if (!licenseType) return '';
        return licenseType.split(',').map(l => l.trim()).join(', ');
    }

    const getHighestLicenseType = (licenseType?: string): string => {
        if (!licenseType) return '';
        const letters = licenseType.split(',').map(l => l.trim()).filter(l => l).sort();
        return letters[letters.length - 1] || '';
    };

    return (
        <div className="w-[11in] h-[8.5in] p-8 bg-white flex flex-col text-black font-serif print:transform print:scale-[1.05]">
            <div className="absolute top-0 left-0 w-40 h-4" style={{
                backgroundImage: `repeating-linear-gradient(-45deg, #000, #000 10px, #FFD700 10px, #FFD700 20px)`,
                backgroundSize: '28.28px 28.28px'
            }}/>

            <header className="text-center w-full">
                <p className="font-bold text-lg">FREEWAY ESCUELA DE MANEJO S.A.</p>
            </header>

            <section className="flex justify-between items-start mt-4">
                <div className="w-1/3"></div>
                <div className="w-1/3 text-center">
                    <p className="text-4xl font-black tracking-widest">FREEWAY</p>
                    <p className="text-sm tracking-widest">ESCUELA DE MANEJO</p>
                </div>
                <div className="w-1/3 text-right">
                    <p className="text-4xl font-bold">{getHighestLicenseType(certificate.licenseType)}</p>
                    <p className="text-sm">{certificate.folio}</p>
                </div>
            </section>

            <main className="flex-grow flex flex-col justify-start text-center py-4">
                <p className="font-bold">Casa Matriz Chorrera</p>
                <p className="mt-6">Otorga el presente Certificado a:</p>

                <div className="my-6">
                    <p className="font-bold text-3xl">{certificate.clientName}</p>
                    <p className="font-bold text-xl mt-1">C.I.P. {certificate.cip}</p>
                </div>

                <div className="text-sm leading-snug max-w-2xl mx-auto">
                    <p>
                        Por haber aprobado el curso de capacitación <span className="font-bold underline">TEÓRICO Y PRÁCTICO</span>, para optar por la licencia de
                        conducir tipo <span className="font-bold">{getLicenseTypeText(certificate.licenseType)}</span> con una duración de <span className="font-bold underline">{getCourseHours(certificate.courseName)}</span> horas, en cumplimiento del Decreto Ejecutivo No.640 del
                        27 de Diciembre de 2006, en su artículo 113, acápite a.
                    </p>
                </div>
                <div className="mt-4 text-xs whitespace-nowrap">
                    <p>
                        Reconocida por la Autoridad del Tránsito y Transporte Terrestre, Resuelto N°380 (04 de diciembre de 2000) Resolución AL-325
                    </p>
                </div>
            </main>
            
            <footer className="flex-shrink-0 pb-8">
                <div className="text-center mb-16 font-bold">
                    <p>***Dado en la república de Panamá, a los {formattedDay} días del mes de {formattedMonth} de {formattedYear}***</p>
                </div>
                
                <div className="text-center">
                    <p className="inline-block border-t border-black px-12 pt-1">CEO—Representante Legal</p>
                    <p>Lic. Ayax Ortega</p>
                </div>
            </footer>
        </div>
    );
}

function CertificateBack({ certificate }: { certificate: Certificate }) {
    const contract = certificate.contract;
    if (!contract) return null;

    const details = contract.autoMotoDetails || contract.deluxeDetails;
    
    return (
        <div className="w-[11in] h-[8.5in] p-8 bg-white flex flex-col text-black font-serif break-before-page print:transform print:scale-[1.05]">
            <div className="space-y-6 flex-grow flex flex-col justify-center text-sm">
                <p>Yo, <span className="font-semibold">{contract.clientName}</span></p>
                <p>Número de Documento: <span className="font-semibold">{details?.studentIdNumber}</span></p>
                <p>Hago constar que resido en: <span className="font-semibold">{details?.studentAddress}</span></p>
                <p>con teléfono residencial: <span className="font-semibold">{details?.studentPhone1}</span> teléfono celular: <span className="font-semibold">{details?.studentPhone2}</span></p>
                <p className="font-bold">TIPO DE LICENCIAS: <span className="font-semibold">{details?.licenseCategory}</span></p>
                <p>Este certificado tiene validez de 364 días a partir de <span className="font-semibold">{format(toDate(certificate.issueDate), 'dd-MM-yyyy')}</span></p>
            </div>
        </div>
    );
}


export function CertificateTemplate({ certificate }: { certificate: Certificate | null }) {
  if (!certificate) {
    return (
      <div className="w-full h-full p-8 flex items-center justify-center">
        <p>Cargando certificado...</p>
      </div>
    );
  }

  return (
    <>
      <CertificateFront certificate={certificate} />
      <CertificateBack certificate={certificate} />
    </>
  );
}
