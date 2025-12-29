
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { pingCalendarsAction, pingFirestoreAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Wifi, WifiOff, CheckCircle2, XCircle, Database, Calendar, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const calendarMapping = {
    'Spark': 'spark_915a8e75fb77411f3281b6c402f511ff7ecb16977457a2c8f4257c51cdfdef80@group.calendar.google.com',
    'Picanto Blanco': 'picanto_blanco_35a77224bcac6dc3d7583f5d04a76e08188a4128c73a69d11125404515815e47@group.calendar.google.com',
    'Picanto Bronce': 'picanto_bronce_c165061133564b4592330beb28155342d1a48c8a58e7200cee3a8c93d7410c65@group.calendar.google.com',
    'Moto': 'moto_certificados.fedm@gmail.com',
};

type PingResult = {
    success: boolean;
    message: string;
    error?: string;
    calendarId?: string;
};

export default function SettingsPage() {
  const [isPingingCalendars, setIsPingingCalendars] = useState(false);
  const [isPingingFirestore, setIsPingingFirestore] = useState(false);
  const [calendarResults, setCalendarResults] = useState<PingResult[]>([]);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const { toast } = useToast();

  const handlePingAllCalendars = async () => {
    setIsPingingCalendars(true);
    setCalendarResults([]);
    const promises = Object.values(calendarMapping).map(calendarId => 
        pingCalendarsAction({ calendarId })
    );
    
    const settledResults = await Promise.all(promises);
    
    setCalendarResults(settledResults as PingResult[]);
    setIsCalendarDialogOpen(true);
    setIsPingingCalendars(false);
  };

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

  const getCalendarName = (id: string) => {
    return Object.keys(calendarMapping).find(key => calendarMapping[key as keyof typeof calendarMapping] === id) || 'Calendario Desconocido';
  }

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

            <Card>
                 <CardHeader>
                    <div className="flex items-center gap-4">
                        <Calendar className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle>Estado de Google Calendar</CardTitle>
                            <CardDescription>Verifica la conexión con los calendarios.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Verifica si la aplicación tiene los permisos necesarios para acceder y crear eventos en los calendarios de los vehículos.
                    </p>
                </CardContent>
                <CardFooter>
                    <Button onClick={handlePingAllCalendars} disabled={isPingingCalendars}>
                        {isPingingCalendars ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Wifi className="mr-2 h-4 w-4" />
                        )}
                        Probar Conexiones de Calendario
                    </Button>
                </CardFooter>
            </Card>
        </div>


      <Dialog open={isCalendarDialogOpen} onOpenChange={setIsCalendarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resultados de la Conexión de Calendarios</DialogTitle>
            <DialogDescription>
              A continuación se muestra el estado de cada calendario.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {calendarResults.map((result, index) => (
              <div key={index} className="flex items-start gap-4">
                <div>
                  {result.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">
                    {getCalendarName(result.calendarId || '')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.success ? result.message : result.error || result.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
