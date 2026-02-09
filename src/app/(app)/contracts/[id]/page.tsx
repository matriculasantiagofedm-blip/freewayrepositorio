'use client';
import { useParams, useRouter } from 'next/navigation';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { ContractView } from '@/components/contract-view';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Printer, Loader2, CheckCircle2, CalendarIcon, Phone } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCurrentRole } from '@/hooks/use-current-role';
import { cn } from '@/lib/utils';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ALL_CATEGORIES = ['A', 'B', 'C', 'D', 'E1', 'E2', 'E3', 'F'];
const FIRST_TIME_CATEGORIES = ['A', 'B', 'C', 'D'];

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
    issueDate: new Date(),
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

  // Limpiar categorías no válidas al abrir modal si no es ampliación
  useEffect(() => {
    if (contract && contract.type !== 'Ampliaciones' && isCertificateModalOpen) {
        const current = certificateData.licenseType.split(',').map(p => p.trim()).filter(p => p);
        const filtered = current.filter(cat => FIRST_TIME_CATEGORIES.includes(cat));
        if (filtered.length !== current.length) {
            setCertificateData(prev => ({ ...prev, licenseType: filtered.join(', ') }));
        }
    }
  }, [isCertificateModalOpen, contract, certificateData.licenseType]);

  const handleCertDataChange = (field: keyof typeof certificateData, value: any) => {
    setCertificateData(prev => ({ ...prev, [field]: value }));
  };

  const toggleCategory = (cat: string) => {
    const current = certificateData.licenseType.split(',').map(p => p.trim()).filter(p => p);
    let newVal = '';
    if (current.includes(cat)) {
        newVal = current.filter(p => p !== cat).join(', ');
    } else {
        newVal = [...current, cat].sort().join(', ');
    }
    handleCertDataChange('licenseType', newVal);
  };
  
  const canGenerateCertificate = contract && (['Curso Auto', 'Curso Moto', 'Curso Deluxe', 'Curso Mixto', 'Ampliaciones'].includes(contract.type));

  const handleOpenCertificateModal = () => {
    if (!contract) return;
    
    const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
    const suggestedFolio = getNextFolio(lastFolio);

    const nameParts = (contract.clientName || '').split(' ').filter(p => p);
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
      clientName: contract.clientName || '',
      cip: details?.studentIdNumber || '',
      licenseType: (details as any)?.licenseCategory || '',
      address: details?.studentAddress || '',
      phone1: details?.studentPhone1 || '',
      phone2: details?.studentPhone2 || '',
      firstName,
      middleName,
      lastName,
      secondLastName,
      issueDate: new Date(),
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
            issueDate: certificateData.issueDate.toISOString(),
            firstName: certificateData.firstName,
            middleName: certificateData.middleName,
            lastName: certificateData.lastName,
            secondLastName: certificateData.secondLastName,
            address: certificateData.address,
            phone1: certificateData.phone1,
            phone2: certificateData.phone2,
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
    const type = certificateData.licenseType.toUpperCase();
    if (!type) return null;

    const parts = type.split(',').map(p => p.trim()).filter(p => p);
    
    const eGroup = parts.filter(p => ['E1', 'E2', 'E3'].includes(p));
    const individuals = parts.filter(p => ['A', 'B', 'C', 'D', 'F'].includes(p));

    return {
        E: eGroup,
        individuals: individuals,
    };
  }, [certificateData.licenseType]);

  const CategoryGrid = () => {
    const isAmpliacion = contract?.type === 'Ampliaciones';
    const categoriesToShow = isAmpliacion ? ALL_CATEGORIES : FIRST_TIME_CATEGORIES;

    return (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {categoriesToShow.map(cat => {
                const isSelected = certificateData.licenseType.includes(cat);
                return (
                    <Button 
                        key={cat} 
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className={cn("h-10 font-bold", isSelected && "bg-primary text-white border-primary")}
                        onClick={() => toggleCategory(cat)}
                    >
                        {cat}
                    </Button>
                );
            })}
        </div>
    );
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
              {canGenerateCertificate && (role === 'Administrador' || role === 'Ventas' || role === 'Ventas Externas') && (
                <Button onClick={handleOpenCertificateModal}>
                  Generar Certificado
                </Button>
              )}
               <Button variant="outline" onClick={handlePrintContract}>
                Imprimir Contrato
              </Button>
              {role === 'Administrador' && contract && contract.status === 'active' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
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
                <DialogDescription>Verifica los datos del estudiante y selecciona la categoría a imprimir.</DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-4 py-4 space-y-6">
                <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Información del Documento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Folio de Certificado</Label>
                            <Input value={certificateData.folio} onChange={(e) => handleCertDataChange('folio', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Número de Cédula</Label>
                            <Input value={certificateData.cip} onChange={(e) => handleCertDataChange('cip', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Fecha de Emisión</Label>
                            <Popover modal={true}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full h-10 justify-start text-left font-normal bg-white",
                                            !certificateData.issueDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {certificateData.issueDate ? format(certificateData.issueDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start" side="bottom">
                                    <Calendar
                                        mode="single"
                                        selected={certificateData.issueDate}
                                        onSelect={(date) => {
                                            if (date) {
                                                handleCertDataChange('issueDate', date);
                                            }
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Nombre Completo (Frente)</Label>
                        <Input value={certificateData.clientName} onChange={(e) => handleCertDataChange('clientName', e.target.value)} className="font-bold" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">1er Nombre</Label><Input value={certificateData.firstName} onChange={(e) => handleCertDataChange('firstName', e.target.value)} /></div>
                        <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">2do Nombre</Label><Input value={certificateData.middleName} onChange={(e) => handleCertDataChange('middleName', e.target.value)} /></div>
                        <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">1er Apellido</Label><Input value={certificateData.lastName} onChange={(e) => handleCertDataChange('lastName', e.target.value)} /></div>
                        <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">2do Apellido</Label><Input value={certificateData.secondLastName} onChange={(e) => handleCertDataChange('secondLastName', e.target.value)} /></div>
                    </div>
                    <div className="space-y-2"><Label className="text-xs uppercase font-bold text-muted-foreground">Dirección Residencial</Label><Input value={certificateData.address} onChange={(e) => handleCertDataChange('address', e.target.value)} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2"><Phone className="h-3 w-3" /> Teléfono Residencial</Label>
                            <Input value={certificateData.phone1} onChange={(e) => handleCertDataChange('phone1', e.target.value)} placeholder="Ej: 255-0000" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2"><Phone className="h-3 w-3" /> Teléfono Celular</Label>
                            <Input value={certificateData.phone2} onChange={(e) => handleCertDataChange('phone2', e.target.value)} placeholder="Ej: 6000-0000" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categorías de Licencia</Label>
                    <CategoryGrid />
                </div>

                {contract?.type === 'Ampliaciones' && groupedLicenses && (
                    <div className="space-y-4">
                        <Separator />
                        <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Opciones de Impresión (Certificados Individuales)</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {groupedLicenses.E.length > 0 && (
                                <div className="p-4 border rounded-xl bg-blue-50 flex flex-col justify-between shadow-sm border-blue-100">
                                    <div>
                                        <p className="font-bold text-blue-800">Grupo E (Ampliación)</p>
                                        <p className="text-[10px] text-blue-600 mb-3 font-medium">Formato Ampliación (80h)</p>
                                        <div className="flex flex-wrap gap-1">
                                            {groupedLicenses.E.map(l => <span key={l} className="bg-blue-200/50 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">{l}</span>)}
                                        </div>
                                    </div>
                                    <Button onClick={() => handleProceedToPrint(groupedLicenses.E.join(', '))} size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white">
                                        Imprimir Grupo E (80h)
                                    </Button>
                                </div>
                            )}

                            {groupedLicenses.individuals.map(license => {
                                const isAmpliacionFormat = ['A'].includes(license); // Solo la A es 80h en ampliacion
                                const bgColor = !isAmpliacionFormat ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100';
                                const textColor = !isAmpliacionFormat ? 'text-green-800' : 'text-amber-800';
                                const btnColor = !isAmpliacionFormat ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700';
                                const labelHours = !isAmpliacionFormat ? '36h' : '80h';
                                
                                return (
                                    <div key={license} className={cn("p-4 border rounded-xl flex flex-col justify-between shadow-sm", bgColor)}>
                                        <div>
                                            <p className={cn("font-bold", textColor)}>Tipo {license} Individual</p>
                                            <p className="text-[10px] opacity-80 mb-3 font-medium">
                                                Formato {!isAmpliacionFormat ? 'Estándar' : 'Ampliación'} ({labelHours})
                                            </p>
                                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", !isAmpliacionFormat ? 'bg-green-200/50 text-green-800' : 'bg-amber-200/50 text-amber-800')}>
                                                {license}
                                            </span>
                                        </div>
                                        <Button onClick={() => handleProceedToPrint(license)} size="sm" className={cn("mt-4 text-xs font-bold text-white", btnColor)}>
                                            Imprimir {license} ({labelHours})
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {contract?.type !== 'Ampliaciones' && (
                    <div className="space-y-4">
                        <Separator />
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Formato de Impresión Único (36h)</Label>
                            <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
                                <p className="text-sm text-green-800 font-medium">Se generará un certificado único de 36 horas para las categorías seleccionadas: <span className="font-bold">{certificateData.licenseType || '(Ninguna)'}</span></p>
                            </div>
                        </div>
                        <Button onClick={() => handleProceedToPrint()} className="w-full h-12 text-lg font-bold shadow-lg" disabled={isGenerating || !certificateData.licenseType}>
                            {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Printer className="mr-2 h-5 w-5" />}
                            Imprimir Certificado Único (36h)
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
