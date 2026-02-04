
'use client';
import type { Certificate } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';

function toDate(date: any): Date {
  if (!date) return new Date('invalid');
  if (date instanceof Date) {
    return date;
  }
  // Handle Firestore Timestamp
  if (date && typeof date.toDate === 'function') {
    return date.toDate();
  }
  // Handle ISO strings or other string formats
  if (typeof date === 'string') {
    // Attempt to parse, replacing hyphens for better cross-browser compatibility
    const parsed = new Date(date.replace(/-/g, '/'));
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  // Fallback for unexpected types
  return new Date('invalid');
}

const getHighestLicenseType = (licenseTypes: string = ''): string => {
    if (!licenseTypes) return '';
    const letters = licenseTypes.split(',').map(l => l.trim()).filter(l => l).sort();
    return letters[letters.length - 1] || '';
};

const getLicenseTypeText = (licenseType?: string) => {
    if (!licenseType) return '';
    return licenseType.split(',').map(l => l.trim()).join(',');
}

const getFolioParts = (folio?: string) => {
    if (!folio || !folio.includes('/')) {
        const currentYear = new Date().getFullYear();
        return { num: '0001', year: String(currentYear) };
    }
    const parts = folio.split('/');
    return {
        num: parts[1]?.trim().padStart(4, '0') || '0001',
        year: parts[0]?.trim() || String(new Date().getFullYear()),
    }
}

function CertificateFrontAmpliacion({ certificate }: { certificate: Certificate }) {
    const issueDate = toDate(certificate.issueDate);
    const formattedDay = format(issueDate, 'dd', { locale: es });
    const formattedMonth = format(issueDate, 'MMMM', { locale: es });
    const formattedYear = format(issueDate, 'yyyy', { locale: es });
    const { num: folioNum, year: folioYear } = getFolioParts(certificate.folio);
    
    return (
        <div className="w-[11in] h-[8.5in] p-8 bg-white text-black font-serif">
            <div className="w-full h-full border-2 border-black flex flex-col p-8 relative">
                 {/* Decorative Top Bar */}
                <div className="absolute top-0 left-0 h-4 w-48 print:[-webkit-print-color-adjust:exact] print:[color-adjust:exact]">
                    <div className="h-full w-full bg-yellow-400 -skew-x-[45deg] origin-top-left flex print:[-webkit-print-color-adjust:exact] print:[color-adjust:exact]">
                        <div className="w-1/4 h-full bg-black print:[-webkit-print-color-adjust:exact] print:[color-adjust:exact]"></div>
                        <div className="w-1/4 h-full bg-yellow-400 print:[-webkit-print-color-adjust:exact] print:[color-adjust:exact]"></div>
                        <div className="w-1/4 h-full bg-black print:[-webkit-print-color-adjust:exact] print:[color-adjust:exact]"></div>
                        <div className="w-1/4 h-full bg-yellow-400 print:[-webkit-print-color-adjust:exact] print:[color-adjust:exact]"></div>
                    </div>
                </div>

                <header className="flex w-full flex-col items-center justify-center mb-4 relative pt-4">
                    <div className="text-center absolute w-full pt-8">
                        <h1 className="text-5xl font-extrabold tracking-widest">FREEWAY</h1>
                        <p className="text-xl tracking-[0.3em]">ESCUELA DE MANEJO</p>
                    </div>
                    <div className="absolute top-0 right-0 text-center">
                         <p className="text-5xl font-bold">{getHighestLicenseType(certificate.licenseType)}</p>
                         <p className="text-xs">{folioNum} / {folioYear}</p>
                    </div>
                </header>

                <main className="flex-grow flex flex-col justify-start text-center pt-20">
                    <p className="text-base">Casa Matriz Chorrera</p>
                    <p className="mt-2 text-base">Otorga el presente Certificado a:</p>

                    <div className="my-4">
                        <p className="font-bold text-3xl tracking-wider">{certificate.clientName}</p>
                        <p className="font-bold text-xl mt-1 tracking-wider">C.I.P. {certificate.cip}</p>
                    </div>

                    <div className="text-sm leading-snug max-w-3xl mx-auto border border-dashed border-gray-400 p-4">
                        <p>
                            Por haber aprobado el curso de capacitación <span className="font-bold">TEÓRICO Y PRÁCTICO</span>, para optar por la licencia de
                            conducir tipo <span className="font-bold">{getLicenseTypeText(certificate.licenseType)}</span> con una duración de <span className="font-bold">80</span> horas, en cumplimiento de la Ley 146 del 15 de Abril
                            de 2020, acápite a.
                        </p>
                    </div>

                    <div className="text-xs mx-auto mt-4">
                        <p>
                            Reconocida por la Autoridad del Tránsito y Transporte Terrestre, Resuelto N°380 (04 de diciembre de 2000) Resolución AL-325
                        </p>
                    </div>
                    <div className="text-center mt-4 font-bold text-sm">
                        <p>***Dado en la república de Panamá, a los {formattedDay} dias del mes de {formattedMonth} de {formattedYear}***</p>
                    </div>
                </main>
                
                <footer className="w-full flex-shrink-0 pt-8 pb-4">
                    <div className="text-center">
                        <p className="inline-block border-t-2 border-black px-24 pt-1 font-semibold">CEO—Representante Legal</p>
                         <p>Lic. Ayax Ortega</p>
                    </div>
                </footer>
            </div>
        </div>
    );
}


function CertificateBackAmpliacion({ certificate }: { certificate: Certificate }) {
    const issueDate = toDate(certificate.issueDate);
    const validityDate = addDays(issueDate, 364);

    return (
        <div className="w-[11in] h-[8.5in] p-8 bg-white flex flex-col text-black font-serif justify-start break-before-page">
            <div className="space-y-6 flex-grow flex flex-col justify-start text-lg pt-16 px-16">
                <p>Yo, <span className="font-semibold">{certificate.clientName}</span></p>
                <p>Número de Documento: <span className="font-semibold">{certificate.cip}</span></p>
                <p>Hago constar que resido en: <span className="font-semibold">{certificate.contract?.ampliacionesDetails?.studentAddress}</span></p>
                <p>
                    con teléfono residencial: <span className="font-semibold">{certificate.contract?.ampliacionesDetails?.studentPhone1}</span>,
                    teléfono celular: <span className="font-semibold">{certificate.contract?.ampliacionesDetails?.studentPhone2 || 'N/A'}</span>
                </p>
                <p className="font-bold">TIPO DE LICENCIAS: <span className="font-semibold">{certificate.licenseType}</span></p>
                <p>Este certificado tiene validez de 364 días a partir de <span className="font-semibold">{format(validityDate, 'dd-MM-yyyy')}</span></p>
                <div className='pt-4'>
                    <p>Primer Nombre: <span className="font-semibold">{certificate.firstName || ''}</span>, Segundo Nombre: <span className="font-semibold">{certificate.middleName || ''}</span></p>
                    <p>Primer Apellido: <span className="font-semibold">{certificate.lastName || ''}</span>, Segundo Apellido: <span className="font-semibold">{certificate.secondLastName || ''}</span></p>
                </div>
            </div>
        </div>
    );
}

export function AmpliacionCertificateTemplate({ certificate }: { certificate: Certificate | null }) {
  if (!certificate) {
    return (
      <div className="w-full h-full p-8 flex items-center justify-center">
        <p>Cargando certificado de ampliación...</p>
      </div>
    );
  }

  return (
    <>
      <CertificateFrontAmpliacion certificate={certificate} />
      <CertificateBackAmpliacion certificate={certificate} />
    </>
  );
}

    