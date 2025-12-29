'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GanttChartSquare, Briefcase, UserCheck, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { initializeFirebase } from '@/firebase';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, introduce tu correo y contraseña.');
      return;
    }
    setIsLoggingIn(true);
    setError('');

    try {
      const { auth } = initializeFirebase();
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard'); 
    } catch (e: any) {
      console.error(e);
      setError('Credenciales incorrectas. Por favor, inténtalo de nuevo.');
      toast({
        variant: 'destructive',
        title: 'Error de autenticación',
        description: 'El correo electrónico o la contraseña no son correctos.',
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
                <CardDescription>Ingresa tus credenciales para acceder al sistema.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Correo Electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="tu@correo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full" disabled={isLoggingIn}>
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
