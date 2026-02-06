'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { doc, Timestamp } from 'firebase/firestore';
import type { Certificate, Contract } from '@/lib/types';
import { CertificateTemplate } from '@/components/certificate-template';
import { AmpliacionCertificateTemplate } from '@/components/ampliacion-certificate-template';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useDb } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { useCurrentRole } from '@/hooks/use-current-role';

function CertificatePrintContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const db = useDb();
  const { role: currentUserRole, isLoading: isRoleLoading } = useCurrentRole();

  const contractId = Array.isArray(id) ? id[0] : id;

  const contractRef = useMemoDoc(() => {
    if (!db || !contractId) return null;
    return doc(db, 'contracts', contractId);
  }, [db, contractId]);

  const { data: contract, isLoading: isContractLoading, error } = useDoc<Contract>(contractRef);

  const [certificate, setCertificate] = useState<Certificate | null>(null);

  useEffect(() => {
    if (contract && !isContractLoading) {
      const folio = searchParams.get('folio');
      const clientName = searchParams.get('clientName');
      const cip = searchParams.get('cip');
      const licenseType = searchParams.get('licenseType');
      const courseName = searchParams.get('courseName');
      const issueDateStr = searchParams.get('issueDate');
      const firstName = searchParams.get('firstName');
      const middleName = searchParams.get('middleName');
      const lastName = searchParams.get('lastName');
      const secondLastName = searchParams.get('secondLastName');
      
      if (!folio || !clientName || !cip || !licenseType || !courseName || !issueDateStr) {
          return;
      }

      const certificateData: Certificate = {
        id: contract.id,
        contractId: contract.id,
        clientId: contract.clientId,
        userId: contract.userId,
        folio: folio,
        clientName: clientName,
        courseName: courseName,
        issueDate: Timestamp.fromDate(new Date(issueDateStr)),
        cip: cip,
        licenseType: licenseType,
        contract: contract,
        firstName: firstName || undefined,
        middleName: middleName || undefined,
        lastName: lastName || undefined,
        secondLastName: secondLastName || undefined,
      };
      setCertificate(certificateData);

      const timer = setTimeout(() => {
        window.print();
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [contract, isContractLoading, searchParams]);

  const shouldUseAmpliacionTemplate = useMemo(() => {
    if (!certificate || !certificate.contract) return false;
    if (certificate.contract.type === 'Ampliaciones') return true;
    return certificate.licenseType && ['E1', 'E2', 'E3'].some(l => certificate.licenseType.includes(l));
  }, [certificate]);

  if (isContractLoading || isRoleLoading) {
    return <div className="flex items-center justify-center h-screen bg-white"><p className="text-xl font-semibold text-primary animate-pulse">Cargando certificado desde la base de datos...</p></div>;
  }

  if (error) return (
    <div className="p-8 text-center bg-white min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-destructive font-bold text-3xl mb-4">Acceso Bloqueado</h1>
        <div className="bg-red-50 p-6 rounded-lg border border-red-200 max-w-2xl text-left">
            <p className="text-red-800 font-semibold mb-2">Error de Base de Datos:</p>
            <p className="text-red-600 font-mono text-sm break-all">{error.message}</p>
        </div>
        <p className="mt-6 text-muted-foreground">
            Se ha detectado un problema de permisos en Firestore. <br />
            Las reglas de seguridad han sido actualizadas. Por favor, refresca la página e inténtalo de nuevo.
        </p>
    </div>
  );

  if (!contract && !isContractLoading) return (
    <div className="p-8 text-center bg-white min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Certificado No Encontrado</h1>
        <p className="text-muted-foreground">El contrato con ID {contractId} no pudo ser localizado.</p>
    </div>
  );

  return (
    <div className="print:p-0 print:m-0 print:bg-white bg-gray-100 min-h-screen">
        <style jsx global>{`
          @media print {
            @page { size: letter landscape; margin: 0; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: white !important; }
            .print-hidden { display: none !important; }
          }
        `}</style>
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
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-white">Preparando motor de impresión...</div>}>
      <CertificatePrintContent />
    </Suspense>
  );
}