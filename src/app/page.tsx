'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GanttChartSquare, Briefcase, UserCheck, Shield, ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useUser, useAuth } from '@/firebase';

// Definimos los roles con su nombre, icono, email y contraseña asociada.
const roles = [
  { name: 'Ventas', icon: Briefcase, email: 'ventas@contracttime.app', password: 'ventas123' },
  { name: 'Ventas Externas', icon: UserCheck, email: 'ventas-externas@contracttime.app', password: 'Ayax/2022' },
  { name: 'Administrador', icon: Shield, email: 'admin@contracttime.app', password: 'Ayax/2022' },
];

type Role = typeof roles[0] | null;

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();

  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Redirige al dashboard si el usuario ya ha iniciado sesión
  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !password) {
      setError('Por favor, introduce tu contraseña.');
      return;
    }
    
    // Validar contraseña correcta antes de intentar iniciar sesión
    if (password !== selectedRole.password) {
        setError('Contraseña incorrecta. Por favor, inténtalo de nuevo.');
        toast({
            variant: 'destructive',
            title: 'Error de autenticación',
            description: 'La contraseña no es correcta para el rol seleccionado.',
        });
        return;
    }

    setIsLoggingIn(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, selectedRole.email, password);
      // La redirección se maneja con el useEffect de arriba, que se activará cuando 'user' cambie.
    } catch (e: any) {
      console.error(e);
      let description = 'Ocurrió un error inesperado al iniciar sesión.';
      if (e.code === 'auth/wrong-password') {
        description = 'La contraseña es incorrecta.';
      } else if (e.code === 'auth/user-not-found') {
        description = 'El usuario no existe. Contacte al administrador.';
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

  const handleBack = () => {
    setSelectedRole(null);
    setPassword('');
    setError('');
  };
  
  // Muestra un estado de carga a pantalla completa mientras se verifica si hay un usuario
  // o si el usuario ya está autenticado para redirigir.
  if (isUserLoading || user) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Cargando aplicación...</p>
        </div>
    );
  }

  // Si no hay usuario y la carga ha terminado, muestra la página de inicio de sesión.
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
            {selectedRole ? (
              <div className="relative">
                <Button variant="ghost" size="icon" className="absolute -left-4 -top-2" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <CardTitle>Ingresar como {selectedRole.name}</CardTitle>
                <CardDescription>Introduce la contraseña para este rol.</CardDescription>
              </div>
            ) : (
              <>
                <CardTitle>Selecciona tu Rol</CardTitle>
                <CardDescription>Elige cómo quieres iniciar sesión.</CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {selectedRole ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoggingIn}>
                  {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoggingIn ? 'Iniciando...' : 'Entrar'}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                {roles.map((role) => (
                  <Button
                    key={role.name}
                    variant="outline"
                    className="w-full justify-start h-14 text-lg"
                    onClick={() => setSelectedRole(role)}
                  >
                    <role.icon className="mr-4 h-6 w-6" />
                    {role.name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>Creado para profesionales que valoran su tiempo.</p>
      </footer>
    </div>
  );
}
