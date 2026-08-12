'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ShieldCheck, Loader2, LogIn, Lock } from 'lucide-react';
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

export default function AdminAccessPage() {
  const { auth, firestore, setRole, role } = useFirebase();
  const [accessKey, setAccessKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

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

        // Navegar inmediatamente — escribir perfil en background
        setRole(accessKey);
        router.push('/dashboard');

        // Escribir perfil en Firestore de forma no bloqueante
        currentUser.getIdToken(true)
          .then(() => setDoc(doc(firestore, 'users', currentUser!.uid), {
            uid: currentUser!.uid,
            role: assignedRole,
            name: assignedRole,
            lastActive: serverTimestamp(),
          }, { merge: true }))
          .catch((e) => console.error('[Profile write] Error:', e));

      } else {
        setError('Contraseña incorrecta.');
      }
    } catch (err: any) {
      console.error('[Login acceso-privado] Error:', err?.code, err);
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center text-white mb-8">
            <div className="inline-block p-3 bg-white/10 rounded-full mb-4">
                <Lock className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-widest">Portal Administrativo</h1>
            <p className="text-slate-400 text-xs">Acceso restringido para personal de Freeway</p>
        </div>

        {role ? (
          <Card className="border-green-500 bg-green-50/10 backdrop-blur-md text-white shadow-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto bg-green-500/20 p-3 rounded-full w-fit mb-4">
                <ShieldCheck className="h-8 w-8 text-green-400" />
              </div>
              <CardTitle>Sesión Activa</CardTitle>
              <CardDescription className="text-slate-300">
                Estás identificado como: <span className="font-bold text-white">{role}</span>
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild className="w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700">
                <Link href="/dashboard">Entrar al Panel de Control</Link>
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="shadow-2xl border-none bg-white">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <LogIn className="h-5 w-5 text-primary" />
                Identificación de Personal
              </CardTitle>
              <CardDescription>Ingresa tu clave de rol para continuar.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAccess} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key" className="text-xs uppercase font-black text-slate-500">Contraseña de Acceso</Label>
                  <Input 
                    id="key" 
                    type="password" 
                    placeholder="••••••••" 
                    className="h-11 text-lg tracking-widest"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100">{error}</p>}
                <Button type="submit" className="w-full h-12 font-bold shadow-lg" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validar Identidad'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        
        <div className="text-center">
            <Button variant="link" asChild className="text-slate-500 text-xs">
                <Link href="/">Volver al Portal Público</Link>
            </Button>
        </div>
      </div>
    </main>
  );
}
