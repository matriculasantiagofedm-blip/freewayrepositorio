'use client';
import type { Certificate } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toDate } from '@/lib/utils';

function CertificateFront({ certificate }: { certificate: Certificate }) {
    const issueDate = toDate(certificate.issueDate);
    const formattedDay = !isNaN(issueDate.getTime()) ? format(issueDate, 'dd', { locale: es }) : '';
    const formattedMonth = !isNaN(issueDate.getTime()) ? format(issueDate, 'MMMM', { locale: es }) : '';
    const formattedYear = !isNaN(issueDate.getTime()) ? format(issueDate, 'yyyy', { locale: es }) : '';
    
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
        <div className="w-[11in] h-[8.5in] p-8 bg-white text-black font-serif mx-auto">
            <div className="w-full h-full border-2 border-black flex flex-col p-8 relative">
                {/* Barras decorativas amarillas y negras en la esquina superior izquierda */}
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
                        <h1 className="text-6xl font-extrabold tracking-widest text-black">FREEWAY</h1>
                        <p className="text-2xl tracking-[0.4em] font-semibold">ESCUELA DE MANEJO</p>
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
                            conducir tipo <span className="font-bold">{getLicenseTypeText(certificate.licenseType)}</span> con una duración de <span className="font-bold underline">{getCourseHours(certificate.courseName)}</span> horas, en cumplimiento del Decreto Ejecutivo No.640 del
                            27 de Diciembre de 2006, en su artículo 113, acápite a.
                        </p>
                    </div>

                    <div className="text-sm mx-auto mt-4 max-w-2xl text-gray-600 italic">
                        <p>
                            Reconocida por la Autoridad del Tránsito y Transporte Terrestre, Resuelto N°380 (04 de diciembre de 2000) Resolución AL-325
                        </p>
                    </div>
                    <div className="text-center mt-8 font-bold text-lg">
                        <p>***Dado en la república de Panamá, a los {formattedDay} días del mes de {formattedMonth} de {formattedYear}***</p>
                    </div>
                </main>
                
                <footer className="w-full flex-shrink-0 pt-12 pb-4">
                    <div className="flex justify-center">
                        <div className="text-center w-80">
                            <div className="border-t-2 border-black pt-2">
                                <p className="font-bold uppercase">CEO—Representante Legal</p>
                                <p className='font-semibold text-xl'>Lic. Ayax Ortega</p>
                            </div>
                        </div>
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
    const issueDate = toDate(certificate.issueDate);
    const validityDate = !isNaN(issueDate.getTime()) ? new Date(issueDate.getTime() + (364 * 24 * 60 * 60 * 1000)) : null;
    
    return (
        <div className="w-[11in] h-[8.5in] p-16 bg-white flex flex-col text-black font-serif justify-start break-before-page mx-auto border border-gray-200">
            <div className="space-y-8 flex-grow flex flex-col justify-start text-xl pt-16 px-16 leading-loose">
                <h2 className="text-3xl font-bold border-b-2 border-black pb-4 mb-8">DATOS DEL ESTUDIANTE</h2>
                
                <p>Yo, <span className="font-bold border-b border-black px-2">{certificate.clientName.toUpperCase()}</span></p>
                
                <p>Número de Documento: <span className="font-bold border-b border-black px-2">{certificate.cip}</span></p>
                
                <p>Hago constar que resido en: <span className="font-bold border-b border-black px-2">{details?.studentAddress || 'La Chorrera, Panamá'}</span></p>
                
                <p>
                    con teléfono residencial: <span className="font-bold border-b border-black px-2">{details?.studentPhone1 || 'N/A'}</span> 
                    y teléfono celular: <span className="font-bold border-b border-black px-2">{details?.studentPhone2 || 'N/A'}</span>
                </p>
                
                <p className="font-bold pt-4 uppercase">TIPO DE LICENCIAS SOLICITADAS: <span className="border-b-2 border-black px-4">{certificate.licenseType}</span></p>
                
                {validityDate && (
                    <div className="mt-12 p-6 border-2 border-dashed border-black bg-gray-50">
                        <p className="text-center font-bold">
                            ESTE CERTIFICADO TIENE UNA VALIDEZ DE 364 DÍAS A PARTIR DEL: 
                            <br />
                            <span className="text-3xl mt-2 block underline">{format(issueDate, 'dd-MM-yyyy')}</span>
                        </p>
                    </div>
                )}
            </div>
            
            <div className="mt-auto text-center text-sm text-gray-400">
                <p>FREEWAY ESCUELA DE MANEJO S.A. - RUC 155628022-2-2016 DV 2</p>
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
    <div className="bg-gray-100 min-h-screen py-8 print:p-0 print:bg-white">
      <CertificateFront certificate={certificate} />
      <div className="h-16 print:hidden"></div>
      <CertificateBack certificate={certificate} />
    </div>
  );
}