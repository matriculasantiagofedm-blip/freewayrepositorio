'use client';
import type { Certificate } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toDate } from '@/lib/utils';

function CertificateFront({ certificate }: { certificate: Certificate }) {
    const issueDate = toDate(certificate.issueDate);
    const formattedDay = !isNaN(issueDate.getTime()) ? format(issueDate, 'dd', { locale: es }) : '00';
    const formattedMonth = !isNaN(issueDate.getTime()) ? format(issueDate, 'MMMM', { locale: es }) : '-------';
    const formattedYear = !isNaN(issueDate.getTime()) ? format(issueDate, 'yyyy', { locale: es }) : '0000';
    
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
            return { num: '0000', year: String(currentYear) };
        }
        const parts = folio.split('/');
        return {
            num: parts[1]?.trim().padStart(4, '0') || '0000',
            year: parts[0]?.trim() || String(new Date().getFullYear()),
        }
    }

    const { num: folioNum, year: folioYear } = getFolioParts(certificate.folio);

    return (
        <div className="w-[11in] h-[8.5in] p-8 bg-white text-black font-serif mx-auto print:m-0">
            <div className="w-full h-full border-[3px] border-black flex flex-col p-8 relative overflow-hidden">
                
                {/* Barra Diagonal Amarilla y Negra */}
                <div className="absolute top-[-10px] left-[-10px] w-72 h-8 z-10">
                    <div className="w-full h-full bg-yellow-400 print:[-webkit-print-color-adjust:exact] print:[color-adjust:exact]" style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #fbbf24, #fbbf24 15px, #000 15px, #000 30px)'
                    }}></div>
                </div>

                <header className="flex w-full flex-col items-center justify-center relative pt-4">
                    <h2 className="text-xl font-bold tracking-tight mb-2">FREEWAY ESCUELA DE MANEJO S.A.</h2>
                    <h1 className="text-7xl font-bold tracking-[0.2em] leading-none mb-1 text-black">FREEWAY</h1>
                    <p className="text-2xl tracking-[0.5em] font-semibold text-black uppercase">Escuela de Manejo</p>
                    <p className="text-2xl italic mt-2">Casa Matriz Chorrera</p>

                    {/* Folio y Categoría */}
                    <div className="absolute top-0 right-0 flex flex-col items-center gap-2">
                        <div className="text-center">
                            <p className="text-5xl font-bold mb-1">{getHighestLicenseType(certificate.licenseType)}</p>
                            <p className="text-lg font-medium">{folioNum} / {folioYear}</p>
                        </div>
                    </div>
                </header>

                <main className="flex-grow flex flex-col items-center justify-center text-center px-12 mt-2">
                    <p className="text-xl uppercase tracking-widest mb-6">Otorga el presente Certificado a:</p>

                    <div className="mb-6 w-full">
                        <p className="font-bold text-5xl tracking-tight mb-4 uppercase">
                            {certificate.clientName}
                        </p>
                        <p className="font-bold text-3xl tracking-widest mt-2">C.I.P. &nbsp; {certificate.cip}</p>
                    </div>

                    <div className="text-xl leading-relaxed max-w-5xl mx-auto py-2">
                        <p>
                            Por haber aprobado el curso de capacitación <span className="font-bold underline">TEÓRICO Y PRÁCTICO</span>, para optar por la licencia de
                            conducir tipo <span className="font-bold underline">{getLicenseTypeText(certificate.licenseType)}</span> con una duración de <span className="font-bold underline">{getCourseHours(certificate.courseName)}</span> horas, en cumplimiento del Decreto Ejecutivo No. 640 del 27 de Diciembre de 2006, en su artículo 113, acápite a.
                        </p>
                    </div>

                    <div className="text-base mx-auto mt-4 max-w-3xl font-semibold">
                        <p>
                            Reconocida por la Autoridad del Tránsito y Transporte Terrestre, Resuelto N°380 (04 de diciembre de 2000) Resolución AL-325
                        </p>
                    </div>
                    
                    {/* Espacio optimizado para firma: texto pequeño y subido */}
                    <div className="text-center mt-0 font-bold text-xs italic">
                        <p>***Dado en la república de Panamá, a los {formattedDay} días del mes de {formattedMonth} de {formattedYear}***</p>
                    </div>
                </main>
                
                <footer className="w-full flex-shrink-0 flex justify-end pb-4 pr-12">
                    <div className="text-center w-96 flex flex-col items-center">
                        <div className="w-full border-t-2 border-black mb-2"></div>
                        <p className="text-lg italic font-medium leading-none">CEO—Representante Legal</p>
                        <p className='text-xl italic font-bold'>Lic. Ayax Ortega</p>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function CertificateBack({ certificate }: { certificate: Certificate }) {
    const details = certificate.contract?.autoMotoDetails || certificate.contract?.deluxeDetails;
    const issueDate = toDate(certificate.issueDate);
    const expiryDate = !isNaN(issueDate.getTime()) ? addDays(issueDate, 364) : null;
    const formattedExpiryDate = expiryDate ? format(expiryDate, 'dd-MM-yyyy') : '00-00-0000';
    
    return (
        <div className="w-[11in] h-[8.5in] p-16 bg-white text-black font-sans text-xl flex flex-col justify-start break-before-page mx-auto print:m-0 print:p-16">
            <div className="space-y-6 pt-12">
                <p>Yo, <span className="font-bold">{certificate.clientName.toUpperCase()}</span></p>
                <p>Número de Documento: <span className="font-bold">{certificate.cip}</span></p>
                <p>Hago constar que resido en: <span className="font-bold">{details?.studentAddress?.toUpperCase() || '--------------------'}</span></p>
                <p>
                    con teléfono residencial: <span className="font-bold">{details?.studentPhone1 || 'XXXXX'}</span> &nbsp; &nbsp; 
                    teléfono celular: <span className="font-bold">{details?.studentPhone2 || 'XXXXX'}</span>
                </p>
                <p><span className="font-bold uppercase">TIPO DE LICENCIAS:</span> <span className="font-bold">{certificate.licenseType}</span></p>
                <p>Este certificado tiene validez hasta el <span className="font-bold">{formattedExpiryDate}</span></p>
                
                <div className="pt-12 space-y-8">
                    <div className="flex gap-x-12">
                        <div className="flex items-center gap-2">Primer Nombre: <span className="font-bold border-b border-black min-w-[150px] inline-block">{certificate.firstName?.toUpperCase() || ''}</span></div>
                        <div className="flex items-center gap-2">Segundo Nombre: <span className="font-bold border-b border-black min-w-[150px] inline-block">{certificate.middleName?.toUpperCase() || ''}</span></div>
                    </div>
                    <div className="flex gap-x-12">
                        <div className="flex items-center gap-2">Primer Apellido: <span className="font-bold border-b border-black min-w-[150px] inline-block">{certificate.lastName?.toUpperCase() || ''}</span></div>
                        <div className="flex items-center gap-2">Segundo Apellido: <span className="font-bold border-b border-black min-w-[150px] inline-block">{certificate.secondLastName?.toUpperCase() || ''}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function CertificateTemplate({ certificate }: { certificate: Certificate | null }) {
  if (!certificate) return null;
  return (
    <div className="bg-gray-100 min-h-screen py-8 print:p-0 print:bg-white">
      <CertificateFront certificate={certificate} />
      <div className="h-16 print:hidden"></div>
      <CertificateBack certificate={certificate} />
    </div>
  );
}
