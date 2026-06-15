'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { Certificate, Contract } from '@/lib/types';
import { CertificateTemplate } from '@/components/certificate-template';
import { AmpliacionCertificateTemplate } from '@/components/ampliacion-certificate-template';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useDb, useFirebase } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { Timestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, AlertCircle } from 'lucide-react';

/**
 * PÁGINA DE IMPRESIÓN RE-OPTIMIZADA PARA EVITAR CRASHES EN ANDROID
 */

function CertificatePrintContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const db = useDb();
  const { auth } = useFirebase();
  const [isReady, setIsReady] = useState(false);

  const contractId = Array.isArray(id) ? id[0] : id;
  const isManual = contractId === 'manual';

  const contractRef = useMemoDoc(() => {
    if (!db || !contractId || isManual) return null;
    return doc(db, 'contracts', contractId);
  }, [db, contractId, isManual]);

  const { data: contract, isLoading: isContractLoading } = useDoc<Contract>(contractRef);

  const [certificate, setCertificate] = useState<Certificate | null>(null);

  useEffect(() => {
    if (auth && !auth.currentUser) {
      signInAnonymously(auth).catch(console.error);
    }
  }, [auth]);

  useEffect(() => {
    if (isManual || (contract && !isContractLoading)) {
      const folio = searchParams.get('folio');
      const clientName = searchParams.get('clientName');
      const cip = searchParams.get('cip');
      const idType = searchParams.get('idType') || 'C.I.P.';
      const licenseType = searchParams.get('licenseType');
      const courseName = searchParams.get('courseName');
      const issueDateStr = searchParams.get('issueDate');
      const firstName = searchParams.get('firstName');
      const middleName = searchParams.get('middleName');
      const lastName = searchParams.get('lastName');
      const secondLastName = searchParams.get('secondLastName');
      const marriedLastName = searchParams.get('marriedLastName');
      const address = searchParams.get('address');
      const phone1 = searchParams.get('phone1');
      const phone2 = searchParams.get('phone2');
      const manualType = searchParams.get('manualType');
      
      if (!folio || !clientName || !cip || !licenseType || !courseName || !issueDateStr) return;

      // Siempre se priorizan los datos del formulario (address, phone1, phone2)
      // sobre lo que haya en Firestore. Esto permite certificados de actualización
      // con datos editados manualmente aunque el contrato original ya exista.
      const baseContract = contract || {
          id: 'manual',
          clientId: 'manual',
          userId: 'manual',
          type: manualType === 'ampliaciones' ? 'Ampliaciones' : 'Manual',
          clientName,
          clientEmail: '-',
      };

      const effectiveContract: any = {
          ...baseContract,
          ampliacionesDetails: {
              ...(baseContract as any).ampliacionesDetails,
              studentAddress: address || (baseContract as any).ampliacionesDetails?.studentAddress || '',
              studentPhone1: phone1 || (baseContract as any).ampliacionesDetails?.studentPhone1 || '',
              studentPhone2: phone2 || (baseContract as any).ampliacionesDetails?.studentPhone2 || '',
          },
          autoMotoDetails: {
              ...(baseContract as any).autoMotoDetails,
              studentAddress: address || (baseContract as any).autoMotoDetails?.studentAddress || '',
              studentPhone1: phone1 || (baseContract as any).autoMotoDetails?.studentPhone1 || '',
              studentPhone2: phone2 || (baseContract as any).autoMotoDetails?.studentPhone2 || '',
          },
          deluxeDetails: {
              ...(baseContract as any).deluxeDetails,
              studentAddress: address || (baseContract as any).deluxeDetails?.studentAddress || '',
              studentPhone1: phone1 || (baseContract as any).deluxeDetails?.studentPhone1 || '',
              studentPhone2: phone2 || (baseContract as any).deluxeDetails?.studentPhone2 || '',
          },
      };

      const cachedStr = typeof window !== 'undefined' ? localStorage.getItem(`cert_photos_${contractId}`) : null;
      let cachedPhotos = { photoDataUri: '', idCardDataUri: '', licenseDataUri: '' };
      if (cachedStr) {
          try { cachedPhotos = JSON.parse(cachedStr); } catch(e){}
      }

      const certificateData: Certificate = {
        id: contractId,
        contractId: contractId,
        clientId: effectiveContract.clientId,
        userId: effectiveContract.userId,
        folio: folio,
        clientName: clientName,
        courseName: courseName,
        issueDate: Timestamp.fromDate(new Date(issueDateStr)),
        cip: cip,
        idType: idType,
        licenseType: licenseType,
        contract: effectiveContract,
        firstName: firstName || undefined,
        middleName: middleName || undefined,
        lastName: lastName || undefined,
        secondLastName: secondLastName || undefined,
        marriedLastName: marriedLastName || undefined,
        photoDataUri: effectiveContract.photoDataUri || (effectiveContract.ampliacionesDetails as any)?.photoDataUri || (effectiveContract.autoMotoDetails as any)?.photoDataUri || cachedPhotos.photoDataUri,
        idCardDataUri: effectiveContract.idCardDataUri || (effectiveContract.ampliacionesDetails as any)?.idCardDataUri || (effectiveContract.autoMotoDetails as any)?.idCardDataUri || cachedPhotos.idCardDataUri,
        licenseDataUri: effectiveContract.licenseDataUri || (effectiveContract.ampliacionesDetails as any)?.licenseDataUri || (effectiveContract.autoMotoDetails as any)?.licenseDataUri || cachedPhotos.licenseDataUri,
      };
      setCertificate(certificateData);

      const timer = setTimeout(() => {
        setIsReady(true);
      }, 8000);
      
      return () => clearTimeout(timer);
    }
  }, [contract, isContractLoading, searchParams, isManual, contractId]);

  const shouldUseAmpliacionTemplate = useMemo(() => {
    if (!certificate || !certificate.licenseType) return false;
    const type = certificate.licenseType.trim();
    const manualType = searchParams.get('manualType');
    if (isManual && manualType === 'primera-vez') return false;
    if (['E1', 'E2', 'E3'].some(l => type.includes(l))) return true;
    if (certificate.contract?.type === 'Ampliaciones' || (isManual && manualType === 'ampliaciones')) {
        if (['B', 'C', 'D', 'F'].includes(type)) return false;
        if (type === 'A') return true;
        return true;
    }
    return false;
  }, [certificate, isManual, searchParams]);

  const handleManualPrint = () => {
    // Android Chrome no soporta CSS Named Pages (@page certificate-landscape).
    // Inyectamos el @page landscape directamente en el <head> antes de imprimir.
    const styleId = 'cert-print-landscape-override';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      @page {
        size: 11in 8.5in landscape !important;
        margin: 0 !important;
      }
      @media print {
        img { height: auto; max-width: 100%; }
      }
    `;

    // Pequeño delay para que el browser renderice antes de abrir el diálogo
    setTimeout(() => {
      window.print();
      // Limpiar el estilo inyectado después de imprimir
      setTimeout(() => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      }, 2000);
    }, 150);
  };

  if (!isManual && isContractLoading) {
    return <div className="flex items-center justify-center h-screen bg-white font-black text-blue-600 animate-pulse uppercase tracking-widest">Preparando Gráficos...</div>;
  }

  return (
    <div className="bg-white">

        <div className="print-ui-element p-6 bg-white border-b flex flex-col gap-4 shadow-sm sticky top-0 z-[200]">
            <div className="flex items-center gap-2 text-blue-800 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <AlertCircle className="h-5 w-5" />
                <p className="text-xs font-bold uppercase">Aviso: Si el error persiste, reinicia la tablet y la impresora.</p>
            </div>
            {!isReady ? (
                <div className="bg-slate-100 text-slate-500 p-6 rounded-xl text-center font-black uppercase text-lg flex items-center justify-center gap-3 border-2 border-slate-200">
                    <Loader2 className="animate-spin h-6 w-6" />
                    Optimizando para Tablet (8s)...
                </div>
            ) : (
                <Button 
                    onClick={handleManualPrint} 
                    className="h-24 text-2xl font-black bg-blue-600 hover:bg-blue-700 shadow-xl uppercase tracking-widest border-4 border-blue-400"
                >
                    <Printer className="mr-4 h-8 w-8" />
                    IMPRIMIR EN CANON
                </Button>
            )}
        </div>

        <div className="certificate-pages-wrapper">
            {shouldUseAmpliacionTemplate ? (
              <AmpliacionCertificateTemplate certificate={certificate} />
            ) : (
              <CertificateTemplate certificate={certificate} />
            )}
        </div>
    </div>
  );
}

export default function CertificatePrintIdPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center font-bold">CARGANDO...</div>}>
      <CertificatePrintContent />
    </Suspense>
  );
}
