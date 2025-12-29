
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Wifi, Loader2, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';


export default function SettingsPage() {
  const [isPingingFirestore, setIsPingingFirestore] = useState(false);
  const { toast } = useToast();

  const handlePingFirestore = async () => {
    setIsPingingFirestore(true);
    // The original pingFirestoreAction has been removed as it's no longer needed.
    // You could implement a client-side ping here if necessary.
    toast({
        title: 'Prueba Deshabilitada',
        description: 'La prueba de conexión del servidor ya no es necesaria.',
    });
    setIsPingingFirestore(false);
  };

  return (
    <div className="flex flex-col gap-8">
        <h1 className="font-headline text-3xl font-bold">Ajustes y Diagnóstico del Sistema</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Database className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle>Estado de la Base de Datos</CardTitle>
                            <CardDescription>Verifica la conexión del cliente con Firestore.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        La funcionalidad de prueba del servidor se ha deshabilitado. Las operaciones de la base de datos ahora se ejecutan directamente desde el cliente.
                    </p>
                </CardContent>
                <CardFooter>
                    <Button onClick={handlePingFirestore} disabled>
                        <Wifi className="mr-2 h-4 w-4" />
                        Probar Conexión (Deshabilitado)
                    </Button>
                </CardFooter>
            </Card>
        </div>
    </div>
  );
}
