'use client';
import type { Certificate } from '@/lib/types';
import { format } from 'date-fns';
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
                
                {/* Franja Amarilla y Negra Superior Izquierda (Estilo Imagen) */}
                <div className="absolute top-[-5px] left-[-5px] w-64 h-6 z-10">
                    <div className="w-full h-full bg-yellow-400" style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #fbbf24, #fbbf24 10px, #000 10px, #000 20px)'
                    }}></div>
                </div>

                <header className="flex w-full flex-col items-center justify-center relative pt-4">
                    <h2 className="text-xl font-bold tracking-tight mb-2">FREEWAY ESCUELA DE MANEJO S.A.</h2>
                    
                    <div className="text-center w-full my-2">
                        <h1 className="text-7xl font-bold tracking-[0.2em] leading-none mb-1">FREEWAY</h1>
                        <p className="text-2xl tracking-[0.5em] font-semibold">ESCUELA DE MANEJO</p>
                    </div>

                    <p className="text-2xl italic mt-2">Casa Matriz Chorrera</p>

                    {/* Folio y Categoría Superior Derecha */}
                    <div className="absolute top-0 right-0 text-center">
                        <p className="text-5xl font-bold mb-1">{getHighestLicenseType(certificate.licenseType)}</p>
                        <p className="text-lg font-medium">{folioNum} / {folioYear}</p>
                    </div>
                </header>

                <main className="flex-grow flex flex-col items-center justify-center text-center px-12 mt-4">
                    <p className="text-xl uppercase tracking-widest mb-8">Otorga el presente Certificado a:</p>

                    <div className="mb-8 w-full">
                        <p className="font-bold text-5xl tracking-tight mb-4 uppercase">
                            {certificate.clientName}
                        </p>
                        <p className="font-bold text-3xl tracking-widest mt-2">C.I.P. &nbsp; {certificate.cip}</p>
                    </div>

                    <div className="text-xl leading-relaxed max-w-5xl mx-auto py-4">
                        <p>
                            Por haber aprobado el curso de capacitación <span className="font-bold underline">TEÓRICO Y PRÁCTICO</span>, para optar por la licencia de
                            conducir tipo <span className="font-bold underline">{getLicenseTypeText(certificate.licenseType)}</span> con una duración de <span className="font-bold underline">{getCourseHours(certificate.courseName)}</span> horas, en cumplimiento del Decreto Ejecutivo No. 640 del 27 de Diciembre de 2006, en su artículo 113, acápite a.
                        </p>
                    </div>

                    <div className="text-base mx-auto mt-6 max-w-3xl font-semibold">
                        <p>
                            Reconocida por la Autoridad del Tránsito y Transporte Terrestre, Resuelto N°380 (04 de diciembre de 2000) Resolución AL-325
                        </p>
                    </div>
                    
                    <div className="text-center mt-10 font-bold text-xl">
                        <p>***Dado en la república de Panamá, a los {formattedDay} días del mes de {formattedMonth} de {formattedYear}***</p>
                    </div>
                </main>
                
                <footer className="w-full flex-shrink-0 flex justify-end pb-4 pr-12">
                    <div className="text-center w-96 flex flex-col items-center">
                        <div className="w-full border-t border-black mb-2"></div>
                        <p className="text-lg italic font-medium leading-none">CEO—Representante Legal</p>
                        <p className='text-xl italic font-bold'>Lic. Ayax Ortega</p>
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
        <div className="w-[11in] h-[8.5in] p-16 bg-white flex flex-col text-black font-serif justify-start break-before-page mx-auto border border-gray-200 print:border-none">
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
