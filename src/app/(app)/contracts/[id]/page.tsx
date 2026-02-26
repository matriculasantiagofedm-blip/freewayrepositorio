
'use client';
import { useParams, useRouter } from 'next/navigation';
import { doc, updateDoc, deleteDoc, serverTimestamp, Timestamp, runTransaction, getDoc } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { ContractView } from '@/components/contract-view';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Printer, Loader2, CheckCircle2, CalendarIcon, Phone, Trash2, AlertCircle, Edit, Zap, AlertTriangle, Download } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDb, useUser } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';

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
    idType: 'C.I.P.',
    licenseType: '',
    address: '',
    phone1: '',
    phone2: '',
    firstName: '',
    middleName: '',
    lastName: '',
    secondLastName: '',
    marriedLastName: '',
    issueDate: new Date(),
    isCorrection: false,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
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
  
  const canGenerateCertificate = contract && (['Curso Auto', 'Curso Moto', 'Curso Mixto', 'Curso Deluxe', 'Ampliaciones'].includes(contract.type)) && contract.status !== 'draft';

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
      idType: details?.idType || 'C.I.P.',
      licenseType: (details as any)?.licenseCategory || '',
      address: details?.studentAddress || '',
      phone1: details?.studentPhone1 || '',
      phone2: details?.studentPhone2 || '',
      firstName,
      middleName,
      lastName,
      secondLastName,
      marriedLastName: contract.marriedLastName || '',
      issueDate: new Date(),
      isCorrection: false,
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
        const timestamp = Timestamp.fromDate(certificateData.issueDate);
        const updateData = {
            certificateGeneratedAt: timestamp,
            certificateFolio: certificateData.folio,
            certificateFirstName: certificateData.firstName,
            certificateMiddleName: certificateData.middleName,
            certificateLastName: certificateData.lastName,
            certificateSecondLastName: certificateData.secondLastName,
            certificateMarriedLastName: certificateData.marriedLastName,
            certificateLicenseType: finalLicenseType,
            certificateCip: certificateData.cip,
            certificateIdType: certificateData.idType,
            isCorrection: certificateData.isCorrection,
        };
        await updateDoc(contractRef, updateData);
        localStorage.setItem('lastCertificateFolio', certificateData.folio);
        setLastFolio(certificateData.folio);

        const queryParams = new URLSearchParams({
            folio: certificateData.folio,
            clientName: certificateData.clientName,
            cip: certificateData.cip,
            idType: certificateData.idType,
            licenseType: finalLicenseType,
            courseName: contract.title || '',
            issueDate: certificateData.issueDate.toISOString(),
            firstName: certificateData.firstName,
            middleName: certificateData.middleName,
            lastName: certificateData.lastName,
            secondLastName: certificateData.secondLastName,
            marriedLastName: certificateData.marriedLastName,
            address: certificateData.address,
            phone1: certificateData.phone1,
            phone2: certificateData.phone2,
        });

        window.open(`/certificate-print/${contractId}?${queryParams.toString()}`, '_blank');
        
        toast({ title: 'Impresión Iniciada', description: 'Se ha abierto la pestaña de impresión.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudo registrar la impresión.' });
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handlePrintContract = () => {
    window.open(`/print-contract/${contractId}`, '_blank');
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('contract-view-content');
    if (!element || !contract) return;

    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      
      const opt = {
        margin: [0.3, 0.7, 0.3, 0.3], // Top, Left (0.7), Bottom, Right
        filename: `Contrato_${contract.folioNumber || 'S-N'}_${contract.clientName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 820 
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().from(element).set(opt).save();
      toast({ title: "PDF Generado", description: "El contrato se ha descargado correctamente." });
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleActivateContract = async () => {
    if (!db || !contract || !contractRef) return;
    setIsActivating(true);
    try {
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'contracts_folio');
        const counterDoc = await transaction.get(counterRef);
        
        // UNIFICACIÓN: El próximo folio debe ser al menos 18
        let nextFolio = counterDoc.exists() 
            ? Math.max(counterDoc.data().count + 1, 18) 
            : 18;
        
        transaction.set(counterRef, { count: nextFolio }, { merge: true });
        transaction.update(contractRef, {
          status: 'active',
          folioNumber: nextFolio,
          title: `${contract.type} - Folio ${nextFolio}`,
          activatedAt: serverTimestamp(),
          activatedBy: role
        });
      });
      toast({ title: 'Contrato Activado', description: `El trámite web ha sido activado con el Folio ${contract.folioNumber}.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo activar el contrato.' });
    } finally {
      setIsActivating(false);
    }
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

  const handleDeleteContract = async () => {
    if (!contractRef || !contract) return;
    setIsGenerating(true);
    try {
      await deleteDoc(contractRef);
      toast({ title: 'Contrato Eliminado', description: `Registro eliminado permanentemente.` });
      router.push('/contracts');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar.' });
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
              {contract?.status === 'draft' && (
                <Button onClick={handleActivateContract} disabled={isActivating} className="bg-green-600 hover:bg-green-700 animate-pulse">
                  {isActivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                  Activar y Confirmar Pago
                </Button>
              )}
              {role === 'Administrador' && contract?.status !== 'draft' && (
                <Button variant="outline" asChild>
                    <Link href={`/contracts/${contractId}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar Contrato
                    </Link>
                </Button>
              )}
              <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading} className="border-blue-600 text-blue-600 hover:bg-blue-50">
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Descargar PDF
              </Button>
              {canGenerateCertificate && (role === 'Administrador' || role === 'Ventas' || role === 'Ventas Externas') && (
                <Button onClick={handleOpenCertificateModal}>
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
               {role === 'Administrador' && contract && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar permanentemente
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive">¡ADVERTENCIA: ACCIÓN IRREVERSIBLE!</AlertDialogTitle>
                      <AlertDialogDescription>
                        {contract ? (
                            <>¿Deseas eliminar definitivamente este registro? Esta acción borrará el documento de la base de datos.</>
                        ) : 'Cargando...'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteContract} className="bg-destructive hover:bg-destructive/90">
                        Sí, eliminar definitivamente
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
               )}
            </div>
      </div>
      
      {contract?.status === 'draft' && (
        <div className="bg-amber-100 border-l-4 border-amber-500 p-4 print-hide rounded-r-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="font-bold text-amber-900 uppercase text-sm">Este trámite es una pre-inscripción web pendiente de pago y activación.</p>
          </div>
        </div>
      )}

      {(isLoading || isUserLoading) && <p className="print-hide">Cargando contrato...</p>}
      {error && <p className="text-destructive print-hide">Error: {error.message}</p>}
      
      <div id="contract-view-content" className="bg-white">
        {contract && <ContractView contract={contract} />}
      </div>

      <Dialog open={isCertificateModalOpen} onOpenChange={setIsCertificateModalOpen}>
        <DialogContent className="print-hide sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
                <DialogTitle>Generar Certificado</DialogTitle>
                <DialogDescription>Verifica los datos del estudiante y selecciona la categoría a imprimir.</DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-4 py-4 space-y-6">
                <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Información del Documento</h3>
                        <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                            <Switch 
                                id="cert-is-correction" 
                                checked={certificateData.isCorrection}
                                onCheckedChange={(checked) => handleCertDataChange('isCorrection', checked)}
                            />
                            <Label htmlFor="cert-is-correction" className="text-xs font-bold text-amber-800 cursor-pointer flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" /> Es Corrección / Duplicado
                            </Label>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Folio de Certificado</Label>
                            <Input value={certificateData.folio} onChange={(e) => handleCertDataChange('folio', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Identificación del Estudiante</Label>
                            <div className="flex gap-2">
                                <Select 
                                    value={certificateData.idType} 
                                    onValueChange={(v) => handleCertDataChange('idType', v)}
                                >
                                    <SelectTrigger className="w-[100px] h-10 bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="C.I.P.">C.I.P.</SelectItem>
                                        <SelectItem value="PASS">PASS</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input 
                                    value={certificateData.cip} 
                                    onChange={(e) => handleCertDataChange('cip', e.target.value)} 
                                    className="bg-white flex-1" 
                                    placeholder="Número de documento"
                                />
                            </div>
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">1er Nombre</Label><Input value={certificateData.firstName} onChange={(e) => handleCertDataChange('firstName', e.target.value)} /></div>
                        <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">2do Nombre</Label><Input value={certificateData.middleName} onChange={(e) => handleCertDataChange('middleName', e.target.value)} /></div>
                        <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">1er Apellido</Label><Input value={certificateData.lastName} onChange={(e) => handleCertDataChange('lastName', e.target.value)} /></div>
                        <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">2do Apellido</Label><Input value={certificateData.secondLastName} onChange={(e) => handleCertDataChange('secondLastName', e.target.value)} /></div>
                        <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">Ap. Casada</Label><Input value={certificateData.marriedLastName} onChange={(e) => handleCertDataChange('marriedLastName', e.target.value)} /></div>
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
