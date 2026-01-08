'use client';
import { useParams, useRouter } from 'next/navigation';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { ContractView } from '@/components/contract-view';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Award, Printer, ShieldX, Undo } from 'lucide-react';
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
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

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

  const [isFolioModalOpen, setIsFolioModalOpen] = useState(false);
  const [certificateFolio, setCertificateFolio] = useState('');
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
  
  const canGenerateCertificate = contract && ['Curso Auto', 'Curso Moto', 'Curso Deluxe', 'Curso Mixto'].includes(contract.type);

  const handleOpenFolioModal = () => {
    const suggestedFolio = getNextFolio(lastFolio);
    setCertificateFolio(suggestedFolio);
    setIsFolioModalOpen(true);
  };
  
  const handleProceedToPrint = async () => {
    if (!certificateFolio || !db || !contractRef) {
        toast({
            variant: 'destructive',
            title: 'Folio Inválido',
            description: 'No se puede imprimir sin un número de folio válido.',
        });
        return;
    }

    setIsGenerating(true);

    try {
        const updateData = {
            certificateGeneratedAt: serverTimestamp(),
            certificateFolio: certificateFolio,
        };
        await updateDoc(contractRef, updateData);

        // Store the new folio in localStorage
        localStorage.setItem('lastCertificateFolio', certificateFolio);
        setLastFolio(certificateFolio);

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
  
    } catch (serverError: any) {
      if (serverError instanceof Error && serverError.name === 'FirebaseError') {
        const permissionError = new FirestorePermissionError({
          path: contractRef.path,
          operation: 'update',
          requestResourceData: { status: 'expired' },
        });
        errorEmitter.emit('permission-error', permissionError);
      } else {
        console.error("Error al anular contrato:", serverError);
        toast({
          variant: 'destructive',
          title: 'Error al anular',
          description: 'No se pudo anular el contrato. Revisa los permisos o contacta al administrador.',
        });
      }
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
    } catch (serverError: any) {
        if (serverError instanceof Error && serverError.name === 'FirebaseError') {
            const permissionError = new FirestorePermissionError({
                path: contractRef.path,
                operation: 'update',
                requestResourceData: { status: 'active' },
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            console.error("Error al reactivar contrato:", serverError);
            toast({
                variant: 'destructive',
                title: 'Error al Reactivar',
                description: 'No se pudo reactivar el contrato. Revisa los permisos.',
            });
        }
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
                <Button onClick={handleOpenFolioModal}>
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

      {/* Modal para introducir el folio del certificado */}
      <Dialog open={isFolioModalOpen} onOpenChange={setIsFolioModalOpen}>
        <DialogContent className="print-hide">
            <DialogHeader>
                <DialogTitle>Generar Certificado</DialogTitle>
                <DialogDescription>
                    Se usará el siguiente número de folio para el certificado. Puedes editarlo si es necesario.
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
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="ghost">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleProceedToPrint} disabled={isGenerating}>Continuar a Impresión</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
