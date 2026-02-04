'use client';
import type { Certificate } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
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

const getHighestLicenseType = (licenseTypes: string = ''): string => {
    if (!licenseTypes) return '';
    const letters = licenseTypes.split(',').map(l => l.trim()).filter(l => l).sort();
    return letters[letters.length - 1] || '';
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

function CertificateFrontAmpliacion({ certificate }: { certificate: Certificate }) {
    const issueDate = toDate(certificate.issueDate);
    const formattedDay = format(issueDate, 'dd', { locale: es });
    const formattedMonth = format(issueDate, 'MMMM', { locale: es });
    const formattedYear = format(issueDate, 'yyyy', { locale: es });
    const { num: folioNum, year: folioYear } = getFolioParts(certificate.folio);
    
    return (
        <div className="w-[11in] h-[8.5in] p-8 bg-white text-black font-serif print:[-webkit-print-color-adjust:exact] print:[color-adjust:exact]">
            <div className="w-full h-full border-2 border-black flex flex-col p-4 relative">
                {/* Header */}
                <header className="flex w-full items-start justify-between mb-4 relative">
                    <div className="w-1/3">
                        {/* Logo can go here */}
                    </div>
                    <div className="w-1/3 text-center">
                        <h1 className="text-3xl font-extrabold tracking-wider">FREEWAY</h1>
                        <p className="text-lg tracking-[0.2em]">ESCUELA DE MANEJO</p>
                    </div>
                    <div className="w-1/3 flex justify-end">
                        <div className="text-center border-l-2 border-b-2 border-black p-2">
                             <p className="text-5xl font-bold">{getHighestLicenseType(certificate.licenseType)}</p>
                             <p className="text-xs">{folioNum} / {folioYear}</p>
                             <div className="w-20 h-24 border-2 border-black mt-2 bg-gray-200 flex items-center justify-center text-gray-500 text-xs">FOTO</div>
                        </div>
                    </div>
                </header>

                <main className="flex-grow flex flex-col justify-center text-center -mt-16">
                    <h2 className="text-2xl font-bold tracking-wider">CERTIFICADO DE CAPACITACIÓN PARA</h2>
                    <h2 className="text-2xl font-bold tracking-wider">CONDUCTORES DE TRANSPORTE PÚBLICO</h2>
                    
                    <div className="text-sm leading-relaxed max-w-4xl mx-auto mt-8 text-left">
                        <p>
                            Por este medio hacemos constar que el/la señor(a) <span className="font-bold underline">{certificate.clientName}</span>,
                            portador(a) del documento de identidad personal N° <span className="font-bold underline">{certificate.cip}</span>,
                            ha cumplido satisfactoriamente con el curso de capacitación para aspirantes a obtener la licencia de conducir tipo
                            <span className="font-bold underline"> {certificate.licenseType} </span> por un total de <span className="font-bold underline">80</span> horas.
                        </p>
                        <p className="mt-4">
                            En cumplimiento de lo que establece la Ley 146 del 15 de Abril de 2020.
                        </p>
                    </div>

                    <div className="text-center mt-8 font-bold text-sm">
                        <p>Dado en la República de Panamá, a los {formattedDay} días del mes de {formattedMonth} de {formattedYear}.</p>
                    </div>
                </main>
                
                <footer className="w-full flex-shrink-0 pt-16">
                    <div className="flex justify-around">
                        <div className="text-center">
                            <p className="inline-block border-t-2 border-black px-16 pt-1 font-semibold">Lic. Ayax Ortega</p>
                            <p>CEO—Representante Legal</p>
                        </div>
                         <div className="text-center">
                            <p className="inline-block border-t-2 border-black px-16 pt-1 font-semibold">&nbsp;</p>
                            <p>DIRECTORA ACADÉMICA</p>
                        </div>
                    </div>
                     <div className="text-center text-xs mt-4">
                        <p>Reconocida por la Autoridad del Tránsito y Transporte Terrestre, Resuelto N°380 (04 de diciembre de 2000) Resolución AL-325</p>
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
