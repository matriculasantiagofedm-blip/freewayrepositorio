'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GanttChartSquare, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';

const employeeRoles = [
  { name: 'Administrador', email: 'admin@contracttime.app' },
  { name: 'Ventas', email: 'ventas@contracttime.app' },
  { name: 'Ventas Externas', email: 'ventas-externas@contracttime.app' },
];

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();

  const [selectedRole, setSelectedRole] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setError('Por favor, selecciona un rol para continuar.');
      return;
    }

    setIsLoggingIn(true);
    setError('');

    try {
      // Iniciar sesión de forma anónima
      await signInAnonymously(auth);

      // Guardar el rol seleccionado en una variable global para esta sesión
      const roleObject = employeeRoles.find(r => r.name === selectedRole);
      if (roleObject) {
        (window as any).selectedRoleForAnonymousSession = roleObject;
      }
      
      toast({
        title: 'Inicio de Sesión Exitoso',
        description: `Bienvenido como ${selectedRole}.`,
      });
      router.push('/dashboard');
    } catch (e: any) {
      console.error("Error de inicio de sesión anónimo:", e);
      const description = 'No se pudo iniciar la sesión. Por favor, intenta de nuevo.';
      setError(description);
      toast({
        variant: 'destructive',
        title: 'Error de Inicio de Sesión',
        description: description,
      });
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
            <CardTitle>Selecciona tu Rol</CardTitle>
            <CardDescription>Elige tu rol para acceder al panel de control.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Select onValueChange={setSelectedRole} value={selectedRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeRoles.map((role) => (
                      <SelectItem key={role.name} value={role.name}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {error && <p className="text-sm text-destructive">{error}</p>}
              
              <Button type="submit" className="w-full" disabled={isLoggingIn || !selectedRole}>
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
