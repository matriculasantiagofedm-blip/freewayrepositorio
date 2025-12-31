
'use client';
import type { Certificate, Contract } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

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
        if (!licenseType) return 'A, C';
        return licenseType.split(',').map(l => l.trim()).join(', ');
    }

    const getHighestLicenseType = (licenseType?: string): string => {
        if (!licenseType) return 'C';
        const letters = licenseType.split(',').map(l => l.trim()).filter(l => l).sort();
        return letters[letters.length - 1] || 'C';
    };

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

                <header className="flex w-full flex-col items-center justify-center mb-4 relative pt-12">
                    <div className="text-center absolute w-full pt-2">
                        <h1 className="text-6xl font-extrabold tracking-widest">FREEWAY</h1>
                        <p className="text-2xl tracking-[0.4em]">ESCUELA DE MANEJO</p>
                    </div>
                    <div className="absolute top-0 right-0 text-left">
                        <p className="text-5xl font-bold">{getHighestLicenseType(certificate.licenseType)}</p>
                        <p className="text-xs text-center">{folioNum} / {folioYear}</p>
                    </div>
                </header>

                <main className="flex-grow flex flex-col justify-start text-center pt-24">
                    <p className="text-lg">Casa Matriz Chorrera</p>
                    <p className="mt-4">Otorga el presente Certificado a:</p>

                    <div className="my-4">
                        <p className="font-bold text-3xl tracking-wider">{certificate.clientName}</p>
                        <p className="font-bold text-xl mt-1 tracking-wider">C.I.P. {certificate.cip}</p>
                    </div>

                    <div className="text-sm leading-snug max-w-3xl mx-auto">
                        <p>
                            Por haber aprobado el curso de capacitación <span className="font-bold underline">TEÓRICO Y PRÁCTICO</span>, para optar por la licencia de
                            conducir tipo <span className="font-bold">{getLicenseTypeText(certificate.licenseType)}</span> con una duración de <span className="font-bold underline">{getCourseHours(certificate.courseName)}</span> horas, en cumplimiento del Decreto Ejecutivo No.640 del
                            27 de Diciembre de 2006, en su artículo 113, acápite a.
                        </p>
                    </div>

                    <div className="text-xs mx-auto mt-6">
                        <p>
                            Reconocida por la Autoridad del Tránsito y Transporte Terrestre, Resuelto N°380 (04 de diciembre de 2000) Resolución AL-325
                        </p>
                    </div>
                    <div className="text-center mt-2 font-bold text-sm">
                        <p>***Dado en la república de Panamá, a los {formattedDay} días del mes de {formattedMonth} de {formattedYear}***</p>
                    </div>
                </main>
                
                <footer className="w-full flex-shrink-0 pt-8 pb-4">
                    <div className="text-center">
                        <p className="inline-block border-t border-black px-24 pt-1">CEO—Representante Legal</p>
                        <p className='font-semibold text-black'>Lic. Ayax Ortega</p>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function CertificateBack({ certificate }: { certificate: Certificate }) {
    const contract = certificate.contract;
    if (!contract) return null;

    const details = contract.autoMotoDetails || contract.deluxeDetails;
    
    return (
        <div className="w-[11in] h-[8.5in] p-8 bg-white flex flex-col text-black font-serif justify-start break-before-page">
            <div className="space-y-6 flex-grow flex flex-col justify-start text-sm pt-8">
                <p>Yo, <span className="font-semibold">{contract.clientName}</span></p>
                <p>Número de Documento: <span className="font-semibold">{details?.studentIdNumber}</span></p>
                <p>Hago constar que resido en: <span className="font-semibold">{details?.studentAddress}</span></p>
                <p>con teléfono residencial: <span className="font-semibold">{details?.studentPhone1}</span> teléfono celular: <span className="font-semibold">{details?.studentPhone2}</span></p>
                <p className="font-bold">TIPO DE LICENCIAS: <span className="font-semibold">{getLicenseTypeText(details?.licenseCategory)}</span></p>
                <p>Este certificado tiene validez de 364 días a partir de <span className="font-semibold">{format(addDays(toDate(certificate.issueDate), 1), 'dd-MM-yyyy')}</span></p>
            </div>
        </div>
    );
}

const getLicenseTypeText = (licenseType?: string) => {
    if (!licenseType) return '';
    return licenseType.split(',').map(l => l.trim()).join(', ');
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
