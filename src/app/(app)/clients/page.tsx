'use client';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Client } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function ClientsPage() {
  const { firestore, user } = useFirebase();

  const clientRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // Directly reference the client document using the user's UID
    return doc(firestore, 'clients', user.uid);
  }, [firestore, user]);

  const { data: client, isLoading } = useDoc<Client>(clientRef);

  // Since we are fetching a single document, we'll wrap it in an array to fit the existing map structure.
  const clients = client ? [client] : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">Clientes</h1>
      </div>
      {isLoading && <p>Cargando clientes...</p>}
      {!isLoading && clients.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`} className="no-underline">
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <div>
                            <CardTitle>{client.name}</CardTitle>
                            <CardDescription>{client.email}</CardDescription>
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
              No tienes clientes todavía
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Crea un contrato para añadir tu primer cliente.
            </p>
          </div>
        )
      )}
    </div>
  );
}
