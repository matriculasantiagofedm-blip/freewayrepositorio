'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Printer, CheckCircle2, PlusCircle, FileText, Repeat, CalendarIcon, Phone, AlertCircle, RefreshCw } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';
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
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

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

function CertificatesContent() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const { role } = useCurrentRole();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundContracts, setFoundContracts] = useState<Contract[] | null>(null);
  const [searched, setSearched] = useState(false);

  // Estados del Modal
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [manualType, setManualType] = useState<'primera-vez' | 'ampliaciones'>('primera-vez');
  
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
    isUpdate: false,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [lastFolio, setLastFolio] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setLastFolio(localStorage.getItem('lastCertificateFolio'));
    }
  }, []);

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'manual' && role === 'Administrador') {
        handleOpenManualModal();
    }
  }, [searchParams, role]);

  useEffect(() => {
    if (!selectedContract && manualType === 'primera-vez') {
        const current = certificateData.licenseType.split(',').map(p => p.trim()).filter(p => p);
        const filtered = current.filter(cat => FIRST_TIME_CATEGORIES.includes(cat));
        if (filtered.length !== current.length) {
            setCertificateData(prev => ({ ...prev, licenseType: filtered.join(', ') }));
        }
    }
  }, [manualType, selectedContract, certificateData.licenseType]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim() || !db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Introduce una cédula para buscar.' });
      return;
    }

    setIsLoading(true);
    setSearched(true);
    setFoundContracts(null);

    try {
      const contractsRef = collection(db, 'contracts');
      const q1 = query(contractsRef, where('autoMotoDetails.studentIdNumber', '==', studentIdNumber.trim()));
      const q2 = query(contractsRef, where('ampliacionesDetails.studentIdNumber', '==', studentIdNumber.trim()));
      const q3 = query(contractsRef, where('deluxeDetails.studentIdNumber', '==', studentIdNumber.trim()));

      const [snapshot1, snapshot2, snapshot3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
      const contractsMap = new Map<string, Contract>();

      [snapshot1, snapshot2, snapshot3].forEach(snapshot => {
          snapshot.forEach(doc => {
              const data = { id: doc.id, ...doc.data() } as Contract;
              if (data.status === 'active' || data.status === 'completed') {
                  contractsMap.set(doc.id, data);
              }
          });
      });

      const results = Array.from(contractsMap.values());
      setFoundContracts(results.length > 0 ? results : null);
    } catch (error) {
      console.error("Error searching contracts:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo realizar la búsqueda.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCertificateModal = (contract: Contract) => {
    setSelectedContract(contract);
    const isAmpliacion = contract.type === 'Ampliaciones';
    setManualType(isAmpliacion ? 'ampliaciones' : 'primera-vez');
    
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
      marriedLastName: '',
      issueDate: new Date(),
      isCorrection: false,
      isUpdate: false,
    });
    setIsCertificateModalOpen(true);
  };

  const handleOpenManualModal = () => {
    if (role !== 'Administrador') return;
    
    setSelectedContract(null);
    setManualType('primera-vez');
    const suggestedFolio = getNextFolio(lastFolio);
    setCertificateData({
      folio: suggestedFolio,
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
      isUpdate: false,
    });
    setIsCertificateModalOpen(true);
  };

  const handleCloseModal = (open: boolean) => {
    setIsCertificateModalOpen(open);
    if (!open && searchParams.get('mode') === 'manual') {
        router.push('/dashboard');
    }
  };

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

  const handleProceedToPrint = async (customLicenseType?: string) => {
    if (!certificateData.folio || !db || !user) {
        toast({ variant: 'destructive', title: 'Datos Inválidos', description: 'Faltan datos para imprimir.' });
        return;
    }

    const finalLicenseType = customLicenseType || certificateData.licenseType;

    setIsGenerating(true);
    try {
        const timestamp = Timestamp.fromDate(certificateData.issueDate);
        const sharedData = {
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
            isUpdate: certificateData.isUpdate,
        };

        if (selectedContract) {
            const contractRef = doc(db, 'contracts', selectedContract.id);
            await updateDoc(contractRef, sharedData);
        } else {
            const manualRef = doc(collection(db, 'contracts'));
            await setDoc(manualRef, {
                ...sharedData,
                id: manualRef.id,
                clientName: certificateData.clientName,
                type: manualType === 'ampliaciones' ? 'Ampliaciones' : 'Manual',
                status: 'completed',
                isManualPrint: true,
                userId: user.uid,
                createdAt: serverTimestamp(),
                folioNumber: 0,
            });
        }
        
        localStorage.setItem('lastCertificateFolio', certificateData.folio);
        setLastFolio(certificateData.folio);

        const queryParams = new URLSearchParams({
            folio: certificateData.folio,
            clientName: certificateData.clientName,
            cip: certificateData.cip,
            idType: certificateData.idType,
            licenseType: finalLicenseType,
            courseName: selectedContract?.title || (manualType === 'ampliaciones' ? 'Ampliación Manual' : 'Primera Vez Manual'),
            issueDate: certificateData.issueDate.toISOString(),
            firstName: certificateData.firstName,
            middleName: certificateData.middleName,
            lastName: certificateData.lastName,
            secondLastName: certificateData.secondLastName,
            marriedLastName: certificateData.marriedLastName,
            address: certificateData.address,
            phone1: certificateData.phone1,
            phone2: certificateData.phone2,
            manualType: manualType,
            isUpdate: String(certificateData.isUpdate),
        });

        const printId = selectedContract?.id || 'manual';
        window.open(`/certificate-print/${printId}?${queryParams.toString()}`, '_blank');
        
        toast({ title: 'Impresión Iniciada', description: 'Se ha abierto la pestaña de impresión.' });
    } catch (error) {
        console.error("Error saving certificate print:", error);
        toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudo registrar la impresión.' });
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
    const isAmpliacion = selectedContract ? selectedContract.type === 'Ampliaciones' : manualType === 'ampliaciones';
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
    <div className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
            <h1 className="font-headline text-3xl font-bold">Impresión de Certificados</h1>
            {role === 'Administrador' && (
                <Button onClick={handleOpenManualModal} variant="outline" className="border-primary text-primary hover:bg-primary/5">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Generación Manual (En Blanco)
                </Button>
            )}
        </div>
        
        <Card className="max-w-2xl mx-auto w-full shadow-md border-slate-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    Búsqueda de Estudiante por Cédula
                </CardTitle>
                <CardDescription>Introduce la cédula o pasaporte para encontrar contratos y emitir su certificado con información precargada.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <Input 
                        placeholder="Cédula (Ej: 8-000-000)" 
                        value={studentIdNumber} 
                        onChange={(e) => setStudentIdNumber(e.target.value)} 
                        className="h-11 font-bold tracking-widest"
                    />
                    <Button type="submit" disabled={isLoading} size="lg" className="px-8">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Buscar Registro
                    </Button>
                </form>
            </CardContent>
        </Card>

        {searched && !isLoading && foundContracts && (
            <div className="grid gap-4 max-w-4xl mx-auto w-full">
                <h2 className="text-xl font-bold text-slate-800">Resultados Encontrados</h2>
                {foundContracts.map(contract => (
                    <Card key={contract.id} className="animate-in fade-in-50 border-l-4 border-l-primary">
                        <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Contrato N° {String(contract.folioNumber).padStart(6, '0')}</p>
                                <p className="text-xl font-bold text-slate-900">{contract.clientName}</p>
                                <p className="text-sm text-muted-foreground font-medium">{contract.type}</p>
                            </div>
                            <Button onClick={() => handleOpenCertificateModal(contract)} className="h-11 px-6">
                                Preparar Certificado
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}

        {searched && !isLoading && !foundContracts && (
            <div className="text-center p-16 border-2 border-dashed rounded-xl max-w-2xl mx-auto w-full bg-slate-50">
                <p className="text-slate-500 font-medium text-lg">No se encontraron contratos activos o completados para la cédula ingresada.</p>
                {role === 'Administrador' && <p className="text-slate-400 text-sm mt-2">Puedes usar el botón superior para una generación manual en blanco.</p>}
            </div>
        )}

        <Dialog open={isCertificateModalOpen} onOpenChange={handleCloseModal}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Generar Certificado</DialogTitle>
                    <DialogDescription>Verifica los datos del estudiante y selecciona la categoría a imprimir.</DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto pr-4 py-4 space-y-6">
                    {!selectedContract && (
                        <div className="space-y-3 bg-slate-100 p-4 rounded-xl border">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">Tipo de Trámite Manual</Label>
                            <Tabs value={manualType} onValueChange={(v: any) => setManualType(v)} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 h-12">
                                    <TabsTrigger value="primera-vez" className="gap-2"><FileText className="h-4 w-4" /> Primera Vez</TabsTrigger>
                                    <TabsTrigger value="ampliaciones" className="gap-2"><Repeat className="h-4 w-4" /> Ampliaciones</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    )}

                    <div className="grid gap-4 p-5 border rounded-xl bg-slate-50/50">
                        <div className="flex flex-wrap justify-between items-center gap-4">
                            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Información del Documento</h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                                    <Switch 
                                        id="manual-is-correction" 
                                        checked={certificateData.isCorrection}
                                        onCheckedChange={(checked) => handleCertDataChange('isCorrection', checked)}
                                    />
                                    <Label htmlFor="manual-is-correction" className="text-xs font-bold text-amber-800 cursor-pointer flex items-center gap-1.5">
                                        <AlertCircle className="h-3.5 w-3.5" /> Es Corrección
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                                    <Switch 
                                        id="manual-is-update" 
                                        checked={certificateData.isUpdate}
                                        onCheckedChange={(checked) => handleCertDataChange('isUpdate', checked)}
                                    />
                                    <Label htmlFor="manual-is-update" className="text-xs font-bold text-blue-800 cursor-pointer flex items-center gap-1.5">
                                        <RefreshCw className="h-3.5 w-3.5" /> Es Actualización
                                    </Label>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Folio de Certificado</Label>
                                <Input value={certificateData.folio} onChange={(e) => handleCertDataChange('folio', e.target.value)} className="bg-white" />
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
                            <Input value={certificateData.clientName} onChange={(e) => handleCertDataChange('clientName', e.target.value)} className="bg-white font-bold" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">1er Nombre</Label><Input value={certificateData.firstName} onChange={(e) => handleCertDataChange('firstName', e.target.value)} className="bg-white text-xs" /></div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">2do Nombre</Label><Input value={certificateData.middleName} onChange={(e) => handleCertDataChange('middleName', e.target.value)} className="bg-white text-xs" /></div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">1er Apellido</Label><Input value={certificateData.lastName} onChange={(e) => handleCertDataChange('lastName', e.target.value)} className="bg-white text-xs" /></div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">2do Apellido</Label><Input value={certificateData.secondLastName} onChange={(e) => handleCertDataChange('secondLastName', e.target.value)} className="bg-white text-xs" /></div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400">Ap. Casada</Label><Input value={certificateData.marriedLastName} onChange={(e) => handleCertDataChange('marriedLastName', e.target.value)} className="bg-white text-xs" /></div>
                        </div>
                        <div className="space-y-2"><Label className="text-xs uppercase font-bold text-muted-foreground">Dirección Residencial</Label><Input value={certificateData.address} onChange={(e) => handleCertDataChange('address', e.target.value)} className="bg-white" /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2"><Phone className="h-3 w-3" /> Teléfono Residencial</Label>
                                <Input value={certificateData.phone1} onChange={(e) => handleCertDataChange('phone1', e.target.value)} className="bg-white" placeholder="Ej: 255-0000" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2"><Phone className="h-3 w-3" /> Teléfono Celular</Label>
                                <Input value={certificateData.phone2} onChange={(e) => handleCertDataChange('phone2', e.target.value)} className="bg-white" placeholder="Ej: 6000-0000" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Seleccionar Categorías de Licencia</Label>
                        <CategoryGrid />
                    </div>

                    {(manualType === 'ampliaciones' || (selectedContract && selectedContract.type === 'Ampliaciones')) && (
                        <div className="space-y-4">
                            <Separator />
                            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Opciones de Impresión (Certificados Individuales)</h3>
                            
                            {groupedLicenses && (
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
                                        const isAmpliacionFormat = ['A'].includes(license); 
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
                            )}
                        </div>
                    )}

                    {(manualType === 'primera-vez' || (selectedContract && selectedContract.type !== 'Ampliaciones')) && (
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

export default function CertificatesGlobalSearchPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>}>
            <CertificatesContent />
        </Suspense>
    );
}