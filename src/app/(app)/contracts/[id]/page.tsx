'use client';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { ContractView } from '@/components/contract-view';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Award } from 'lucide-react';
import { useEffect, useState } from 'react';
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

export default function ContractDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const db = useDb();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { role } = useCurrentRole();

  const [isFolioModalOpen, setIsFolioModalOpen] = useState(false);
  const [certificateFolio, setCertificateFolio] = useState('');

  const contractId = Array.isArray(id) ? id[0] : id;
  const shouldPrint = searchParams.get('print') === 'true';

  const contractRef = useMemoDoc(() => {
    if (!db || !user || !contractId) return null;
    return doc(db, `contracts`, contractId);
  }, [db, user, contractId]);

  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);
  
  const canGenerateCertificate = contract && ['Curso Auto', 'Curso Moto', 'Curso Deluxe', 'Curso Mixto'].includes(contract.type);

  const handleOpenFolioModal = () => {
    const suggestedFolio = String(contract?.folioNumber || '');
    setCertificateFolio(suggestedFolio);
    setIsFolioModalOpen(true);
  };
  
  const handleProceedToPrint = () => {
    if (!certificateFolio) {
        toast({
            variant: 'destructive',
            title: 'Campo Requerido',
            description: 'Por favor, introduce un número de folio para el certificado.',
        });
        return;
    }
    const printUrl = `/certificate-print/${contractId}?folio=${encodeURIComponent(certificateFolio)}`;
    window.open(printUrl, '_blank');
    setIsFolioModalOpen(false);
  };

  useEffect(() => {
    // Only trigger print if shouldPrint is true, loading is finished, and the contract data exists.
    if (shouldPrint && contract && !isLoading) {
      // A short delay can help ensure all styles and content are fully rendered before printing.
      const timer = setTimeout(() => {
        window.print();
      }, 500); 
      return () => clearTimeout(timer); // Cleanup the timer if the component unmounts
    }
  }, [shouldPrint, contract, isLoading]);

  return (
    <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between print:hidden">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Volver</span>
                </Link>
                </Button>
            </div>
            {canGenerateCertificate && (
              <Button onClick={handleOpenFolioModal}>
                <Award className="mr-2 h-4 w-4" />
                Generar Certificado
              </Button>
            )}
      </div>
      
      {isLoading && <p>Cargando contrato...</p>}
      {error && <p className="text-destructive">Error: {error.message}</p>}
      {contract && <ContractView contract={contract} />}
      {!isLoading && !contract && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
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
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Generar Certificado</DialogTitle>
                <DialogDescription>
                    Introduce el número de folio que aparecerá en el certificado.
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
                <Button onClick={handleProceedToPrint}>Continuar a Impresión</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
