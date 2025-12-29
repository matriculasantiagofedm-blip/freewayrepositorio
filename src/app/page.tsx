'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GanttChartSquare, Briefcase, UserCheck, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { initializeFirebase } from '@/firebase';

const roles = [
  { name: 'Ventas', icon: Briefcase, email: 'ventas@contracttime.app' },
  { name: 'Ventas Externas', icon: UserCheck, email: 'ventas-externas@contracttime.app' },
  { name: 'Administrador', icon: Shield, email: 'admin@contracttime.app' },
];

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<(typeof roles)[0] | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleRoleSelect = (role: (typeof roles)[0]) => {
    setSelectedRole(role);
    setPassword('');
    setError('');
    setIsDialogOpen(true);
  };

  const handleLogin = async () => {
    if (!selectedRole || !password) {
      setError('Por favor, introduce la contraseña.');
      return;
    }
    setIsLoggingIn(true);
    setError('');

    try {
      // Obtenemos la instancia de Auth directamente aquí
      const { auth } = initializeFirebase();
      await signInWithEmailAndPassword(auth, selectedRole.email, password);
      // Tras un inicio de sesión exitoso, redirigimos al grupo (app)
      // El guardia de entrada en (app)/page.tsx se encargará de la redirección final a /dashboard
      router.push('/dashboard'); 
    } catch (e: any) {
      console.error(e);
      setError('Contraseña o usuario incorrecto. Por favor, inténtalo de nuevo.');
      toast({
        variant: 'destructive',
        title: 'Error de autenticación',
        description: 'La contraseña o el rol seleccionado no son correctos.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };
  
  const handleDialogChange = (open: boolean) => {
    if (!open) {
        setSelectedRole(null);
        setPassword('');
        setError('');
    }
    setIsDialogOpen(open);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <GanttChartSquare className="h-16 w-16 text-primary" />
        </div>
        <div className="flex flex-col gap-2">
            <h1 className="font-headline text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            ContractTime
            </h1>
            <p className="text-xl font-medium text-foreground">Freeway Escuela de Manejo, S.A.</p>
        </div>
        <p className="text-lg text-muted-foreground">
          Selecciona tu rol para ingresar al sistema.
        </p>
        <div className="flex flex-col gap-4">
          {roles.map((role) => (
            <Button
                key={role.name}
                size="lg"
                variant="outline"
                className="justify-start text-base"
                onClick={() => handleRoleSelect(role)}
            >
                <role.icon className="mr-4 h-5 w-5 text-primary" />
                Entrar como {role.name}
            </Button>
          ))}
        </div>
      </div>
       {selectedRole && (
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                <DialogTitle>Iniciar Sesión como {selectedRole.name}</DialogTitle>
                <DialogDescription>
                    Introduce la contraseña para acceder al panel de control.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">
                    Contraseña
                    </Label>
                    <Input
                    id="password"
                    type="password"
                    className="col-span-3"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    />
                </div>
                {error && <p className="col-span-4 text-center text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                <Button onClick={handleLogin} disabled={isLoggingIn}>
                    {isLoggingIn ? 'Iniciando...' : 'Confirmar'}
                </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
      <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>Creado para profesionales que valoran su tiempo.</p>
      </footer>
    </div>
  );
}
