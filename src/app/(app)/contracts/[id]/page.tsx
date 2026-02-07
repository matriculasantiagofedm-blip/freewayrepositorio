'use client';
import { useParams, useRouter } from 'next/navigation';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { ContractView } from '@/components/contract-view';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Award, Printer, ShieldX, Undo, Loader2, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
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
import { Separator } from '@/components/ui/separator';

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
  const { user, isUserLoading } = useUser();
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
    setLastFolio(localStorage.getItem('lastCertificateFolio'));
  }, []);

  const contractId = Array.isArray(id) ? id[0] : id;

  const contractRef = useMemoDoc(() => {
    if (!db || !contractId || isUserLoading || !user) return null;
    return doc(db, `contracts`, contractId);
  }, [db, contractId, user, isUserLoading]);

  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);

  const handleCertDataChange = (field: keyof typeof certificateData, value: string) => {
    setCertificateData(prev => ({ ...prev, [field]: value }));
  };
  
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
      licenseType: (details as any)?.licenseCategory || '',
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
  
  const handleProceedToPrint = async (customLicenseType?: string) => {
    if (!certificateData.folio || !db || !contractRef || !contract) {
        toast({ variant: 'destructive', title: 'Datos Inválidos', description: 'Faltan datos para imprimir.' });
        return;
    }

    const finalLicenseType = customLicenseType || certificateData.licenseType;

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
            licenseType: finalLicenseType,
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

  const groupedLicenses = useMemo(() => {
    if (contract?.type !== 'Ampliaciones' || !contract.ampliacionesDetails?.selectedPlans) return null;
    const plans = contract.ampliacionesDetails.selectedPlans.map(p => p.name);
    return {
        E: plans.filter(p => ['E1', 'E2', 'E3'].includes(p)),
        ACD: plans.filter(p => ['A', 'B', 'C', 'D'].includes(p)),
        F: plans.filter(p => p === 'F'),
    };
  }, [contract]);

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
      
      {(isLoading || isUserLoading) && <p className="print-hide">Cargando contrato...</p>}
      {error && <p className="text-destructive print-hide">Error: {error.message}</p>}
      {contract && <ContractView contract={contract} />}

      <Dialog open={isCertificateModalOpen} onOpenChange={setIsCertificateModalOpen}>
        <DialogContent className="print-hide sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
                <DialogTitle>Generar Certificado</DialogTitle>
                <DialogDescription>Verifica los datos del estudiante y selecciona el grupo a imprimir.</DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-4 py-4 space-y-6">
                {/* Datos Generales */}
                <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Información del Documento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Folio de Certificado</Label>
                            <Input value={certificateData.folio} onChange={(e) => handleCertDataChange('folio', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Número de Cédula</Label>
                            <Input value={certificateData.cip} onChange={(e) => handleCertDataChange('cip', e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Nombre Completo (Como aparecerá en el frente)</Label>
                        <Input value={certificateData.clientName} onChange={(e) => handleCertDataChange('clientName', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2"><Label className="text-xs">1er Nombre</Label><Input value={certificateData.firstName} onChange={(e) => handleCertDataChange('firstName', e.target.value)} /></div>
                        <div className="space-y-2"><Label className="text-xs">2do Nombre</Label><Input value={certificateData.middleName} onChange={(e) => handleCertDataChange('middleName', e.target.value)} /></div>
                        <div className="space-y-2"><Label className="text-xs">1er Apellido</Label><Input value={certificateData.lastName} onChange={(e) => handleCertDataChange('lastName', e.target.value)} /></div>
                        <div className="space-y-2"><Label className="text-xs">2do Apellido</Label><Input value={certificateData.secondLastName} onChange={(e) => handleCertDataChange('secondLastName', e.target.value)} /></div>
                    </div>
                    <div className="space-y-2"><Label>Dirección Residencial</Label><Input value={certificateData.address} onChange={(e) => handleCertDataChange('address', e.target.value)} /></div>
                </div>

                {/* Selección por Grupos (Solo para Ampliaciones) */}
                {contract?.type === 'Ampliaciones' && groupedLicenses && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Grupos de Impresión Disponibles</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Grupo E */}
                            {groupedLicenses.E.length > 0 && (
                                <div className="p-4 border rounded-lg bg-blue-50/50 flex flex-col justify-between">
                                    <div>
                                        <p className="font-bold text-blue-700">Grupo E (Ampliación)</p>
                                        <p className="text-xs text-muted-foreground mb-3 italic">E1, E2, E3 juntas en un certificado.</p>
                                        <div className="flex flex-wrap gap-1">
                                            {groupedLicenses.E.map(l => <span key={l} className="bg-blue-200 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">{l}</span>)}
                                        </div>
                                    </div>
                                    <Button onClick={() => handleProceedToPrint(groupedLicenses.E.join(', '))} size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700">
                                        <Printer className="mr-2 h-4 w-4" /> Imprimir Grupo E
                                    </Button>
                                </div>
                            )}

                            {/* Grupo ACD */}
                            {groupedLicenses.ACD.length > 0 && (
                                <div className="p-4 border rounded-lg bg-amber-50/50 flex flex-col justify-between">
                                    <div>
                                        <p className="font-bold text-amber-700">Grupo A,C,D (Ampliación)</p>
                                        <p className="text-xs text-muted-foreground mb-3 italic">A, B, C, D juntas en un certificado.</p>
                                        <div className="flex flex-wrap gap-1">
                                            {groupedLicenses.ACD.map(l => <span key={l} className="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">{l}</span>)}
                                        </div>
                                    </div>
                                    <Button onClick={() => handleProceedToPrint(groupedLicenses.ACD.join(', '))} size="sm" className="mt-4 bg-amber-600 hover:bg-amber-700">
                                        <Printer className="mr-2 h-4 w-4" /> Imprimir Grupo ACD
                                    </Button>
                                </div>
                            )}

                            {/* Grupo F */}
                            {groupedLicenses.F.length > 0 && (
                                <div className="p-4 border rounded-lg bg-green-50/50 flex flex-col justify-between">
                                    <div>
                                        <p className="font-bold text-green-700">Tipo F (Individual)</p>
                                        <p className="text-xs text-muted-foreground mb-3 italic">Utiliza formato estándar (36h).</p>
                                        <div className="flex flex-wrap gap-1">
                                            <span className="bg-green-200 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded">F</span>
                                        </div>
                                    </div>
                                    <Button onClick={() => handleProceedToPrint('F')} size="sm" className="mt-4 bg-green-600 hover:bg-green-700">
                                        <Printer className="mr-2 h-4 w-4" /> Imprimir Tipo F
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Selector único para Cursos Normales */}
                {contract?.type !== 'Ampliaciones' && (
                    <div className="space-y-4">
                        <Separator />
                        <div className="space-y-2">
                            <Label>Categoría de Licencia a Emitir</Label>
                            <Input value={certificateData.licenseType} onChange={(e) => handleCertDataChange('licenseType', e.target.value)} placeholder="Ej: A, C, B" />
                        </div>
                        <Button onClick={() => handleProceedToPrint()} className="w-full" disabled={isGenerating}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                            Imprimir Certificado Único
                        </Button>
                    </div>
                )}
            </div>

            <DialogFooter className="border-t pt-4">
                <DialogClose asChild><Button variant="ghost">Cerrar</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
