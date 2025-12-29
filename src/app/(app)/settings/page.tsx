
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { pingFirestoreAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Wifi, Loader2, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';


export default function SettingsPage() {
  const [isPingingFirestore, setIsPingingFirestore] = useState(false);
  const { toast } = useToast();

  const handlePingFirestore = async () => {
    setIsPingingFirestore(true);
    const result = await pingFirestoreAction();
    toast({
        variant: result.success ? 'default' : 'destructive',
        title: result.success ? 'Conexión Exitosa' : 'Error de Conexión',
        description: result.error || result.message,
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
                            <CardDescription>Verifica la conexión con Firestore.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Esta prueba intentará escribir, leer y eliminar un documento temporal para asegurar que todas las operaciones de la base de datos funcionan correctamente.
                    </p>
                </CardContent>
                <CardFooter>
                    <Button onClick={handlePingFirestore} disabled={isPingingFirestore}>
                        {isPingingFirestore ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Wifi className="mr-2 h-4 w-4" />
                        )}
                        Probar Conexión a Firestore
                    </Button>
                </CardFooter>
            </Card>
        </div>
    </div>
  );
}
