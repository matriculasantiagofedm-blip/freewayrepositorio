'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { doc, Timestamp } from 'firebase/firestore';
import type { Certificate, Contract } from '@/lib/types';
import { CertificateTemplate } from '@/components/certificate-template';
import { useEffect, useState } from 'react';
import { useDb } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { useCurrentRole } from '@/hooks/use-current-role';

export default function CertificatePrintIdPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const db = useDb();
  const { role: currentUserRole, isLoading: isRoleLoading } = useCurrentRole();

  const contractId = Array.isArray(id) ? id[0] : id;

  // We still need the original contract for the back of the certificate.
  const contractRef = useMemoDoc(() => {
    if (!db || !contractId) return null;
    return doc(db, 'contracts', contractId);
  }, [db, contractId]);

  const { data: contract, isLoading: isContractLoading, error } = useDoc<Contract>(contractRef);

  const [certificate, setCertificate] = useState<Certificate | null>(null);

  useEffect(() => {
    // Data for the certificate now comes primarily from URL parameters to reflect edits.
    // The contract from Firestore is used for data not passed in URL, like the back of the certificate.
    if (contract && !isContractLoading) {
      const folio = searchParams.get('folio');
      const clientName = searchParams.get('clientName');
      const cip = searchParams.get('cip');
      const licenseType = searchParams.get('licenseType');
      const courseName = searchParams.get('courseName');
      const issueDateStr = searchParams.get('issueDate');
      
      if (!folio || !clientName || !cip || !licenseType || !courseName || !issueDateStr) {
          return; // Wait for all params
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
        contract: contract, // The original contract is still needed for the back of the certificate
      };
      setCertificate(certificateData);

      // Automatically trigger the print dialog
      const timer = setTimeout(() => {
        window.print();
      }, 500); // Delay to allow content to render
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [contract, isContractLoading, searchParams]);

  if (isContractLoading || isRoleLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Cargando certificado para imprimir...</p>
      </div>
    );
  }

  if (error) {
    return (
        <div className="flex items-center justify-center h-screen bg-muted">
            <div className="p-8 bg-background rounded-lg shadow-md text-center">
                <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>
                <p className="text-muted-foreground">{error.message}</p>
            </div>
        </div>
    );
  }

  if (currentUserRole === 'Ventas') {
    return (
        <div className="flex items-center justify-center h-screen bg-muted">
            <div className="p-8 bg-background rounded-lg shadow-md text-center">
                <h1 className="text-2xl font-bold text-destructive mb-4">Acceso Denegado</h1>
                <p className="text-muted-foreground">No tienes permiso para imprimir certificados.</p>
            </div>
        </div>
    );
  }
  
  if (!contract && !isContractLoading) {
      return (
        <div className="flex items-center justify-center h-screen bg-muted">
            <div className="p-8 bg-background rounded-lg shadow-md text-center">
                <h1 className="text-2xl font-bold text-destructive mb-4">Contrato no encontrado</h1>
                <p className="text-muted-foreground">No se pudo encontrar el contrato para generar el certificado.</p>
            </div>
        </div>
      )
  }

  // The page only contains the certificate template for a clean print.
  return (
    <div className="print:p-0 print:m-0 print:bg-white bg-gray-100">
        <style jsx global>{`
          @media print {
            @page { 
                size: letter landscape;
                margin: 0;
            }
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
          }
        `}</style>
        <CertificateTemplate certificate={certificate} />
    </div>
  );
}
