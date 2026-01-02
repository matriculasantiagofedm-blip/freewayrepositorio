'use client';

import { useState } from 'react';
import {
  collection,
  getDocs,
  writeBatch,
  collectionGroup,
  query,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useDb } from '@/components/firebase-provider';
import { Database, HardHat, Loader2, PartyPopper } from 'lucide-react';
import type { Contract } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import Link from 'next/link';

export default function AdminPage() {
  const db = useDb();
  const { toast } = useToast();
  const { role } = useCurrentRole();
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    found: number;
    migrated: number;
  } | null>(null);

  const handleMigrateContracts = async () => {
    if (!db) {
      toast({
        variant: 'destructive',
        title: 'Error de Conexión',
        description: 'No se pudo conectar a la base de datos.',
      });
      return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      // Consulta en el collection group para encontrar todos los documentos en cualquier subcolección llamada "contracts"
      const oldContractsQuery = query(collectionGroup(db, 'contracts'));
      const querySnapshot = await getDocs(oldContractsQuery);

      const contractsToMigrate: { ref: any; data: Contract }[] = [];
      const rootContracts = new Set<string>();

      // Primero, filtramos para excluir los contratos que ya están en la colección raíz
      const rootContractsSnapshot = await getDocs(collection(db, 'contracts'));
      rootContractsSnapshot.forEach((doc) => rootContracts.add(doc.id));

      querySnapshot.forEach((doc) => {
        // La ruta de un documento en una subcolección será como 'users/USER_ID/contracts/CONTRACT_ID'
        // Nos interesan solo los que tienen más de 2 segmentos (no están en la raíz).
        const isNested = doc.ref.path.split('/').length > 2;
        if (isNested && !rootContracts.has(doc.id)) {
          contractsToMigrate.push({
            ref: doc.ref,
            data: { id: doc.id, ...doc.data() } as Contract,
          });
        }
      });
      
      const foundCount = contractsToMigrate.length;

      if (foundCount === 0) {
        setMigrationResult({ found: 0, migrated: 0 });
        toast({
          title: 'No hay nada que migrar',
          description:
            'No se encontraron contratos en ubicaciones antiguas.',
        });
        setIsMigrating(false);
        return;
      }

      const batch = writeBatch(db);
      const newRootContractsRef = collection(db, 'contracts');

      contractsToMigrate.forEach(({ ref, data }) => {
        // Creamos una nueva referencia en la colección raíz con el MISMO ID
        const newContractRef = doc(newRootContractsRef, data.id);
        
        // Copiamos los datos al nuevo documento
        batch.set(newContractRef, data);
        
        // Borramos el documento antiguo
        batch.delete(ref);
      });
      
      // Ejecutamos todas las operaciones en un solo lote
      await batch.commit();

      setMigrationResult({ found: foundCount, migrated: foundCount });
      toast({
        title: '¡Migración Completada!',
        description: `Se movieron ${foundCount} contratos a la colección central.`,
      });

    } catch (error: any) {
      console.error('Error durante la migración:', error);
      toast({
        variant: 'destructive',
        title: 'Error en la Migración',
        description:
          error.message ||
          'Ocurrió un error al intentar migrar los contratos.',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  // Solo los administradores pueden ver esta página
  if (role !== 'Administrador') {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
        <h3 className="mt-4 text-lg font-semibold text-foreground">
          Acceso Restringido
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Solo los administradores pueden acceder a esta sección.
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Volver al Panel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-headline text-3xl font-bold">
        Administración del Sistema
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <HardHat className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Mantenimiento de Datos</CardTitle>
                <CardDescription>
                  Herramientas para corregir y mantener la consistencia de los
                  datos.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Usa este botón para buscar contratos guardados en ubicaciones
              antiguas (anidadas por usuario) y moverlos a la colección
              centralizada `/contracts` para que sean visibles en toda la
              aplicación.
            </p>
            <Button onClick={handleMigrateContracts} disabled={isMigrating}>
              {isMigrating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              {isMigrating
                ? 'Migrando...'
                : 'Migrar Contratos Antiguos'}
            </Button>
            {migrationResult && (
              <div className="mt-4 rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  <PartyPopper className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="font-semibold text-foreground">
                      Resultado de la Migración
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {migrationResult.found > 0
                        ? `Se encontraron y migraron ${migrationResult.migrated} de ${migrationResult.found} contratos.`
                        : 'No se encontraron contratos para migrar.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
