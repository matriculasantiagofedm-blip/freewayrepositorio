'use client';
import type { Certificate } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toDate } from '@/lib/utils';

const getHighestLicenseType = (licenseTypes: string = ''): string => {
    if (!licenseTypes) return 'E1';
    const letters = licenseTypes.split(',').map(l => l.trim()).filter(l => l).sort();
    return letters[letters.length - 1] || 'E1';
};

const getLicenseTypeText = (licenseType?: string) => {
    if (!licenseType) return 'E1, E2, E3';
    return licenseType.split(',').map(l => l.trim()).join(', ');
}

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

function CertificateFrontAmpliacion({ certificate }: { certificate: Certificate }) {
    const issueDate = toDate(certificate.issueDate);
    const formattedDay = !isNaN(issueDate.getTime()) ? format(issueDate, 'dd', { locale: es }) : '00';
    const formattedMonth = !isNaN(issueDate.getTime()) ? format(issueDate, 'MMMM', { locale: es }) : '-------';
    const formattedYear = !isNaN(issueDate.getTime()) ? format(issueDate, 'yyyy', { locale: es }) : '0000';
    const { num: folioNum, year: folioYear } = getFolioParts(certificate.folio);
    
    return (
        <div className="w-full min-h-screen flex items-center justify-center bg-white print:block print:h-auto break-after-page">
            <div className="w-[10.5in] h-[8in] bg-white text-black font-serif mx-auto print:m-0 relative flex items-center justify-center pl-4 pr-24 py-8">
                <div className="w-full h-full border-[4px] border-black flex flex-col p-8 relative overflow-hidden">
                    
                    <header className="flex w-full flex-col items-center justify-center relative pt-2">
                        <h2 className="text-[7pt] font-bold tracking-tight mb-1 uppercase">FREEWAY ESCUELA DE MANEJO S.A.</h2>
                        <h1 className="text-[20pt] font-black tracking-[0.15em] leading-none mb-1 text-black">FREEWAY</h1>
                        <p className="text-[9pt] tracking-[0.4em] font-semibold text-black uppercase">Escuela de Manejo</p>
                        <p className="text-[7pt] italic mt-1">Casa Matriz Chorrera</p>

                        <div className="absolute top-0 right-0 text-center">
                            <p className="text-[15.5pt] font-black mb-1">{getHighestLicenseType(certificate.licenseType)}</p>
                            <p className="text-[6pt] font-bold border-t border-black pt-1">{folioNum} / {folioYear}</p>
                        </div>
                    </header>

                    <main className="flex-grow flex flex-col items-center justify-center text-center px-8 mt-1">
                        <p className="text-[7pt] uppercase tracking-[0.2em] mb-4 font-medium">Otorga el presente Certificado a:</p>

                        <div className="mb-4 w-full">
                            <p className="font-black text-[14pt] tracking-tighter leading-none mb-2 uppercase">
                                {certificate.clientName}
                            </p>
                            <p className="font-bold text-[12pt] tracking-widest">{certificate.idType || 'C.I.P.'} &nbsp; {certificate.cip}</p>
                        </div>

                        <div className="text-[9pt] leading-relaxed max-w-3xl mx-auto py-3 px-6 border border-dashed border-black/20 rounded-xl">
                            <p>
                                Por haber aprobado el curso de capacitación <span className="font-black">TEÓRICO Y PRÁCTICO</span>, para optar por la licencia de
                                conducir tipo <span className="font-black">{getLicenseTypeText(certificate.licenseType)}</span> con una duración de <span className="font-black">80</span> horas, en cumplimiento de la Ley 146 del 15 de Abril de 2020, acápite a.
                            </p>
                        </div>

                        <div className="text-[6pt] mx-auto mt-6 max-w-xl font-bold opacity-80">
                            <p>
                                Reconocida por la Autoridad del Tránsito y Transporte Terrestre, Resuelto N°380 (04 de diciembre de 2000) Resolución AL-325
                            </p>
                        </div>
                        
                        <div className="text-center mt-4 font-bold text-[5.25pt] italic">
                            <p>***Dado en la república de Panamá, a los {formattedDay} días del mes de {formattedMonth} de {formattedYear}***</p>
                        </div>
                    </main>
                    
                    <footer className="w-full flex justify-end pt-1 pr-8 pb-1">
                        <div className="text-center w-56">
                            <div className="w-full border-t border-black mb-1"></div>
                            <p className="text-[7pt] italic font-bold">Lic. Ayax Ortega</p>
                            <p className="text-[5.6pt] uppercase font-black tracking-widest opacity-60">Representante Legal</p>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}

function CertificateBackAmpliacion({ certificate }: { certificate: Certificate }) {
    const details = certificate.contract?.ampliacionesDetails;
    const issueDate = toDate(certificate.issueDate);
    const expiryDate = !isNaN(issueDate.getTime()) ? addDays(issueDate, 365) : null;
    const formattedExpiryDate = expiryDate ? format(expiryDate, 'dd-MM-yyyy') : '00-00-0000';
    
    return (
        <div className="w-full min-h-screen flex items-center justify-center bg-white print:block print:h-auto">
            <div className="w-[10.5in] h-[8in] p-12 pl-4 pr-24 bg-white text-black font-sans text-[10pt] flex flex-col justify-start mx-auto print:m-0 flex items-center justify-center">
                <div className="space-y-8 pt-8 w-full">
                    <p className="flex gap-4">Yo, <span className="font-black flex-1 uppercase">{certificate.clientName}</span></p>
                    <p>Número de Documento ({certificate.idType || 'C.I.P.'}): <span className="font-black">{certificate.cip}</span></p>
                    <p className="flex gap-4">Resido en: <span className="font-black flex-1 uppercase">{details?.studentAddress || ''}</span></p>
                    <p>
                        Teléfono residencial: <span className="font-black">{details?.studentPhone1 || ''}</span> &nbsp; &nbsp; 
                        Celular: <span className="font-black">{details?.studentPhone2 || ''}</span>
                    </p>
                    <p><span className="font-bold uppercase tracking-widest text-[12pt]">TIPO DE LICENCIAS:</span> <span className="font-black">{certificate.licenseType}</span></p>
                    <p>Este certificado tiene validez hasta el <span className="font-black">{formattedExpiryDate}</span></p>
                    
                    <div className="pt-8 space-y-8 mt-12">
                        <div className="flex gap-x-12">
                            <div className="flex flex-col gap-1 flex-1">
                                <span className="text-[5.6pt] font-black uppercase text-slate-400">Primer Nombre</span>
                                <span className="font-black text-[12pt]">{certificate.firstName?.toUpperCase() || ''}</span>
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                                <span className="text-[5.6pt] font-black uppercase text-slate-400">Segundo Nombre</span>
                                <span className="font-black text-[12pt]">{certificate.middleName?.toUpperCase() || ''}</span>
                            </div>
                        </div>
                        <div className="flex gap-x-12">
                            <div className="flex flex-col gap-1 flex-1">
                                <span className="text-[5.6pt] font-black uppercase text-slate-400">Primer Apellido</span>
                                <span className="font-black text-[12pt]">{certificate.lastName?.toUpperCase() || ''}</span>
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                                <span className="text-[5.6pt] font-black uppercase text-slate-400">Segundo Apellido</span>
                                <span className="font-black text-[12pt]">{certificate.secondLastName?.toUpperCase() || ''}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AmpliacionCertificateTemplate({ certificate }: { certificate: Certificate | null }) {
  if (!certificate) return null;
  return (
    <div className="bg-white min-h-screen print:p-0 print:m-0">
      <CertificateFrontAmpliacion certificate={certificate} />
      <CertificateBackAmpliacion certificate={certificate} />
    </div>
  );
}
