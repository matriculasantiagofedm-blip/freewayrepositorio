'use client';
import { useParams, useRouter } from 'next/navigation';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { ContractView } from '@/components/contract-view';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Award, Printer, ShieldX, Undo, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCurrentRole } from '@/hooks/use-current-role';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDb, useUser } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';

// Helper to get the next folio number
const getNextFolio = (lastFolio: string | null): string => {
    const year = new Date().getFullYear();
    if (!lastFolio || !lastFolio.includes('/')) {
        return `${year} / 0001`;
    }
    const parts = lastFolio.split('/');
    const lastNum = parseInt(parts[1], 10);
    const nextNum = lastNum + 1;
    const paddedNextNum = String(nextNum).padStart(4, '0');
    return `${year} / ${paddedNextNum}`;
};


export default function ContractDetailPage() {
  const { id } = useParams();
  const db = useDb();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { role } = useCurrentRole();

  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [certificateData, setCertificateData] = useState({
    folio: '',
    clientName: '',
    cip: '',
    licenseType: '',
    address: '',
    phone1: '',
    phone2: '',
    firstName: '',
    middleName: '',
    lastName: '',
    secondLastName: '',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [lastFolio, setLastFolio] = useState<string | null>(null);

  useEffect(() => {
    // This effect runs on the client side only
    setLastFolio(localStorage.getItem('lastCertificateFolio'));
  }, []);

  const contractId = Array.isArray(id) ? id[0] : id;

  const contractRef = useMemoDoc(() => {
    if (!db || !user || !contractId) return null;
    return doc(db, `contracts`, contractId);
  }, [db, user, contractId]);

  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);
  
  const canGenerateCertificate = contract && (['Curso Auto', 'Curso Moto', 'Curso Deluxe', 'Curso Mixto', 'Ampliaciones'].includes(contract.type));

  const handleOpenCertificateModal = () => {
    if (!contract) return;
    
    const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
    const suggestedFolio = getNextFolio(lastFolio);

    const nameParts = contract.clientName.split(' ').filter(p => p);
    let firstName = '', middleName = '', lastName = '', secondLastName = '';
    if (nameParts.length > 0) firstName = nameParts[0];
    if (nameParts.length === 2) lastName = nameParts[1];
    if (nameParts.length === 3) {
        middleName = nameParts[1];
        lastName = nameParts[2];
    }
    if (nameParts.length >= 4) {
        middleName = nameParts[1];
        lastName = nameParts[2];
        secondLastName = nameParts[3];
    }


    setCertificateData({
      folio: suggestedFolio,
      clientName: contract.clientName,
      cip: details?.studentIdNumber || '',
      licenseType: (details as any)?.licenseCategory || (contract.ampliacionesDetails?.selectedPlans?.map(p => p.name).join(', ') || ''),
      address: details?.studentAddress || '',
      phone1: details?.studentPhone1 || '',
      phone2: details?.studentPhone2 || '',
      firstName,
      middleName,
      lastName,
      secondLastName,
    });
    setIsCertificateModalOpen(true);
  };
  
  const handleCertDataChange = (field: keyof typeof certificateData, value: string) => {
    setCertificateData(prev => ({ ...prev, [field]: value }));
  };

  const handleProceedToPrint = async () => {
    if (!certificateData.folio || !db || !contractRef || !contract) {
        toast({
            variant: 'destructive',
            title: 'Datos Inválidos',
            description: 'No se puede imprimir sin un número de folio o datos de contrato válidos.',
        });
        return;
    }

    setIsGenerating(true);

    try {
        const updateData = {
            certificateGeneratedAt: serverTimestamp() as any,
            certificateFolio: certificateData.folio,
        };
        await updateDoc(contractRef, updateData);

        // Store the new folio in localStorage
        localStorage.setItem('lastCertificateFolio', certificateData.folio);
        setLastFolio(certificateData.folio);

        const queryParams = new URLSearchParams({
            folio: certificateData.folio,
            clientName: certificateData.clientName,
            cip: certificateData.cip,
            licenseType: certificateData.licenseType,
            courseName: contract.title || '',
            issueDate: new Date().toISOString(),
            firstName: certificateData.firstName,
            middleName: certificateData.middleName,
            lastName: certificateData.lastName,
            secondLastName: certificateData.secondLastName,
        });

        // Open print window
        const printUrl = `/certificate-print/${contractId}?${queryParams.toString()}`;
        window.open(printUrl, '_blank');
        setIsCertificateModalOpen(false);

    } catch (error) {
        console.error("Error updating certificate folio:", error);
        toast({
            variant: 'destructive',
            title: 'Error al Guardar',
            description: 'No se pudo guardar el folio del certificado. Por favor, revisa tus permisos e inténtalo de nuevo.',
        });
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handlePrintContract = () => {
    const printUrl = `/print-contract/${contractId}`;
    window.open(printUrl, '_blank');
  };

  const handleAnnulContract = async () => {
    if (!contractRef || !contract) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el contrato para anular.' });
      return;
    }
  
    setIsGenerating(true);
  
    try {
      // NON-DESTRUCTIVE: Only change the status
      const updateData = {
        status: 'expired' as const,
      };
  
      await updateDoc(contractRef, updateData);
  
      toast({
        title: 'Contrato Anulado',
        description: `El contrato con folio ${contract.folioNumber} ha sido marcado como anulado.`,
      });
  
      router.refresh();
  
    } catch (error) {
      console.error("Error al anular contrato:", error);
      toast({
        variant: 'destructive',
        title: 'Error al anular',
        description: 'No se pudo anular el contrato. Revisa los permisos o contacta al administrador.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReactivateContract = async () => {
    if (!contractRef || !contract) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el contrato para reactivar.' });
      return;
    }

    setIsGenerating(true);

    try {
      const updateData = {
        status: 'active' as const,
      };
      await updateDoc(contractRef, updateData);
      toast({
        title: 'Contrato Reactivado',
        description: `El contrato con folio ${contract.folioNumber} ha sido reactivado.`,
      });
      router.refresh();
    } catch (error) {
        console.error("Error al reactivar contrato:", error);
        toast({
            variant: 'destructive',
            title: 'Error al Reactivar',
            description: 'No se pudo reactivar el contrato. Revisa los permisos.',
        });
    } finally {
        setIsGenerating(false);
    }
  };


  return (
    <div className="flex flex-col gap-8 print-container">
        <div className="flex items-center justify-between print-hide">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Volver</span>
                </Link>
                </Button>
            </div>
            <div className="flex items-center gap-2">
              {canGenerateCertificate && role !== 'Ventas' && (
                <Button onClick={handleOpenCertificateModal}>
                  <Award className="mr-2 h-4 w-4" />
                  Generar Certificado
                </Button>
              )}
               <Button variant="outline" onClick={handlePrintContract}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Contrato
              </Button>
              {role === 'Administrador' && contract && contract.status === 'active' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <ShieldX className="mr-2 h-4 w-4" />
                      Anular Contrato
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción marcará el contrato como ANULADO, pero no eliminará ningún dato. Podrás reactivarlo más tarde si es necesario. El folio <span className="font-bold">{contract.folioNumber}</span> será afectado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAnnulContract} className="bg-destructive hover:bg-destructive/90">
                        Sí, anular contrato
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
               {role === 'Administrador' && contract && contract.status === 'expired' && (
                <Button variant="secondary" onClick={handleReactivateContract}>
                    <Undo className="mr-2 h-4 w-4" />
                    Reactivar Contrato
                </Button>
               )}
            </div>
      </div>
      
      {isLoading && <p className="print-hide">Cargando contrato...</p>}
      {error && <p className="text-destructive print-hide">Error: {error.message}</p>}
      {contract && <ContractView contract={contract} />}
      {!isLoading && !contract && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center print-hide">
            <h3 className="mt-4 text-lg font-semibold text-foreground">
                Contrato no encontrado
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
                El contrato que estás buscando no existe o no tienes permiso para verlo.
            </p>
        </div>
      )}

      {/* Modal para revisar y editar datos del certificado */}
      <Dialog open={isCertificateModalOpen} onOpenChange={setIsCertificateModalOpen}>
        <DialogContent className="print-hide sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>Revisar y Generar Certificado</DialogTitle>
                <DialogDescription>
                    Verifica y edita los datos del estudiante antes de imprimir el certificado.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto pr-4">
              <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="cert-folio">Folio del Certificado</Label>
                          <Input id="cert-folio" value={certificateData.folio} onChange={(e) => handleCertDataChange('folio', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="cert-cip">Cédula / Pasaporte</Label>
                          <Input id="cert-cip" value={certificateData.cip} onChange={(e) => handleCertDataChange('cip', e.target.value)} />
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="cert-name">Nombre Completo del Estudiante</Label>
                      <Input id="cert-name" value={certificateData.clientName} onChange={(e) => handleCertDataChange('clientName', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="cert-firstName">Primer Nombre</Label>
                          <Input id="cert-firstName" value={certificateData.firstName} onChange={(e) => handleCertDataChange('firstName', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="cert-middleName">Segundo Nombre</Label>
                          <Input id="cert-middleName" value={certificateData.middleName} onChange={(e) => handleCertDataChange('middleName', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="cert-lastName">Primer Apellido</Label>
                          <Input id="cert-lastName" value={certificateData.lastName} onChange={(e) => handleCertDataChange('lastName', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="cert-secondLastName">Segundo Apellido</Label>
                          <Input id="cert-secondLastName" value={certificateData.secondLastName} onChange={(e) => handleCertDataChange('secondLastName', e.target.value)} />
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="cert-address">Dirección</Label>
                      <Input id="cert-address" value={certificateData.address} onChange={(e) => handleCertDataChange('address', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="cert-phone1">Teléfono 1</Label>
                          <Input id="cert-phone1" value={certificateData.phone1} onChange={(e) => handleCertDataChange('phone1', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="cert-phone2">Teléfono 2 (Opcional)</Label>
                          <Input id="cert-phone2" value={certificateData.phone2 || ''} onChange={(e) => handleCertDataChange('phone2', e.target.value)} />
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="cert-license">Categoría de Licencia</Label>
                      <Input id="cert-license" value={certificateData.licenseType} onChange={(e) => handleCertDataChange('licenseType', e.target.value)} />
                  </div>
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="ghost">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleProceedToPrint} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                    Imprimir Certificado
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}