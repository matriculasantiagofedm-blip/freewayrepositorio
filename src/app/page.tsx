'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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

  const [selectedRole, setSelectedRole] = useState<{name: string, email: string} | null>(null);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setError('Por favor, selecciona un rol para continuar.');
      return;
    }

    setIsLoggingIn(true);
    setError('');

    try {
      // Usamos el inicio de sesión anónimo.
      await signInAnonymously(auth);
      
      // Guardamos el rol seleccionado en una variable global para que `useCurrentRole` pueda acceder a él.
      // Esta es una forma sencilla de mantener el estado del rol en una sesión anónima.
      (window as any).selectedRoleForAnonymousSession = selectedRole;

      toast({
        title: 'Inicio de Sesión Exitoso',
        description: `Bienvenido como ${selectedRole.name}.`,
      });
      router.push('/dashboard');
    } catch (e: any) {
      console.error("Error de inicio de sesión anónimo:", e);
      const description = 'No se pudo iniciar la sesión anónima. Verifica la configuración de Firebase.';
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

  const handleRoleChange = (email: string) => {
    const role = employeeRoles.find(r => r.email === email) || null;
    setSelectedRole(role);
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
            <CardTitle>Seleccionar Rol</CardTitle>
            <CardDescription>Elige tu rol para acceder al panel de control.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Rol de Empleado</Label>
                <Select onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona tu rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeRoles.map((role) => (
                      <SelectItem key={role.email} value={role.email}>
                        {role.name} ({role.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoggingIn || !selectedRole}>
                {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoggingIn ? 'Iniciando...' : 'Entrar'}
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
