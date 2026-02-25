'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, ClipboardList, Printer } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';

export default function LogsPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const { role } = useCurrentRole();

  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundContracts, setFoundContracts] = useState<Contract[] | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim() || !db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce un número de cédula.' });
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

      const processSnapshot = (snapshot: any) => {
          snapshot.forEach((doc: any) => {
              const contractData = { id: doc.id, ...doc.data() } as Contract;
              if (contractData.status !== 'expired' && !contractsMap.has(doc.id)) {
                contractsMap.set(doc.id, contractData);
              }
          });
      };
      
      processSnapshot(snapshot1);
      processSnapshot(snapshot2);
      processSnapshot(snapshot3);

      const allContracts = Array.from(contractsMap.values());
      setFoundContracts(allContracts.length > 0 ? allContracts : null);
      
    } catch (error) {
      console.error("Error searching for contract:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo realizar la búsqueda.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintLog = (contract: Contract, logType: string) => {
    const params = new URLSearchParams({
        name: contract.clientName || '',
        id: contract.autoMotoDetails?.studentIdNumber || contract.deluxeDetails?.studentIdNumber || contract.ampliacionesDetails?.studentIdNumber || '',
        type: logType
    });
    window.open(`/print-log/${contract.id}?${params.toString()}`, '_blank');
  };

  const getRecommendedLogType = (contract: Contract) => {
    const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
    const plan = (details as any)?.coursePlan || '';
    const planUpper = plan.toUpperCase();
    
    if (planUpper.includes('8 HR') || planUpper.includes('BASICO') || planUpper.includes('BÁSICO')) return 'manual-8h';
    if (planUpper.includes('10 HR') || planUpper.includes('PLUS')) return 'manual-10h';
    if (planUpper.includes('12 HR') || planUpper.includes('PREMIUM')) return 'manual-12h';
    
    // Default fallbacks based on contract type if plan is ambiguous
    if (contract.type === 'Curso Auto' || contract.type === 'Curso Moto') return 'manual-8h';
    return 'manual-12h';
  };

  return (
    <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            <div>
                <h1 className="font-headline text-3xl font-bold">Bitácoras de Control</h1>
                <p className="text-muted-foreground">Genera el control de clases prácticas para estudiantes registrados.</p>
            </div>
        </div>

        <Card className="max-w-2xl mx-auto w-full shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    Búsqueda de Estudiante
                </CardTitle>
                <CardDescription>Introduce la cédula para generar su bitácora personalizada.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <Input 
                        placeholder="Cédula (Ej: 8-000-000)" 
                        value={studentIdNumber} 
                        onChange={(e) => setStudentIdNumber(e.target.value)} 
                        className="h-11 font-bold"
                    />
                    <Button type="submit" disabled={isLoading} size="lg">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Buscar Registro
                    </Button>
                </form>
            </CardContent>
        </Card>

        {searched && !isLoading && foundContracts && (
            <div className="grid gap-4 max-w-4xl mx-auto w-full animate-in fade-in-50">
                <h2 className="text-xl font-bold text-slate-800">Resultados Encontrados</h2>
                {foundContracts.map(contract => {
                    const recommended = getRecommendedLogType(contract);
                    const hoursLabel = recommended === 'manual-8h' ? '8h' : recommended === 'manual-10h' ? '10h' : '12h';
                    const planName = (contract.autoMotoDetails as any)?.coursePlan || 'Plan no especificado';

                    return (
                        <Card key={contract.id} className="border-l-4 border-l-primary overflow-hidden">
                            <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contrato N° {String(contract.folioNumber).padStart(6, '0')}</p>
                                    <p className="text-xl font-black text-slate-900 uppercase tracking-tight">{contract.clientName}</p>
                                    <p className="text-sm text-muted-foreground font-medium uppercase">{contract.type} — <span className="text-primary font-black">{planName}</span></p>
                                </div>
                                <div className="flex flex-col gap-3 items-end w-full md:w-auto">
                                    <Button 
                                        onClick={() => handlePrintLog(contract, recommended)} 
                                        className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 font-black h-12 px-8 uppercase tracking-widest shadow-lg gap-2"
                                    >
                                        <Printer className="h-5 w-5" />
                                        Generar Bitácora {hoursLabel}
                                    </Button>
                                    
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Otros Formatos:</span>
                                        {['manual-8h', 'manual-10h', 'manual-12h'].filter(t => t !== recommended).map(type => (
                                            <Button 
                                                key={type}
                                                variant="outline" 
                                                size="sm" 
                                                className="h-7 text-[9px] font-black uppercase px-2 hover:bg-slate-100"
                                                onClick={() => handlePrintLog(contract, type)}
                                            >
                                                {type.replace('manual-', '')}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        )}

        {searched && !isLoading && !foundContracts && (
            <div className="text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 max-w-2xl mx-auto w-full">
                <p className="text-slate-500 font-bold">No se encontraron contratos activos para esta cédula.</p>
            </div>
        )}
    </div>
  );
}
