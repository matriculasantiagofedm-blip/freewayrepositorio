'use client';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Client } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/use-current-role';

export default function ClientsPage() {
  const { firestore, user } = useFirebase();
  const { role } = useCurrentRole();

  const clientsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !role) return null;
    
    const clientsCollection = collection(firestore, 'clients');
    
    if (role === 'Administrador') {
      // Admin sees all clients
      return query(clientsCollection);
    }
    
    // Other roles see only clients they have created
    return query(clientsCollection, where('userId', '==', user.uid));
    
  }, [firestore, user, role]);

  const { data: clients, isLoading } = useCollection<Client>(clientsQuery);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">Clientes</h1>
      </div>
      {isLoading && <p>Cargando clientes...</p>}
      {!isLoading && clients && clients.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`} className="no-underline">
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <div>
                            <CardTitle>{client.name}</CardTitle>
                            <CardDescription>{client.email}</CardDescription>
                            {client.idNumber && <CardDescription className="font-medium text-foreground pt-1">Cédula: {client.idNumber}</CardDescription>}
                        </div>
                    </CardHeader>
                </Card>
            </Link>
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {role === 'Administrador' ? 'No se encontraron clientes' : 'No tienes clientes todavía'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {role !== 'Administrador' && 'Crea un contrato para añadir tu primer cliente.'}
            </p>
          </div>
        )
      )}
    </div>
  );
}
