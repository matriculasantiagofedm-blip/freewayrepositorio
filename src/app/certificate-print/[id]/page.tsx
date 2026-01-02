'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { doc, Timestamp } from 'firebase/firestore';
import type { Contract, Certificate } from '@/lib/types';
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
  const customFolio = searchParams.get('folio');

  const contractRef = useMemoDoc(() => {
    if (!db || !contractId) return null;
    return doc(db, `contracts`, contractId);
  }, [db, contractId]);

  const { data: contract, isLoading: isContractLoading, error } = useDoc<Contract>(contractRef);
  const [certificate, setCertificate] = useState<Certificate | null>(null);

  useEffect(() => {
    if (contract && customFolio) {
      
      const details = contract.autoMotoDetails || contract.deluxeDetails;

      const certificateData: Certificate = {
        id: contract.id,
        contractId: contract.id,
        clientId: contract.clientId,
        userId: contract.userId,
        folio: customFolio, // Usar el folio de la URL
        clientName: `${contract.firstName || ''} ${contract.middleName || ''} ${contract.lastName || ''} ${contract.secondLastName || ''}`.trim() || contract.clientName,
        courseName: contract.title,
        issueDate: Timestamp.now(), // Siempre usar la fecha actual para la impresión
        cip: details?.studentIdNumber || '',
        licenseType: details?.licenseCategory || '',
        contract: contract, // Adjuntar el contrato completo
      };
      setCertificate(certificateData);

      const style = document.createElement('style');
      style.id = 'print-styles';
      style.innerHTML = `@page { size: letter landscape; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;
      document.head.appendChild(style);

      // Activar automáticamente el diálogo de impresión
      const timer = setTimeout(() => {
        window.print();
      }, 500); // Retraso para permitir que el contenido se renderice
      
      return () => {
        clearTimeout(timer);
        const styleTag = document.getElementById('print-styles');
        if (styleTag) {
          document.head.removeChild(styleTag);
        }
      };
    }
  }, [contract, customFolio]);

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

  // La página solo contiene la plantilla del certificado para una impresión limpia.
  return (
    <div className="print:p-0 print:m-0 print:bg-white bg-gray-100">
        <CertificateTemplate certificate={certificate} />
    </div>
  );
}
