'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { signInWithEmailAndPassword } from 'firebase/auth';
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

  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail || !password) {
      setError('Por favor, selecciona un correo y escribe tu contraseña.');
      return;
    }

    setIsLoggingIn(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, selectedEmail, password);
      
      const roleName = employeeRoles.find(r => r.email === selectedEmail)?.name || 'Usuario';
      toast({
        title: 'Inicio de Sesión Exitoso',
        description: `Bienvenido como ${roleName}.`,
      });
      router.push('/dashboard');
    } catch (e: any) {
      console.error("Error de inicio de sesión:", e);
      let description = 'Ocurrió un error inesperado.';
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        description = 'Las credenciales son incorrectas. Verifica tu correo y contraseña.';
      }
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
            <CardTitle>Iniciar Sesión</CardTitle>
            <CardDescription>Usa tus credenciales para acceder al panel.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Correo Electrónico</Label>
                <Select onValueChange={setSelectedEmail} value={selectedEmail}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona tu correo" />
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
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoggingIn || !selectedEmail || !password}>
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
