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
        <div className="w-[10.5in] h-[8in] p-8 bg-white text-black font-serif mx-auto print:m-0 print:p-8 break-after-page border-2 border-black/5">
            <div className="w-full h-full border-[3px] border-black flex flex-col p-8 relative">
                
                <div className="absolute top-0 left-0 w-48 h-6 bg-yellow-400 border-b border-black print:[-webkit-print-color-adjust:exact]"></div>

                <header className="flex w-full flex-col items-center justify-center relative pt-4">
                    <h2 className="text-lg font-bold tracking-tight mb-1 uppercase">FREEWAY ESCUELA DE MANEJO S.A.</h2>
                    <h1 className="text-6xl font-black tracking-[0.15em] leading-none mb-1 text-black">FREEWAY</h1>
                    <p className="text-xl tracking-[0.4em] font-semibold text-black uppercase">Escuela de Manejo</p>
                    <p className="text-lg italic mt-2">Casa Matriz Chorrera</p>

                    <div className="absolute top-0 right-0 text-center">
                        <p className="text-5xl font-black mb-1">{getHighestLicenseType(certificate.licenseType)}</p>
                        <p className="text-base font-bold border-t border-black pt-1">{folioNum} / {folioYear}</p>
                    </div>
                </header>

                <main className="flex-grow flex flex-col items-center justify-center text-center px-12 mt-2">
                    <p className="text-lg uppercase tracking-[0.2em] mb-6 font-medium">Otorga el presente Certificado a:</p>

                    <div className="mb-6 w-full">
                        <p className="font-black text-4xl tracking-tighter leading-none mb-3 uppercase border-b-2 border-black/10 pb-1">
                            {certificate.clientName}
                        </p>
                        <p className="font-bold text-3xl tracking-widest">{certificate.idType || 'C.I.P.'} &nbsp; {certificate.cip}</p>
                    </div>

                    <div className="text-xl leading-relaxed max-w-4xl mx-auto">
                        <p>
                            Por haber aprobado el curso de capacitación <span className="font-black underline">TEÓRICO Y PRÁCTICO</span>, para optar por la licencia de
                            conducir tipo <span className="font-black underline">{getLicenseTypeText(certificate.licenseType)}</span> con una duración de <span className="font-black underline">{getCourseHours(certificate.licenseType, certificate.courseName)}</span> horas, en cumplimiento del Decreto Ejecutivo No. 640 del 27 de Diciembre de 2006, en su artículo 113, acápite a.
                        </p>
                    </div>

                    <div className="text-base mx-auto mt-6 max-w-2xl font-bold opacity-80">
                        <p>
                            Reconocida por la Autoridad del Tránsito y Transporte Terrestre, Resuelto N°380 (04 de diciembre de 2000) Resolución AL-325
                        </p>
                    </div>
                    
                    <div className="text-center mt-4 font-bold text-[10pt] italic">
                        <p>***Dado en la república de Panamá, a los {formattedDay} días del mes de {formattedMonth} de {formattedYear}***</p>
                    </div>
                </main>
                
                <footer className="w-full flex justify-end pt-2 pr-12 pb-2">
                    <div className="text-center w-72">
                        <div className="w-full border-t-2 border-black mb-1"></div>
                        <p className="text-lg italic font-bold">Lic. Ayax Ortega</p>
                        <p className="text-xs uppercase font-black tracking-widest opacity-60">Representante Legal</p>
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
        <div className="w-[10.5in] h-[8in] p-16 bg-white text-black font-sans text-xl flex flex-col justify-start break-before-page mx-auto print:m-0 print:p-16">
            <div className="space-y-6 pt-12">
                <p className="flex gap-4">Yo, <span className="font-black border-b border-black flex-1 uppercase">{certificate.clientName}</span></p>
                <p>Número de Documento ({certificate.idType || 'C.I.P.'}): <span className="font-black">{certificate.cip}</span></p>
                <p className="flex gap-4">Resido en: <span className="font-black border-b border-black flex-1 uppercase">{details?.studentAddress || '--------------------'}</span></p>
                <p>
                    Teléfono residencial: <span className="font-black">{details?.studentPhone1 || 'XXXXX'}</span> &nbsp; &nbsp; 
                    Celular: <span className="font-black">{details?.studentPhone2 || 'XXXXX'}</span>
                </p>
                <p><span className="font-bold uppercase tracking-widest">TIPO DE LICENCIAS:</span> <span className="font-black text-2xl">{certificate.licenseType}</span></p>
                <p>Este certificado tiene validez hasta el <span className="font-black underline">{formattedExpiryDate}</span></p>
                
                <div className="pt-12 space-y-8 border-t border-black/10 mt-8">
                    <div className="flex gap-x-12">
                        <div className="flex flex-col gap-1 flex-1">
                            <span className="text-[10px] font-black uppercase text-slate-400">Primer Nombre</span>
                            <span className="font-black text-2xl border-b border-slate-200 pb-1">{certificate.firstName?.toUpperCase() || ''}</span>
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <span className="text-[10px] font-black uppercase text-slate-400">Segundo Nombre</span>
                            <span className="font-black text-2xl border-b border-slate-200 pb-1">{certificate.middleName?.toUpperCase() || ''}</span>
                        </div>
                    </div>
                    <div className="flex gap-x-12">
                        <div className="flex flex-col gap-1 flex-1">
                            <span className="text-[10px] font-black uppercase text-slate-400">Primer Apellido</span>
                            <span className="font-black text-2xl border-b border-slate-200 pb-1">{certificate.lastName?.toUpperCase() || ''}</span>
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <span className="text-[10px] font-black uppercase text-slate-400">Segundo Apellido</span>
                            <span className="font-black text-2xl border-b border-slate-200 pb-1">{certificate.secondLastName?.toUpperCase() || ''}</span>
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
    <div className="bg-white min-h-screen print:p-0 print:m-0">
      <CertificateFront certificate={certificate} />
      <CertificateBack certificate={certificate} />
    </div>
  );
}
