'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GanttChartSquare, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signInAnonymously, type User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser } from '@/components/firebase-provider';

// Los roles válidos ahora se usan para validación interna
const validRoles = ['Ayax/2022', 'ventas123', 'ventasext123'];

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const { setDevUser } = useUser();

  const [roleInput, setRoleInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
        setError('Servicio de autenticación no disponible.');
        return;
    }

    if (!roleInput) {
      setError('Por favor, escribe un perfil para continuar.');
      return;
    }
    
    // Validar si el rol escrito es uno de los permitidos
    if (!validRoles.includes(roleInput)) {
        setError('El perfil ingresado no es válido.');
        return;
    }

    setIsLoggingIn(true);
    setError('');

    try {
      await signInAnonymously(auth);

      // This code will run if signInAnonymously succeeds
      const selectedRole = { name: roleInput };
      (window as any).selectedRoleForAnonymousSession = selectedRole;
      sessionStorage.setItem('anonymousUserRole', roleInput);
      
      toast({
        title: 'Inicio de Sesión Exitoso',
        description: `Bienvenido.`,
      });
      router.push('/dashboard');

    } catch (e: any) {
        const isDevEnvironment = process.env.NODE_ENV === 'development';
        const isCloudWorkstation = window.location.hostname.includes('cloudworkstations.dev');
        
        // This is the workaround for the unauthorized domain issue in the dev environment
        if (isDevEnvironment && isCloudWorkstation && e.code === 'auth/api-key-not-valid') {
            console.warn("DEV MODE: Firebase Auth failed due to domain restrictions. Creating a mock user session.");
            
            // Create a mock user and set it in the provider
            const mockUser = { uid: 'dev-user-uid', email: ``, isAnonymous: true, getIdToken: async () => 'mock-token' } as unknown as User;
            setDevUser(mockUser);

            // Set role and redirect, same as in the successful case
            const selectedRole = { name: roleInput };
            (window as any).selectedRoleForAnonymousSession = selectedRole;
            sessionStorage.setItem('anonymousUserRole', roleInput);
            
            toast({
              title: 'Inicio de Sesión (Simulado)',
              description: `Bienvenido.`,
            });
            router.push('/dashboard');

        } else {
            // Handle other, real errors
            console.error("Error de inicio de sesión:", e);
            const description = 'No se pudo iniciar la sesión. Por favor, intenta de nuevo.';
            setError(description);
            toast({
                variant: 'destructive',
                title: 'Error de Inicio de Sesión',
                description: description,
            });
        }
    } finally {
      setIsLoggingIn(false);
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
            <CardTitle>Ingresa tu Perfil</CardTitle>
            <CardDescription>Escribe tu perfil de empleado para acceder al panel.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                 <Input 
                    type="password"
                    placeholder="Escribe tu perfil aquí"
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                  />
              </div>
              
              {error && <p className="text-sm text-destructive">{error}</p>}
              
              <Button type="submit" className="w-full" disabled={isLoggingIn || !roleInput}>
                {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoggingIn ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>Creado para profesionales que valoran su tiempo.</p>
      </footer>
    </div>
  );
}
