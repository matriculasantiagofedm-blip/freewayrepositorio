'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Printer, Award, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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

export default function CertificatesGlobalSearchPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const { role } = useCurrentRole();

  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundContracts, setFoundContracts] = useState<Contract[] | null>(null);
  const [searched, setSearched] = useState(false);

  // Estados del Modal
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
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
    if (typeof window !== 'undefined') {
        setLastFolio(localStorage.getItem('lastCertificateFolio'));
    }
  }, []);

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
      const q1 = query(contractsRef, where('autoMotoDetails.studentIdNumber', '==', studentIdNumber));
      const q2 = query(contractsRef, where('ampliacionesDetails.studentIdNumber', '==', studentIdNumber));
      const q3 = query(contractsRef, where('deluxeDetails.studentIdNumber', '==', studentIdNumber));

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
      cip: studentIdNumber,
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

  const handleCertDataChange = (field: keyof typeof certificateData, value: string) => {
    setCertificateData(prev => ({ ...prev, [field]: value }));
  };

  const handleProceedToPrint = async (customLicenseType?: string) => {
    if (!certificateData.folio || !db || !selectedContract) {
        toast({ variant: 'destructive', title: 'Datos Inválidos', description: 'Faltan datos para imprimir.' });
        return;
    }

    const finalLicenseType = customLicenseType || certificateData.licenseType;

    setIsGenerating(true);
    try {
        const contractRef = doc(db, 'contracts', selectedContract.id);
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
            courseName: selectedContract.title || '',
            issueDate: new Date().toISOString(),
            firstName: certificateData.firstName,
            middleName: certificateData.middleName,
            lastName: certificateData.lastName,
            secondLastName: certificateData.secondLastName,
        });

        window.open(`/certificate-print/${selectedContract.id}?${queryParams.toString()}`, '_blank');
        setIsCertificateModalOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudo actualizar el folio.' });
    } finally {
        setIsGenerating(false);
    }
  };

  const groupedLicenses = useMemo(() => {
    if (!selectedContract || selectedContract.type !== 'Ampliaciones' || !selectedContract.ampliacionesDetails?.selectedPlans) return null;
    const plans = selectedContract.ampliacionesDetails.selectedPlans.map(p => p.name);
    return {
        E: plans.filter(p => ['E1', 'E2', 'E3'].includes(p)),
        individuals: plans.filter(p => ['A', 'B', 'C', 'D', 'F'].includes(p)),
    };
  }, [selectedContract]);

  return (
    <div className="flex flex-col gap-8">
        <h1 className="font-headline text-3xl font-bold">Emisión de Certificados</h1>
        
        <Card className="max-w-2xl mx-auto w-full">
            <CardHeader>
                <CardTitle>Búsqueda de Estudiante</CardTitle>
                <CardDescription>Introduce la cédula o pasaporte para encontrar contratos elegibles.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <Input 
                        placeholder="Ej: 8-000-000" 
                        value={studentIdNumber} 
                        onChange={(e) => setStudentIdNumber(e.target.value)} 
                    />
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        Buscar
                    </Button>
                </form>
            </CardContent>
        </Card>

        {searched && !isLoading && foundContracts && (
            <div className="grid gap-4 max-w-4xl mx-auto w-full">
                <h2 className="text-xl font-bold">Contratos Disponibles</h2>
                {foundContracts.map(contract => (
                    <Card key={contract.id} className="animate-in fade-in-50">
                        <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <p className="font-bold text-primary">Contrato N° {String(contract.folioNumber).padStart(6, '0')}</p>
                                <p className="text-lg font-semibold">{contract.clientName}</p>
                                <p className="text-sm text-muted-foreground">{contract.type}</p>
                            </div>
                            <Button onClick={() => handleOpenCertificateModal(contract)}>
                                <Printer className="mr-2 h-4 w-4" />
                                Preparar Certificado
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}

        {searched && !isLoading && !foundContracts && (
            <div className="text-center p-12 border-2 border-dashed rounded-lg max-w-2xl mx-auto w-full">
                <p className="text-muted-foreground">No se encontraron contratos activos para la cédula ingresada.</p>
            </div>
        )}

        {/* Modal de Impresión (Reutilizado de contract/[id]/page.tsx) */}
        <Dialog open={isCertificateModalOpen} onOpenChange={setIsCertificateModalOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Generar Certificado</DialogTitle>
                    <DialogDescription>Verifica los datos del estudiante y selecciona la categoría a imprimir.</DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto pr-4 py-4 space-y-6">
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

                    {selectedContract?.type === 'Ampliaciones' && groupedLicenses && (
                        <div className="space-y-4">
                            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Opciones de Impresión (Certificados Individuales)</h3>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {groupedLicenses.E.length > 0 && (
                                    <div className="p-4 border rounded-lg bg-blue-50/50 flex flex-col justify-between">
                                        <div>
                                            <p className="font-bold text-blue-700">Grupo E (Ampliación)</p>
                                            <p className="text-xs text-muted-foreground mb-3 italic">E1, E2, E3 juntas en un certificado (80h).</p>
                                            <div className="flex flex-wrap gap-1">
                                                {groupedLicenses.E.map(l => <span key={l} className="bg-blue-200 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">{l}</span>)}
                                            </div>
                                        </div>
                                        <Button onClick={() => handleProceedToPrint(groupedLicenses.E.join(', '))} size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700">
                                            <Printer className="mr-2 h-4 w-4" /> Imprimir Grupo E
                                        </Button>
                                    </div>
                                )}

                                {groupedLicenses.individuals.map(license => {
                                    const isStandard = ['B', 'C', 'D', 'F'].includes(license);
                                    const bgColor = isStandard ? 'bg-green-50/50' : 'bg-amber-50/50';
                                    const textColor = isStandard ? 'text-green-700' : 'text-amber-700';
                                    const btnColor = isStandard ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700';
                                    
                                    return (
                                        <div key={license} className={cn("p-4 border rounded-lg flex flex-col justify-between", bgColor)}>
                                            <div>
                                                <p className={cn("font-bold", textColor)}>Tipo {license} Individual</p>
                                                <p className="text-xs text-muted-foreground mb-3 italic">
                                                    {isStandard ? 'Formato Estándar (36h)' : 'Formato Ampliación (80h)'}
                                                </p>
                                                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", isStandard ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800')}>
                                                    {license}
                                                </span>
                                            </div>
                                            <Button onClick={() => handleProceedToPrint(license)} size="sm" className={cn("mt-4", btnColor)}>
                                                <Printer className="mr-2 h-4 w-4" /> Imprimir {license}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {selectedContract?.type !== 'Ampliaciones' && (
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
