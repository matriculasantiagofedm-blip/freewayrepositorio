'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { pingCalendarsAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Wifi, WifiOff } from 'lucide-react';

export function HorarioHeader() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePing = async () => {
    setIsLoading(true);
    
    // El ID del calendario específico que queremos probar
    const calendarId = 'caa22a55efb4ec8120e449941e8df3d2731613826485af050c0b7ec0b60be588@group.calendar.google.com';

    const result = await pingCalendarsAction({ calendarId });

    if (result.success) {
      toast({
        title: 'Conexión Exitosa',
        description: result.message,
        variant: 'default',
      });
    } else {
      toast({
        title: 'Error de Conexión',
        description: result.error || result.message,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card text-card-foreground p-4">
       <div>
         <h3 className="font-semibold text-lg">Conexión con Google Calendar</h3>
         <p className="text-sm text-muted-foreground">
              Usa este botón para verificar si la aplicación tiene acceso a tu calendario.
         </p>
       </div>
      <Button onClick={handlePing} disabled={isLoading}>
        {isLoading ? (
          <>
            <WifiOff className="mr-2 h-4 w-4 animate-pulse" />
            Probando...
          </>
        ) : (
          <>
            <Wifi className="mr-2 h-4 w-4" />
            Probar Conexión
          </>
        )}
      </Button>
    </div>
  );
}
