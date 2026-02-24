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
import { Printer } from 'lucide-react';

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

      const timer = setTimeout(() => {
        setIsReady(true);
        try {
            window.print();
        } catch (e) {
            console.error("Print error", e);
        }
      }, 4000); // 4 segundos para certificados pesados en tablet
      
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
    return <div className="flex items-center justify-center h-screen bg-white font-black text-blue-600 animate-pulse uppercase tracking-widest">Generando Gráficos...</div>;
  }

  return (
    <div className="print:p-0 print:m-0 print:bg-white bg-slate-100 min-h-screen">
        <style jsx global>{`
          @media print {
            @page { size: letter landscape; margin: 0; }
            body { background-color: white !important; }
            .print-ui-element { display: none !important; }
          }
        `}</style>

        <div className="print-ui-element p-4 bg-white border-b sticky top-0 z-[200] flex flex-col gap-3">
            {!isReady ? (
                <div className="bg-blue-600 text-white p-4 rounded-xl text-center font-black uppercase text-sm animate-pulse shadow-lg">
                    Procesando Certificado... Espere el diálogo de la tablet.
                </div>
            ) : (
                <Button 
                    onClick={() => window.print()} 
                    className="h-16 text-lg font-black bg-green-600 hover:bg-green-700 shadow-xl uppercase tracking-wider"
                >
                    <Printer className="mr-3 h-6 w-6" />
                    PULSAR AQUÍ PARA IMPRIMIR CERTIFICADO
                </Button>
            )}
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
    <Suspense fallback={<div className="flex h-screen items-center justify-center font-bold">MOTOR DE CERTIFICADOS...</div>}>
      <CertificatePrintContent />
    </Suspense>
  );
}
