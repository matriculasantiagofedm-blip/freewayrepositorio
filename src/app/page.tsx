'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GanttChartSquare, Briefcase, UserCheck, Shield, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';

// Se elimina la dependencia de contraseñas. El acceso se basará en roles anónimos.
const roles = [
  { name: 'Ventas', icon: Briefcase, email: 'ventas@contracttime.app' },
  { name: 'Ventas Externas', icon: UserCheck, email: 'ventas-externas@contracttime.app' },
  { name: 'Administrador', icon: Shield, email: 'admin@contracttime.app' },
];

type Role = typeof roles[0];

// Variable global para simular el rol seleccionado en la sesión anónima.
// Esto es una solución temporal de lado del cliente para la demostración.
if (typeof window !== 'undefined') {
  (window as any).selectedRoleForAnonymousSession = null;
}


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();

  const [isLoggingIn, setIsLoggingIn] = useState<string | null>(null);

  const handleRoleLogin = async (role: Role) => {
    setIsLoggingIn(role.name);

    try {
      // Almacena el rol seleccionado en una variable global antes de iniciar sesión.
      // El hook useCurrentRole leerá esta variable para determinar el rol.
       if (typeof window !== 'undefined') {
        (window as any).selectedRoleForAnonymousSession = role;
      }
      
      // Inicia sesión de forma anónima. Firebase creará un usuario temporal.
      await signInAnonymously(auth);
      
      toast({
        title: `Iniciando como ${role.name}`,
        description: 'Has iniciado sesión correctamente.',
      });

      // Redirige al panel de control.
      router.push('/dashboard');

    } catch (e: any) {
      console.error("Error en inicio de sesión anónimo:", e);
      toast({
        variant: 'destructive',
        title: 'Error de Inicio de Sesión',
        description: 'No se pudo iniciar la sesión anónima. Por favor, intenta de nuevo.',
      });
      if (typeof window !== 'undefined') {
        (window as any).selectedRoleForAnonymousSession = null;
      }
    } finally {
      setIsLoggingIn(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <GanttChartSquare className="h-16 w-16 text-primary" />
          <h1 className="font-headline text-5xl font-bold tracking-tight text-foreground sm:text-6xl mt-4">
            ContractTime
          </h1>
          <p className="text-xl font-medium text-foreground">Freeway Escuela de Manejo, S.A.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecciona tu Rol</CardTitle>
            <CardDescription>Elige cómo quieres iniciar sesión.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {roles.map((role) => (
                <Button
                  key={role.name}
                  variant="outline"
                  className="w-full justify-start h-14 text-lg"
                  onClick={() => handleRoleLogin(role)}
                  disabled={!!isLoggingIn}
                >
                  {isLoggingIn === role.name ? (
                    <Loader2 className="mr-4 h-6 w-6 animate-spin" />
                  ) : (
                    <role.icon className="mr-4 h-6 w-6" />
                  )}
                  {role.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>Creado para profesionales que valoran su tiempo.</p>
      </footer>
    </div>
  );
}
