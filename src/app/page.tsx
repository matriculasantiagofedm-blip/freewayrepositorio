'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { GanttChart, ShieldCheck, Loader2, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useFirebase } from '@/components/firebase-provider';
import { signInAnonymously } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { auth, setRole, role } = useFirebase();
  const [accessKey, setAccessKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      const validKeys = ['ventas123', 'ventasext123', 'Ayax/2022'];
      
      if (validKeys.includes(accessKey)) {
        setRole(accessKey);
        router.push('/dashboard');
      } else {
        setError('Contraseña incorrecta. Por favor verifica tus credenciales.');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión con el sistema. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-body">
      <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 shadow-sm">
              <GanttChart className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-slate-900">
            Contract<span className="text-primary">Time</span>
          </h1>
          <p className="text-lg font-medium text-slate-600">
            Freeway Escuela de Manejo, S.A.
          </p>
        </div>

        {/* SECCIÓN PÚBLICA PARA ESTUDIANTES (FUERA DEL PASSWORD) */}
        {!role && (
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-50 px-2 text-muted-foreground font-black tracking-widest">Portal del Estudiante</span></div>
            </div>
            
            <Card className="border-2 border-blue-600 bg-blue-50/30 overflow-hidden shadow-xl">
              <CardContent className="p-6 text-center space-y-4">
                  <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                    <UserPlus className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-blue-900 text-lg uppercase leading-tight">¿Deseas Inscribirte?</h3>
                    <p className="text-xs text-blue-700 font-medium">Inscripción 100% automática. Paga con Yappy o Tarjeta y obtén tu folio al instante.</p>
                  </div>
                  <Button asChild className="w-full h-14 bg-blue-600 hover:bg-blue-700 font-black text-lg shadow-lg uppercase tracking-wider group">
                      <Link href="/enroll">
                          Inscribirme Ahora
                          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </Link>
                  </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {role ? (
          <Card className="border-green-200 bg-green-50/50 shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-4">
                <ShieldCheck className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-green-800">Sesión Iniciada</CardTitle>
              <CardDescription>
                Acceso como: <span className="font-bold text-slate-900">{role}</span>
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild className="w-full h-12 text-base font-semibold shadow-md">
                <Link href="/dashboard">
                  Ir al Panel de Control
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-50 px-2 text-muted-foreground font-black tracking-widest">Acceso Administrativo</span></div>
            </div>

            <Card className="shadow-2xl border-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <LogIn className="h-5 w-5 text-primary" />
                  Ingreso Interno
                </CardTitle>
                <CardDescription>Solo personal autorizado de Freeway.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAccess} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="key" className="text-slate-700">Contraseña de Rol</Label>
                    <Input 
                      id="key" 
                      type="password" 
                      placeholder="••••••••" 
                      className="h-12 text-lg tracking-widest"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md border border-destructive/20 animate-in shake-in duration-300">
                      {error}
                    </p>
                  )}
                  <Button type="submit" className="w-full h-12 text-base font-semibold shadow-lg" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      'Entrar al Sistema'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
          © {new Date().getFullYear()} Freeway Escuela de Manejo, S.A.
        </p>
      </div>
    </main>
  );
}
