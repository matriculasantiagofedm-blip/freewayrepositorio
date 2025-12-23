'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { pingCalendarsAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Wifi, WifiOff, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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
    calendarId: string;
};

export function HorarioHeader() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<PingResult[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const handlePingAll = async () => {
    setIsLoading(true);
    setResults([]);
    const promises = Object.values(calendarMapping).map(calendarId => 
        pingCalendarsAction({ calendarId })
    );
    
    const settledResults = await Promise.all(promises);
    
    setResults(settledResults as PingResult[]);
    setIsDialogOpen(true);
    setIsLoading(false);
  };

  const getCalendarName = (id: string) => {
    return Object.keys(calendarMapping).find(key => calendarMapping[key as keyof typeof calendarMapping] === id) || 'Calendario Desconocido';
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border bg-card text-card-foreground p-4">
        <div>
          <h3 className="font-semibold text-lg">Conexión con Google Calendar</h3>
          <p className="text-sm text-muted-foreground">
            Usa este botón para verificar la conexión con todos los calendarios de vehículos.
          </p>
        </div>
        <Button onClick={handlePingAll} disabled={isLoading}>
          {isLoading ? (
            <>
              <WifiOff className="mr-2 h-4 w-4 animate-pulse" />
              Probando...
            </>
          ) : (
            <>
              <Wifi className="mr-2 h-4 w-4" />
              Probar Conexiones
            </>
          )}
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resultados de la Conexión</DialogTitle>
            <DialogDescription>
              A continuación se muestra el estado de cada calendario.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {results.map((result, index) => (
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
                    {getCalendarName(result.calendarId)}
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
    </>
  );
}
