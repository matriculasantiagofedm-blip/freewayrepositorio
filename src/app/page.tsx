'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GanttChart, UserPlus, ArrowRight, Lock, ShieldCheck, Loader2, CalendarDays, CreditCard, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useFirebase } from '@/components/firebase-provider';
import { signInAnonymously } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const roleMapping: { [key: string]: string } = {
  'ventas123': 'Ventas',
  'ventasext123': 'Ventas Externas',
  'Ayax/2022': 'Administrador',
};

export default function Home() {
  const { auth, firestore, setRole, role } = useFirebase();
  const [accessKey, setAccessKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }

      if (roleMapping[accessKey]) {
        const assignedRole = roleMapping[accessKey];
        
        if (currentUser) {
          await setDoc(doc(firestore, 'users', currentUser.uid), {
            uid: currentUser.uid,
            role: assignedRole,
            name: assignedRole,
            lastActive: serverTimestamp(),
          }, { merge: true });
        }

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

  if (!mounted) return null;

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

        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 px-2 text-muted-foreground font-black tracking-widest">Portal del Estudiante</span>
            </div>
          </div>
          
          <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-slate-900 via-[#0a192f] to-slate-950 text-white rounded-[2rem] transform transition-transform duration-500 hover:scale-[1.02] group">
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none mix-blend-overlay" />
            <div className="absolute -top-32 -right-32 h-64 w-64 bg-blue-500/20 blur-[60px] rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute -bottom-32 -left-32 h-64 w-64 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none" />

            <CardContent className="p-8 pb-10 text-center space-y-6 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-300 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] border border-blue-500/20 mb-2 shadow-inner">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Cupos Disponibles Hoy
              </div>
              
              <div className="mx-auto bg-gradient-to-tr from-blue-500 to-indigo-400 w-16 h-16 rounded-2xl rotate-3 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.4)] group-hover:rotate-6 transition-transform duration-300">
                <UserPlus className="h-8 w-8 text-white drop-shadow-md -rotate-3 group-hover:-rotate-6 transition-transform duration-300" />
              </div>
              
              <div className="space-y-4">
                <h3 className="font-headline text-white text-3xl sm:text-4xl font-black uppercase leading-[1.1] tracking-tighter drop-shadow-md">
                  Acelera tu <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400">Futuro</span>
                </h3>
                <p className="text-sm text-slate-400 font-medium max-w-[280px] mx-auto leading-relaxed">
                  Tú tienes el control. Elige tus propios días y horas de práctica, arma tu calendario a tu medida y asegura tu cupo 100% online.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[8px] sm:text-[9px] uppercase font-black tracking-widest text-slate-400 py-4 border-y border-white/10 mt-2 mb-4">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="bg-white/5 p-2 rounded-full"><CalendarDays className="h-4 w-4 text-emerald-400" /></div>
                  <span className="text-center leading-tight">Horarios<br/>Flexibles</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="bg-white/5 p-2 rounded-full"><Smartphone className="h-4 w-4 text-blue-400" /></div>
                  <span className="text-center leading-tight">Aceptamos<br/>Yappy</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="bg-white/5 p-2 rounded-full"><CreditCard className="h-4 w-4 text-indigo-400" /></div>
                  <span className="text-center leading-tight">Tarjetas<br/>Crédito</span>
                </div>
              </div>

              <Button asChild className="w-full h-14 sm:h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-black text-base sm:text-lg uppercase tracking-widest group text-white shadow-[0_10px_40px_-10px_rgba(59,130,246,0.8)] border border-blue-400/30 rounded-2xl relative overflow-hidden">
                <Link href="/enroll">
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                  <span className="relative z-10 flex items-center justify-center">
                    Matricularme Ahora
                    <ArrowRight className="ml-3 h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-300 group-hover:translate-x-2" />
                  </span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

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
