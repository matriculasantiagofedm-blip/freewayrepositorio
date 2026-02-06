'use client';
import { useParams, useRouter } from { 'next/navigation' };
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
import { useDb } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { Checkbox } from '@/components/ui/checkbox';

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
  const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);

  useEffect(() => {
    setLastFolio(localStorage.getItem('lastCertificateFolio'));
  }, []);

  const contractId = Array.isArray(id) ? id[0] : id;

  const contractRef = useMemoDoc(() => {
    if (!db || !contractId) return null;
    // DESBLOQUEO TOTAL: Carga inmediata sin dependencia de sesión de usuario para máxima velocidad
    return doc(db, `contracts`, contractId);
  }, [db, contractId]);

  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);

  const handleCertDataChange = (field: keyof typeof certificateData, value: string) => {
    setCertificateData(prev => ({ ...prev, [field]: value }));
  };
  
  useEffect(() => {
    if (contract?.type === 'Ampliaciones') {
      handleCertDataChange('licenseType', selectedLicenses.join(', '));
    }
  }, [selectedLicenses, contract?.type]);
  
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

    let initialLicenseType = '';
    if (contract.type === 'Ampliaciones' && contract.ampliacionesDetails?.selectedPlans) {
        const initialLicenses = contract.ampliacionesDetails.selectedPlans.map(p => p.name);
        setSelectedLicenses(initialLicenses);
        initialLicenseType = initialLicenses.join(', ');
    } else {
        initialLicenseType = (details as any)?.licenseCategory || '';
        setSelectedLicenses([]);
    }

    setCertificateData({
      folio: suggestedFolio,
      clientName: contract.clientName,
      cip: details?.studentIdNumber || '',
      licenseType: initialLicenseType,
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
  
  const handleProceedToPrint = async () => {
    if (!certificateData.folio || !db || !contractRef || !contract) {
        toast({ variant: 'destructive', title: 'Datos Inválidos', description: 'Faltan datos para imprimir.' });
        return;
    }
    if (contract.type === 'Ampliaciones' && selectedLicenses.length === 0) {
        toast({ variant: 'destructive', title: 'Selección Requerida', description: 'Selecciona al menos una licencia.' });
        return;
    }

    setIsGenerating(true);
    try {
        const updateData = {
            certificateGeneratedAt: serverTimestamp(),
            certificateFolio: certificateData.folio,
        };
        await updateDoc(contractRef, updateData);
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

        window.open(`/certificate-print/${contractId}?${queryParams.toString()}`, '_blank');
        setIsCertificateModalOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudo actualizar el folio.' });
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handlePrintContract = () => {
    window.open(`/print-contract/${contractId}`, '_blank');
  };

  const handleAnnulContract = async () => {
    if (!contractRef || !contract) return;
    setIsGenerating(true);
    try {
      await updateDoc(contractRef, { status: 'expired' });
      toast({ title: 'Contrato Anulado', description: `Folio ${contract.folioNumber} anulado.` });
      router.refresh();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Fallo al anular.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReactivateContract = async () => {
    if (!contractRef || !contract) return;
    setIsGenerating(true);
    try {
      await updateDoc(contractRef, { status: 'active' });
      toast({ title: 'Contrato Reactivado', description: `Folio ${contract.folioNumber} reactivado.` });
      router.refresh();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo reactivar.' });
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
              {/* DESBLOQUEO: Todos los roles operativos pueden generar certificados ahora */}
              {canGenerateCertificate && (role === 'Administrador' || role === 'Ventas' || role === 'Ventas Externas') && (
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
                        Esta acción marcará el contrato como ANULADO. Folio <span className="font-bold">{contract.folioNumber}</span>.
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

      <Dialog open={isCertificateModalOpen} onOpenChange={setIsCertificateModalOpen}>
        <DialogContent className="print-hide sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>Generar Certificado</DialogTitle>
                <DialogDescription>Verifica los datos del estudiante.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto pr-4">
              <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Folio</Label>
                          <Input value={certificateData.folio} onChange={(e) => handleCertDataChange('folio', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label>Cédula</Label>
                          <Input value={certificateData.cip} onChange={(e) => handleCertDataChange('cip', e.target.value)} />
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label>Nombre Completo</Label>
                      <Input value={certificateData.clientName} onChange={(e) => handleCertDataChange('clientName', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2"><Label>1er Nombre</Label><Input value={certificateData.firstName} onChange={(e) => handleCertDataChange('firstName', e.target.value)} /></div>
                      <div className="space-y-2"><Label>2do Nombre</Label><Input value={certificateData.middleName} onChange={(e) => handleCertDataChange('middleName', e.target.value)} /></div>
                      <div className="space-y-2"><Label>1er Apellido</Label><Input value={certificateData.lastName} onChange={(e) => handleCertDataChange('lastName', e.target.value)} /></div>
                      <div className="space-y-2"><Label>2do Apellido</Label><Input value={certificateData.secondLastName} onChange={(e) => handleCertDataChange('secondLastName', e.target.value)} /></div>
                  </div>
                  <div className="space-y-2"><Label>Dirección</Label><Input value={certificateData.address} onChange={(e) => handleCertDataChange('address', e.target.value)} /></div>
                  
                  {contract?.type === 'Ampliaciones' && contract.ampliacionesDetails?.selectedPlans && (
                    <div className="space-y-2">
                        <Label>Licencias a Incluir</Label>
                        <div className="grid grid-cols-3 gap-2 rounded-md border p-4">
                            {contract.ampliacionesDetails.selectedPlans.map((plan) => (
                                <div key={plan.name} className="flex items-center space-x-2">
                                    <Checkbox id={`chk-${plan.name}`} checked={selectedLicenses.includes(plan.name)} onCheckedChange={(c) => setSelectedLicenses(prev => c ? [...prev, plan.name] : prev.filter(n => n !== plan.name))} />
                                    <label htmlFor={`chk-${plan.name}`} className="text-sm">{plan.name}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                  )}

                  <div className="space-y-2">
                      <Label>Categoría de Licencia</Label>
                      <Input value={certificateData.licenseType} onChange={(e) => contract?.type !== 'Ampliaciones' && handleCertDataChange('licenseType', e.target.value)} readOnly={contract?.type === 'Ampliaciones'} />
                  </div>
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
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