'use client';
import type { Certificate } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toDate } from '@/lib/utils';

const getHighestLicenseType = (licenseTypes: string = ''): string => {
    if (!licenseTypes) return 'E1';
    const letters = licenseTypes.split(',').map(l => l.trim()).filter(l => l).sort();
    return letters[letters.length - 1] || 'E1';
};

const getLicenseTypeText = (licenseType?: string) => {
    if (!licenseType) return 'E1, E2';
    return licenseType.split(',').map(l => l.trim()).join(', ');
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
    const formattedDay = !isNaN(issueDate.getTime()) ? format(issueDate, 'dd', { locale: es }) : '';
    const formattedMonth = !isNaN(issueDate.getTime()) ? format(issueDate, 'MMMM', { locale: es }) : '';
    const formattedYear = !isNaN(issueDate.getTime()) ? format(issueDate, 'yyyy', { locale: es }) : '';
    const { num: folioNum, year: folioYear } = getFolioParts(certificate.folio);
    
    return (
        <div className="w-[11in] h-[8.5in] p-8 bg-white text-black font-serif mx-auto">
            <div className="w-full h-full border-2 border-black flex flex-col p-8 relative">
                 {/* Barras decorativas Amarillas/Negras */}
                <div className="absolute top-0 left-0 h-6 w-64 overflow-hidden">
                    <div className="flex h-full w-full">
                        <div className="w-1/4 h-full bg-yellow-400"></div>
                        <div className="w-1/4 h-full bg-black"></div>
                        <div className="w-1/4 h-full bg-yellow-400"></div>
                        <div className="w-1/4 h-full bg-black"></div>
                    </div>
                </div>

                <header className="flex w-full flex-col items-center justify-center mb-4 relative pt-12">
                    <div className="text-center w-full">
                        <h1 className="text-6xl font-extrabold tracking-widest">FREEWAY</h1>
                        <p className="text-2xl tracking-[0.3em] font-semibold">ESCUELA DE MANEJO</p>
                    </div>
                    <div className="absolute top-0 right-0 text-center border-2 border-black p-2 min-w-[100px]">
                         <p className="text-5xl font-bold">{getHighestLicenseType(certificate.licenseType)}</p>
                         <p className="text-xs mt-1">{folioNum} / {folioYear}</p>
                    </div>
                </header>

                <main className="flex-grow flex flex-col justify-center text-center px-12">
                    <p className="text-xl italic mb-4">Casa Matriz Chorrera</p>
                    <p className="text-lg uppercase tracking-widest mb-6">Otorga el presente Certificado a:</p>

                    <div className="my-8">
                        <p className="font-bold text-5xl tracking-tight border-b-2 border-black inline-block px-8 pb-2">
                            {certificate.clientName.toUpperCase()}
                        </p>
                        <p className="font-bold text-2xl mt-4 tracking-widest">C.I.P. {certificate.cip}</p>
                    </div>

                    <div className="text-lg leading-relaxed max-w-4xl mx-auto border-y border-dashed border-gray-400 py-6 my-6">
                        <p>
                            Por haber aprobado el curso de capacitación <span className="font-bold underline">TEÓRICO Y PRÁCTICO</span>, para optar por la licencia de
                            conducir tipo <span className="font-bold">{getLicenseTypeText(certificate.licenseType)}</span> con una duración de <span className="font-bold">80</span> horas, en cumplimiento de la Ley 146 del 15 de Abril
                            de 2020, acápite a.
                        </p>
                    </div>

                    <div className="text-sm mx-auto mt-4 max-w-2xl text-gray-600 italic">
                        <p>
                            Reconocida por la Autoridad del Tránsito y Transporte Terrestre, Resuelto N°380 (04 de diciembre de 2000) Resolución AL-325
                        </p>
                    </div>
                    <div className="text-center mt-8 font-bold text-lg">
                        <p>***Dado en la república de Panamá, a los {formattedDay} dias del mes de {formattedMonth} de {formattedYear}***</p>
                    </div>
                </main>
                
                <footer className="w-full flex-shrink-0 pt-12 pb-4">
                    <div className="flex justify-center">
                        <div className="text-center w-80">
                            <div className="border-t-2 border-black pt-2">
                                <p className="font-bold uppercase">CEO—Representante Legal</p>
                                <p className="font-semibold text-xl">Lic. Ayax Ortega</p>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}


function CertificateBackAmpliacion({ certificate }: { certificate: Certificate }) {
    const issueDate = toDate(certificate.issueDate);
    const validityDate = !isNaN(issueDate.getTime()) ? new Date(issueDate.getTime() + (364 * 24 * 60 * 60 * 1000)) : null;
    const details = certificate.contract?.ampliacionesDetails;

    return (
        <div className="w-[11in] h-[8.5in] p-16 bg-white flex flex-col text-black font-serif justify-start break-before-page mx-auto border border-gray-200">
            <div className="space-y-8 flex-grow flex flex-col justify-start text-xl pt-16 px-16 leading-loose">
                <h2 className="text-3xl font-bold border-b-2 border-black pb-4 mb-8">CERTIFICACIÓN DE AMPLIACIÓN</h2>
                
                <p>Yo, <span className="font-bold border-b border-black px-2">{certificate.clientName.toUpperCase()}</span></p>
                <p>Número de Documento: <span className="font-bold border-b border-black px-2">{certificate.cip}</span></p>
                <p>Hago constar que resido en: <span className="font-bold border-b border-black px-2">{details?.studentAddress || 'No especificada'}</span></p>
                <p>
                    con teléfono residencial: <span className="font-bold border-b border-black px-2">{details?.studentPhone1 || 'N/A'}</span>,
                    y teléfono celular: <span className="font-bold border-b border-black px-2">{details?.studentPhone2 || 'N/A'}</span>
                </p>
                <p className="font-bold pt-4 uppercase">AMPLIACIÓN A LICENCIAS: <span className="border-b-2 border-black px-4">{certificate.licenseType}</span></p>
                
                {validityDate && (
                    <div className="mt-12 p-6 border-2 border-dashed border-black bg-gray-50 text-center">
                        <p className="font-bold">
                            ESTE CERTIFICADO TIENE VALIDEZ DE 364 DÍAS A PARTIR DE:
                            <br />
                            <span className="text-3xl mt-2 block underline">{format(issueDate, 'dd-MM-yyyy')}</span>
                        </p>
                    </div>
                )}
                
                <div className='pt-8 grid grid-cols-2 gap-8 text-lg'>
                    <div className="space-y-2">
                        <p>Primer Nombre: <span className="font-semibold">{certificate.firstName || ''}</span></p>
                        <p>Segundo Nombre: <span className="font-semibold">{certificate.middleName || ''}</span></p>
                    </div>
                    <div className="space-y-2">
                        <p>Primer Apellido: <span className="font-semibold">{certificate.lastName || ''}</span></p>
                        <p>Segundo Apellido: <span className="font-semibold">{certificate.secondLastName || ''}</span></p>
                    </div>
                </div>
            </div>
            
            <div className="mt-auto text-center text-sm text-gray-400">
                <p>FREEWAY ESCUELA DE MANEJO S.A. - RUC 155628022-2-2016 DV 2</p>
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
    <div className="bg-gray-100 min-h-screen py-8 print:p-0 print:bg-white">
      <CertificateFrontAmpliacion certificate={certificate} />
      <div className="h-16 print:hidden"></div>
      <CertificateBackAmpliacion certificate={certificate} />
    </div>
  );
}