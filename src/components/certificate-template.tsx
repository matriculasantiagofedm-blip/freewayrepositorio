'use client';
import type { Certificate } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toDate } from '@/lib/utils';

/**
 * TAMAÑOS INCREMENTADOS EN 25%
 */

function CertificateFront({ certificate }: { certificate: Certificate }) {
    const issueDate = toDate(certificate.issueDate);
    const formattedDay = !isNaN(issueDate.getTime()) ? format(issueDate, 'dd', { locale: es }) : '00';
    const formattedMonth = !isNaN(issueDate.getTime()) ? format(issueDate, 'MMMM', { locale: es }) : '-------';
    const formattedYear = !isNaN(issueDate.getTime()) ? format(issueDate, 'yyyy', { locale: es }) : '0000';
    
    const getCourseHours = (licenseType?: string, courseName?: string) => {
        if (licenseType?.includes('F')) return '36';
        if (!courseName) return '36';
        if (courseName.includes('Deluxe 16 Hrs')) return '16';
        if (courseName.includes('Deluxe 12 Hrs')) return '12';
        if (courseName.includes('Basico')) return '12';
        if (courseName.includes('Plus')) return '15';
        if (courseName.includes('Premium')) return '18';
        return '36'; 
    };
    
    const getLicenseTypeText = (licenseType?: string) => {
        if (!licenseType) return 'A, C, B';
        return licenseType.split(',').map(l => l.trim()).join(', ');
    }

    const getHighestLicenseType = (licenseType?: string): string => {
        if (!licenseType) return 'C';
        const types = licenseType.split(',').map(l => l.trim()).filter(l => l);
        if (types.includes('F')) return 'F';
        const sorted = types.sort();
        return sorted[sorted.length - 1] || 'C';
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
        <div className="w-[11in] h-[8.5in] bg-white text-black font-serif relative flex items-center justify-center p-0 break-after-page overflow-hidden print:m-0">
            <div className="w-[10.2in] h-[7.8in] border-[3px] border-black flex flex-col p-10 relative bg-white">
                
                <header className="flex w-full flex-col items-center justify-center relative pt-2">
                    <h2 className="text-[10pt] font-bold tracking-tight mb-1 uppercase">FREEWAY ESCUELA DE MANEJO S.A.</h2>
                    <h1 className="text-[35pt] font-black tracking-[0.12em] leading-none mb-1 text-black">FREEWAY</h1>
                    <p className="text-[12.5pt] tracking-[0.3em] font-semibold text-black uppercase">Escuela de Manejo</p>
                    <p className="text-[10pt] italic mt-1">Casa Matriz Chorrera</p>

                    <div className="absolute top-0 right-0 text-center">
                        <p className="text-[22.5pt] font-black mb-1">{getHighestLicenseType(certificate.licenseType)}</p>
                        <p className="text-[9pt] font-bold border-t border-black pt-1">{folioNum} / {folioYear}</p>
                    </div>
                </header>

                <main className="flex-grow flex flex-col items-center justify-center text-center px-12">
                    <p className="text-[10pt] uppercase tracking-[0.15em] mb-6 font-medium">Otorga el presente Certificado a:</p>

                    <div className="mb-6 w-full">
                        <p className="font-black text-[20pt] tracking-tighter leading-none mb-3 uppercase">
                            {certificate.clientName}
                        </p>
                        <p className="font-bold text-[16pt] tracking-widest">{certificate.idType || 'C.I.P.'} &nbsp; {certificate.cip}</p>
                    </div>

                    <div className="text-[12.5pt] leading-relaxed max-w-3xl mx-auto">
                        <p>
                            Por haber aprobado el curso de capacitación <span className="font-black">TEÓRICO Y PRÁCTICO</span>, para optar por la licencia de
                            conducir tipo <span className="font-black">{getLicenseTypeText(certificate.licenseType)}</span> con una duración de <span className="font-black">{getCourseHours(certificate.licenseType, certificate.courseName)}</span> horas, en cumplimiento del Decreto Ejecutivo No. 640 del 27 de Diciembre de 2006, en su artículo 113, acápite a.
                        </p>
                    </div>

                    <div className="text-[9pt] mx-auto mt-8 max-w-2xl font-bold opacity-90">
                        <p>
                            Reconocida por la Autoridad del Tránsito y Transporte Terrestre, Resuelto N°380 (04 de diciembre de 2000) Resolución AL-325
                        </p>
                    </div>
                    
                    <div className="text-center mt-6 font-bold text-[8pt] italic">
                        <p>***Dado en la república de Panamá, a los {formattedDay} días del mes de {formattedMonth} de {formattedYear}***</p>
                    </div>
                </main>
                
                <footer className="w-full flex justify-end pr-12 pb-4">
                    <div className="text-center w-48">
                        <div className="w-full border-t border-black mb-1"></div>
                        <p className="text-[10pt] italic font-bold">Lic. Ayax Ortega</p>
                        <p className="text-[8pt] uppercase font-black tracking-widest opacity-70">Representante Legal</p>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function CertificateBack({ certificate }: { certificate: Certificate }) {
    const details = certificate.contract?.autoMotoDetails || certificate.contract?.deluxeDetails || certificate.contract?.ampliacionesDetails;
    const issueDate = toDate(certificate.issueDate);
    const expiryDate = !isNaN(issueDate.getTime()) ? addDays(issueDate, 365) : null;
    const formattedExpiryDate = expiryDate ? format(expiryDate, 'dd-MM-yyyy') : '00-00-0000';
    
    return (
        <div className="w-[11in] h-[8.5in] bg-white text-black font-sans relative flex items-center justify-center p-0 overflow-hidden print:m-0">
            <div className="w-[10.5in] h-[8in] p-20 flex flex-col justify-center bg-white text-[14pt] leading-relaxed">
                <div className="space-y-8 w-full">
                    <p className="flex gap-4">Yo, <span className="font-black flex-1 uppercase border-b border-transparent">{certificate.clientName}</span></p>
                    <p>Número de Documento ({certificate.idType || 'C.I.P.'}): <span className="font-black">{certificate.cip}</span></p>
                    <p className="flex gap-4">Resido en: <span className="font-black flex-1 uppercase border-b border-transparent">{details?.studentAddress || ''}</span></p>
                    <p>
                        Teléfono residencial: <span className="font-black">{details?.studentPhone1 || ''}</span> &nbsp; &nbsp; 
                        Celular: <span className="font-black">{details?.studentPhone2 || ''}</span>
                    </p>
                    <p><span className="font-bold uppercase tracking-widest text-[16pt]">TIPO DE LICENCIAS:</span> <span className="font-black">{certificate.licenseType}</span></p>
                    <p>Este certificado tiene validez hasta el <span className="font-black">{formattedExpiryDate}</span></p>
                    
                    <div className="pt-12 space-y-10">
                        <div className="flex gap-x-16">
                            <div className="flex flex-col gap-1 flex-1">
                                <span className="text-[9pt] font-black uppercase text-slate-400">Primer Nombre</span>
                                <span className="font-black text-[18pt] border-b border-slate-100 pb-1">{certificate.firstName?.toUpperCase() || ''}</span>
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                                <span className="text-[9pt] font-black uppercase text-slate-400">Segundo Nombre</span>
                                <span className="font-black text-[18pt] border-b border-slate-100 pb-1">{certificate.middleName?.toUpperCase() || ''}</span>
                            </div>
                        </div>
                        <div className="flex gap-x-16">
                            <div className="flex flex-col gap-1 flex-1">
                                <span className="text-[9pt] font-black uppercase text-slate-400">Primer Apellido</span>
                                <span className="font-black text-[18pt] border-b border-slate-100 pb-1">{certificate.lastName?.toUpperCase() || ''}</span>
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                                <span className="text-[9pt] font-black uppercase text-slate-400">Segundo Apellido</span>
                                <span className="font-black text-[18pt] border-b border-slate-100 pb-1">{certificate.secondLastName?.toUpperCase() || ''}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function CertificateTemplate({ certificate }: { certificate: Certificate | null }) {
  if (!certificate) return null;
  return (
    <div className="bg-white">
      <CertificateFront certificate={certificate} />
      <CertificateBack certificate={certificate} />
    </div>
  );
}
