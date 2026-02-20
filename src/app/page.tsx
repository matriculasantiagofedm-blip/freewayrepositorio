'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GanttChart, UserPlus, ArrowRight, Lock, ShieldCheck, Loader2 } from 'lucide-react';
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
        setError('Contraseña incorrecta.');
      }
    } catch (err) {
      setError('Error de conexión.');
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
          <p className="text-lg font-medium text-slate-600 uppercase tracking-tighter">
            Freeway Escuela de Manejo, S.A.
          </p>
        </div>

        {/* PORTAL DEL ESTUDIANTE */}
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 px-2 text-muted-foreground font-black tracking-widest">Portal del Estudiante</span>
            </div>
          </div>
          
          <Card className="border-2 border-blue-600 bg-blue-50/30 overflow-hidden shadow-xl">
            <CardContent className="p-6 text-center space-y-4">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                  <UserPlus className="h-6 w-6 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-blue-900 text-lg uppercase leading-tight tracking-tighter">¿Deseas Inscribirte?</h3>
                  <p className="text-xs text-blue-700 font-medium">Proceso 100% automático. Elige tu horario, paga y obtén tu folio al instante.</p>
                </div>
                <Button asChild className="w-full h-14 bg-blue-600 hover:bg-blue-700 font-black text-lg shadow-lg uppercase tracking-wider group text-white">
                    <Link href="/enroll">
                        Inscribirme Ahora
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </Button>
            </CardContent>
          </Card>
        </div>

        {/* ACCESO ADMINISTRATIVO */}
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 px-2 text-muted-foreground font-black tracking-widest">Acceso Personal</span>
            </div>
          </div>

          {role ? (
            <Card className="border-green-200 bg-green-50 shadow-md">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-green-100 p-2 rounded-full w-fit mb-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                </div>
                <CardTitle className="text-sm font-bold uppercase">Sesión Activa</CardTitle>
                <CardDescription className="text-xs">Estás identificado como: <span className="font-bold text-slate-900">{role}</span></CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild className="w-full font-bold bg-green-600 hover:bg-green-700">
                  <Link href="/dashboard">Entrar al Panel</Link>
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card className="shadow-md border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase text-slate-600">
                  <Lock className="h-4 w-4" />
                  Identificación de Personal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAccess} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="key" className="text-[10px] uppercase font-black text-slate-400">Contraseña de Acceso</Label>
                    <Input 
                      id="key" 
                      type="password" 
                      placeholder="••••••••" 
                      className="h-10 text-lg tracking-widest"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="text-[10px] text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100">{error}</p>}
                  <Button type="submit" className="w-full h-11 font-bold shadow-sm" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validar Identidad'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-50">
          © {new Date().getFullYear()} Freeway Escuela de Manejo, S.A.
        </p>
      </div>
    </main>
  );
}
