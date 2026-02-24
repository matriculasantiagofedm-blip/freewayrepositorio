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

/**
 * Motor de impresión de certificados optimizado para tablets.
 */
function CertificatePrintContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const db = useDb();
  const { auth } = useFirebase();

  const contractId = Array.isArray(id) ? id[0] : id;
  const isManual = contractId === 'manual';

  const contractRef = useMemoDoc(() => {
    if (!db || !contractId || isManual) return null;
    return doc(db, 'contracts', contractId);
  }, [db, contractId, isManual]);

  const { data: contract, isLoading: isContractLoading, error } = useDoc<Contract>(contractRef);

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

      const effectiveContract: any = contract || {
          id: 'manual',
          clientId: 'manual',
          userId: 'manual',
          type: manualType === 'ampliaciones' ? 'Ampliaciones' : 'Manual',
          clientName,
          clientEmail: '-',
          ampliacionesDetails: {
              studentAddress: address || '',
              studentPhone1: phone1 || '',
              studentPhone2: phone2 || '',
          },
          autoMotoDetails: {
              studentAddress: address || '',
              studentPhone1: phone1 || '',
              studentPhone2: phone2 || '',
          }
      };

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
      };
      setCertificate(certificateData);

      // Incrementamos a 2500ms para dar tiempo a la tablet de procesar los gráficos pesados
      const timer = setTimeout(() => {
        window.print();
      }, 2500);
      
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

  if (!isManual && isContractLoading) {
    return <div className="flex items-center justify-center h-screen bg-white"><p className="text-xl font-semibold animate-pulse">Generando documento...</p></div>;
  }

  if (error && !isManual) return (
    <div className="p-8 text-center bg-white min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-destructive font-bold text-3xl mb-4">Error de Acceso</h1>
        <p className="text-muted-foreground">{error.message}</p>
    </div>
  );

  return (
    <div className="print:p-0 print:m-0 print:bg-white bg-gray-100 min-h-screen">
        <style jsx global>{`
          @media print {
            @page { size: letter landscape; margin: 0; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: white !important; }
            .loading-banner { display: none !important; }
          }
        `}</style>
        <div className="loading-banner bg-amber-500 text-white p-2 text-center text-xs font-bold uppercase tracking-widest sticky top-0 z-[100]">
            Procesando gráficos... No cierre esta pestaña hasta que aparezca el diálogo de impresión.
        </div>
        {shouldUseAmpliacionTemplate ? (
          <AmpliacionCertificateTemplate certificate={certificate} />
        ) : (
          <CertificateTemplate certificate={certificate} />
        )}
    </div>
  );
}

export default function CertificatePrintIdPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-white">Iniciando motor de impresión...</div>}>
      <CertificatePrintContent />
    </Suspense>
  );
}
