'use client';
import { useParams, useRouter } from 'next/navigation';
import { doc, updateDoc, serverTimestamp, runTransaction, DocumentReference } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { ContractView } from '@/components/contract-view';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Award, Printer } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDb, useUser } from '@/components/firebase-provider';
import { useDoc, useMemoDoc } from '@/hooks/use-firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

// Helper to get the next folio number
const getNextFolio = (lastFolioNum: number): string => {
    const year = new Date().getFullYear();
    const nextNum = lastFolioNum + 1;
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

  const [isFolioModalOpen, setIsFolioModalOpen] = useState(false);
  const [certificateFolio, setCertificateFolio] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const contractId = Array.isArray(id) ? id[0] : id;

  const contractRef = useMemoDoc(() => {
    if (!db || !user || !contractId) return null;
    return doc(db, `contracts`, contractId);
  }, [db, user, contractId]);

  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);
  
  const canGenerateCertificate = contract && ['Curso Auto', 'Curso Moto', 'Curso Deluxe', 'Curso Mixto'].includes(contract.type);

  const handleOpenFolioModal = async () => {
    if (!db) return;
    setIsGenerating(true);
    setCertificateFolio('Generando...');
    setIsFolioModalOpen(true);

    try {
        const counterRef = doc(db, 'counters', 'certificate_folio');
        await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                // Initialize if it doesn't exist.
                transaction.set(counterRef, { count: 0 });
                return 0;
            }
            return counterDoc.data().count;
        }).then(lastFolioNum => {
            const suggestedFolio = getNextFolio(lastFolioNum);
            setCertificateFolio(suggestedFolio);
        });
    } catch (e) {
        console.error("Could not access Firestore counter.", e);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudo obtener el número de folio. Inténtalo de nuevo.',
        });
        setCertificateFolio('Error');
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handleProceedToPrint = async () => {
    if (!certificateFolio || isGenerating || certificateFolio === 'Error' || !db || !contractRef) {
        toast({
            variant: 'destructive',
            title: 'Folio Inválido',
            description: 'No se puede imprimir sin un número de folio válido.',
        });
        return;
    }

    setIsGenerating(true);

    try {
        // Increment the folio counter in a transaction
        const counterRef = doc(db, 'counters', 'certificate_folio');
        await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                throw new Error("El contador de folios de certificado no existe.");
            }
            const newFolioNum = (parseInt(certificateFolio.split('/')[1].trim(), 10));
            transaction.update(counterRef, { count: newFolioNum });
        });
        
        // Update the contract document
        const updateData = {
            certificateGeneratedAt: serverTimestamp(),
            certificateFolio: certificateFolio,
        };
        await updateDoc(contractRef, updateData);

        // Open print window
        const printUrl = `/certificate-print/${contractId}?folio=${encodeURIComponent(certificateFolio)}`;
        window.open(printUrl, '_blank');
        setIsFolioModalOpen(false);

    } catch (serverError: any) {
        if (serverError instanceof Error && serverError.name === 'FirebaseError') {
             const permissionError = new FirestorePermissionError({
                path: contractRef.path,
                operation: 'update',
                requestResourceData: { certificateGeneratedAt: 'serverTimestamp()', certificateFolio },
             });
             errorEmitter.emit('permission-error', permissionError);
        } else {
            console.error("Error updating certificate folio:", serverError);
            toast({
                variant: 'destructive',
                title: 'Error al Guardar',
                description: 'No se pudo guardar el folio del certificado en la base de datos.',
            });
        }
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handlePrintContract = () => {
    const printUrl = `/print-contract/${contractId}`;
    window.open(printUrl, '_blank');
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
                <Button onClick={handleOpenFolioModal}>
                  <Award className="mr-2 h-4 w-4" />
                  Generar Certificado
                </Button>
              )}
               <Button variant="outline" onClick={handlePrintContract}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Contrato
              </Button>
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

      {/* Modal para introducir el folio del certificado */}
      <Dialog open={isFolioModalOpen} onOpenChange={setIsFolioModalOpen}>
        <DialogContent className="print-hide">
            <DialogHeader>
                <DialogTitle>Generar Certificado</DialogTitle>
                <DialogDescription>
                    Se usará el siguiente número de folio para el certificado.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="certificate-folio" className="text-right">
                        Folio
                    </Label>
                    <Input
                        id="certificate-folio"
                        value={certificateFolio}
                        onChange={(e) => setCertificateFolio(e.target.value)}
                        className="col-span-3"
                        placeholder="2026 / 0001"
                        readOnly={isGenerating}
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="ghost">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleProceedToPrint} disabled={isGenerating || certificateFolio === 'Error'}>Continuar a Impresión</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
